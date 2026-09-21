import Dexie, { type EntityTable } from "dexie";
import { z } from "zod";

import type { Classroom } from "@/domain/classroom/classroom.schema";
import { classroomSchema } from "@/domain/classroom/classroom.schema";
import type {
  ClasskitRepository,
  ClassSummary,
  SaveOptions,
  SaveResult,
} from "./classkit-repository";
import { GoogleDriveRepository } from "./google-drive-repository";
import { PersistenceError } from "./persistence-errors";

export type SyncStatus =
  "saved" | "saving" | "offline" | "reconnect_required" | "conflict" | "error";

const cloudSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  createdAt: z.iso.datetime({ offset: true }),
  data: z.object({
    classes: z.array(classroomSchema),
    avatars: z.array(
      z.object({
        id: z.uuid(),
        mimeType: z.literal("image/webp"),
        base64: z.string().min(1),
      }),
    ),
  }),
});

type CloudSnapshot = z.infer<typeof cloudSnapshotSchema>;
type SyncMetadata = {
  id: "cloud";
  remoteFileId?: string;
  remoteVersion?: string;
  lastSyncedAt?: string;
  dirty: boolean;
  backupDeleted?: boolean;
};

class SyncDatabase extends Dexie {
  // The first version preserves existing per-record metadata while migration runs.
  records!: EntityTable<{ id: string }, "id">;
  manifest!: EntityTable<{ id: string }, "id">;
  metadata!: EntityTable<SyncMetadata, "id">;

  constructor() {
    super("classkit-sync");
    this.version(1).stores({
      records: "id, dirty, localUpdatedAt",
      manifest: "id",
    });
    this.version(2).stores({
      records: "id, dirty, localUpdatedAt",
      manifest: "id",
      metadata: "id, dirty",
    });
  }
}

const debounceMs = 2_000;

function blobToBase64(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let start = 0; start < bytes.length; start += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
    }
    return btoa(binary);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

export class SynchronizedRepository implements ClasskitRepository {
  private readonly database = new SyncDatabase();
  private readonly listeners = new Set<(status: SyncStatus) => void>();
  private status: SyncStatus = navigator.onLine ? "saved" : "offline";
  private syncTimer?: number;
  private inFlight?: Promise<void>;
  private readonly channel = new BroadcastChannel("classkit-sync");

  constructor(
    private readonly local: ClasskitRepository,
    private readonly remote: GoogleDriveRepository,
  ) {
    window.addEventListener("online", () => void this.syncNow());
    window.addEventListener("offline", () => this.setStatus("offline"));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void this.syncNow();
    });
    this.channel.onmessage = (event: MessageEvent<{ type: string }>) => {
      if (event.data.type === "snapshot-synced") void this.syncNow();
    };
  }

  getStatus = () => this.status;
  requireReconnect = () => this.setStatus("reconnect_required");
  subscribe = (listener: (status: SyncStatus) => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setStatus(status: SyncStatus) {
    this.status = status;
    this.listeners.forEach((listener) => listener(status));
  }

  async listClasses(signal?: AbortSignal): Promise<ClassSummary[]> {
    return this.local.listClasses(signal);
  }
  async getClass(classId: string, signal?: AbortSignal): Promise<Classroom> {
    return this.local.getClass(classId, signal);
  }
  async createClass(classroom: Classroom): Promise<void> {
    await this.local.createClass(classroom);
    await this.markDirty();
  }
  async saveClass(
    classroom: Classroom,
    options?: SaveOptions,
  ): Promise<SaveResult> {
    const result = await this.local.saveClass(classroom, options);
    await this.markDirty();
    return result;
  }
  async deleteClass(classId: string): Promise<void> {
    await this.local.deleteClass(classId);
    await this.markDirty();
  }
  async getAvatar(
    avatarId: string,
    signal?: AbortSignal,
  ): Promise<Blob | undefined> {
    return this.local.getAvatar(avatarId, signal);
  }
  async saveAvatar(avatarId: string, image: Blob): Promise<void> {
    await this.local.saveAvatar(avatarId, image);
    await this.markDirty();
  }
  async deleteAvatar(avatarId: string): Promise<void> {
    await this.local.deleteAvatar(avatarId);
    await this.markDirty();
  }

  async deleteDriveBackups(): Promise<number> {
    const files = await this.remote.listAppDataFiles();
    await Promise.all(files.map(({ id }) => this.remote.delete(id)));
    await this.database.metadata.put({
      id: "cloud",
      dirty: false,
      backupDeleted: true,
      lastSyncedAt: new Date().toISOString(),
    });
    this.setStatus("saved");
    return files.length;
  }

  private async markDirty() {
    const previous = await this.database.metadata.get("cloud");
    await this.database.metadata.put({
      id: "cloud",
      dirty: true,
      remoteFileId: previous?.remoteFileId,
      remoteVersion: previous?.remoteVersion,
      lastSyncedAt: previous?.lastSyncedAt,
      backupDeleted: false,
    });
    this.scheduleSync();
  }

  private scheduleSync() {
    if (this.syncTimer) window.clearTimeout(this.syncTimer);
    this.syncTimer = window.setTimeout(() => void this.syncNow(), debounceMs);
  }

  syncNow(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    const task = this.syncSnapshot().finally(() => {
      this.inFlight = undefined;
    });
    this.inFlight = task;
    return task;
  }

  private async syncSnapshot(): Promise<void> {
    if (!navigator.onLine) return this.setStatus("offline");
    this.setStatus("saving");
    try {
      const metadata = await this.database.metadata.get("cloud");
      const localSnapshot = await this.exportSnapshot();
      const remote = await this.remote.getCloudSnapshot();

      if (!remote) {
        if (
          !metadata?.dirty &&
          (metadata?.backupDeleted || !localSnapshot.data.classes.length)
        ) {
          this.setStatus("saved");
          return;
        }
        await this.uploadSnapshot(localSnapshot, metadata);
        return;
      }

      const remoteChanged = remote.file.version !== metadata?.remoteVersion;
      if (!remoteChanged) {
        if (metadata?.dirty) await this.uploadSnapshot(localSnapshot, metadata);
        else this.setStatus("saved");
        return;
      }

      const remoteSnapshot = cloudSnapshotSchema.parse(remote.raw);
      if (metadata?.dirty) {
        const merged = this.mergeSnapshots(localSnapshot, remoteSnapshot);
        await this.importSnapshot(merged);
        await this.uploadSnapshot(merged, {
          ...metadata,
          remoteFileId: remote.file.id,
        });
      } else {
        await this.importSnapshot(remoteSnapshot);
        await this.saveMetadata({
          dirty: false,
          remoteFileId: remote.file.id,
          remoteVersion: remote.file.version,
        });
        this.setStatus("saved");
      }
    } catch (error) {
      const persistence = error instanceof PersistenceError ? error : undefined;
      if (persistence?.code === "unauthorized") {
        this.setStatus("reconnect_required");
        return;
      }
      if (persistence?.code === "offline") {
        this.setStatus("offline");
        return;
      }
      this.setStatus("error");
    }
  }

  private async uploadSnapshot(
    snapshot: CloudSnapshot,
    metadata?: SyncMetadata,
  ) {
    const uploaded = await this.remote.saveCloudSnapshot(
      snapshot,
      metadata?.remoteFileId,
    );
    const file = await this.remote.getFile(uploaded.id);
    await this.saveMetadata({
      dirty: false,
      remoteFileId: file.id,
      remoteVersion: file.version,
      backupDeleted: false,
    });
    this.channel.postMessage({ type: "snapshot-synced" });
    this.setStatus("saved");
  }

  private async exportSnapshot(): Promise<CloudSnapshot> {
    const summaries = await this.local.listClasses();
    const classes = await Promise.all(
      summaries.map(({ id }) => this.local.getClass(id)),
    );
    const avatarIds = new Set(
      classes.flatMap((classroom) =>
        classroom.students.flatMap((student) =>
          student.avatar ? [student.avatar.id] : [],
        ),
      ),
    );
    const avatars = await Promise.all(
      [...avatarIds].map(async (id) => {
        const image = await this.local.getAvatar(id);
        if (!image) return undefined;
        return {
          id,
          mimeType: "image/webp" as const,
          base64: await blobToBase64(image),
        };
      }),
    );
    return cloudSnapshotSchema.parse({
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      data: { classes, avatars: avatars.filter(Boolean) },
    });
  }

  private async importSnapshot(snapshot: CloudSnapshot) {
    for (const classroom of snapshot.data.classes) {
      try {
        await this.local.saveClass(classroom);
      } catch (error) {
        if (!(error instanceof PersistenceError) || error.code !== "not_found")
          throw error;
        await this.local.createClass(classroom);
      }
    }
    await Promise.all(
      snapshot.data.avatars.map(({ id, mimeType, base64 }) =>
        this.local.saveAvatar(id, base64ToBlob(base64, mimeType)),
      ),
    );
  }

  private mergeSnapshots(
    local: CloudSnapshot,
    remote: CloudSnapshot,
  ): CloudSnapshot {
    const classes = new Map(remote.data.classes.map((item) => [item.id, item]));
    for (const classroom of local.data.classes) {
      const remoteClassroom = classes.get(classroom.id);
      if (!remoteClassroom || classroom.updatedAt >= remoteClassroom.updatedAt)
        classes.set(classroom.id, classroom);
    }
    const avatars = new Map(remote.data.avatars.map((item) => [item.id, item]));
    local.data.avatars.forEach((avatar) => avatars.set(avatar.id, avatar));
    return cloudSnapshotSchema.parse({
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      data: { classes: [...classes.values()], avatars: [...avatars.values()] },
    });
  }

  private async saveMetadata(
    metadata: Omit<SyncMetadata, "id" | "lastSyncedAt">,
  ) {
    await this.database.metadata.put({
      id: "cloud",
      ...metadata,
      lastSyncedAt: new Date().toISOString(),
    });
  }
}
