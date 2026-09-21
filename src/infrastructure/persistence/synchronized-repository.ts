import Dexie, { type EntityTable } from "dexie";

import type { Classroom } from "@/domain/classroom/classroom.schema";
import type { ClasskitManifestV1 } from "@/domain/documents/document.schema";
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

type SyncRecord = {
  id: string;
  dirty: boolean;
  localUpdatedAt: string;
  remoteFileId?: string;
  remoteVersion?: string;
  deleted?: boolean;
  avatarFileIds: Record<string, string>;
};
type ManifestRecord = { id: "manifest"; fileId?: string; version?: string };

class SyncDatabase extends Dexie {
  records!: EntityTable<SyncRecord, "id">;
  manifest!: EntityTable<ManifestRecord, "id">;
  constructor() {
    super("classkit-sync");
    this.version(1).stores({
      records: "id, dirty, localUpdatedAt",
      manifest: "id",
    });
  }
}

const retryDelay = (attempt: number) =>
  500 * 2 ** attempt + Math.random() * 250;

export class SynchronizedRepository implements ClasskitRepository {
  private readonly database = new SyncDatabase();
  private readonly timers = new Map<string, number>();
  private readonly inFlight = new Map<string, Promise<void>>();
  private readonly listeners = new Set<(status: SyncStatus) => void>();
  private status: SyncStatus = navigator.onLine ? "saved" : "offline";
  private readonly channel = new BroadcastChannel("classkit-sync");

  constructor(
    private readonly local: ClasskitRepository,
    private readonly remote: GoogleDriveRepository,
  ) {
    window.addEventListener("online", () => void this.syncNow());
    window.addEventListener("offline", () => this.setStatus("offline"));
    this.channel.onmessage = (
      event: MessageEvent<{ type: string; classId?: string }>,
    ) => {
      if (event.data.type === "synced") void this.syncNow();
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
    await this.markDirty(classroom.id, classroom.updatedAt);
  }
  async saveClass(
    classroom: Classroom,
    options?: SaveOptions,
  ): Promise<SaveResult> {
    const result = await this.local.saveClass(classroom, options);
    await this.markDirty(classroom.id, result.updatedAt);
    return result;
  }
  async deleteClass(classId: string): Promise<void> {
    await this.local.deleteClass(classId);
    const current = await this.database.records.get(classId);
    if (!current) return;
    await this.database.records.put({
      ...current,
      dirty: true,
      deleted: true,
      localUpdatedAt: new Date().toISOString(),
    });
    this.schedule(classId);
  }
  async getAvatar(
    avatarId: string,
    signal?: AbortSignal,
  ): Promise<Blob | undefined> {
    return this.local.getAvatar(avatarId, signal);
  }
  async saveAvatar(avatarId: string, image: Blob): Promise<void> {
    await this.local.saveAvatar(avatarId, image);
    const classes = await this.local.listClasses();
    for (const summary of classes) {
      const classroom = await this.local.getClass(summary.id);
      if (
        classroom.students.some((student) => student.avatar?.id === avatarId)
      ) {
        await this.markDirty(classroom.id, classroom.updatedAt);
        return;
      }
    }
  }
  async deleteAvatar(avatarId: string): Promise<void> {
    await this.local.deleteAvatar(avatarId);
  }

  private async markDirty(classId: string, localUpdatedAt: string) {
    const current = await this.database.records.get(classId);
    await this.database.records.put({
      id: classId,
      dirty: true,
      localUpdatedAt,
      remoteFileId: current?.remoteFileId,
      remoteVersion: current?.remoteVersion,
      avatarFileIds: current?.avatarFileIds ?? {},
    });
    this.schedule(classId);
  }

  private schedule(classId: string, delay = 1_500) {
    const existing = this.timers.get(classId);
    if (existing) window.clearTimeout(existing);
    this.timers.set(
      classId,
      window.setTimeout(() => void this.syncClass(classId), delay),
    );
  }

  async syncNow(): Promise<void> {
    if (!navigator.onLine) return this.setStatus("offline");
    this.setStatus("saving");
    try {
      await this.hydrateFromDrive();
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
      return;
    }
    await this.queueUnsyncedLocalClasses();
    const records = await this.database.records
      .where("dirty")
      .equals(1)
      .toArray();
    if (!records.length) return this.setStatus("saved");
    await Promise.all(records.map(({ id }) => this.syncClass(id)));
  }

  private syncClass(classId: string, attempt = 0): Promise<void> {
    const existing = this.inFlight.get(classId);
    if (existing) return existing;
    const task = this.syncClassUnlocked(classId, attempt).finally(() => {
      this.inFlight.delete(classId);
    });
    this.inFlight.set(classId, task);
    return task;
  }

  private async syncClassUnlocked(classId: string, attempt = 0): Promise<void> {
    const record = await this.database.records.get(classId);
    if (!record?.dirty) return;
    if (!navigator.onLine) return this.setStatus("offline");
    this.setStatus("saving");
    try {
      if (record.deleted) {
        await this.syncDeletion(record);
        this.setStatus("saved");
        return;
      }
      const classroom = await this.local.getClass(classId);
      if (record.remoteFileId && record.remoteVersion) {
        const remoteMetadata = await this.remote.getFile(record.remoteFileId);
        if (remoteMetadata.version !== record.remoteVersion)
          throw new PersistenceError(
            "conflict",
            "This class changed in another tab. Your local version has been preserved.",
          );
      }
      const remoteFile = await this.remote.saveClass(
        classroom,
        record.remoteFileId,
      );
      await this.syncAvatars(classroom, record);
      const recordWithRemote = {
        ...((await this.database.records.get(classId)) ?? record),
        remoteFileId: remoteFile.id,
        remoteVersion: remoteFile.version,
      };
      await this.database.records.put(recordWithRemote);
      const manifestState = await this.database.manifest.get("manifest");
      const manifest = await this.buildManifest(manifestState?.fileId);
      const manifestFile = await this.remote.saveManifest(
        manifest,
        manifestState?.fileId,
      );
      await this.database.manifest.put({
        id: "manifest",
        fileId: manifestFile.id,
        version: manifestFile.version,
      });
      const latest = await this.database.records.get(classId);
      if (latest?.localUpdatedAt === record.localUpdatedAt) {
        await this.database.records.put({
          ...latest,
          dirty: false,
          remoteFileId: remoteFile.id,
          remoteVersion: remoteFile.version,
        });
      }
      this.channel.postMessage({ type: "synced", classId });
      this.setStatus("saved");
    } catch (error) {
      const persistence = error instanceof PersistenceError ? error : undefined;
      if (persistence?.code === "unauthorized")
        return this.setStatus("reconnect_required");
      if (persistence?.code === "offline") return this.setStatus("offline");
      if (persistence?.code === "conflict") return this.setStatus("conflict");
      if (persistence?.code === "rate_limited" && attempt < 3) {
        this.schedule(classId, retryDelay(attempt));
        return;
      }
      this.setStatus("error");
    }
  }

  private async hydrateFromDrive() {
    const remote = await this.remote.getManifest();
    if (!remote) return;
    await this.database.manifest.put({
      id: "manifest",
      fileId: remote.file.id,
      version: remote.file.version,
    });
    for (const entry of remote.manifest.classes) {
      const record = await this.database.records.get(entry.id);
      if (record?.dirty) continue;
      let local: Classroom | undefined;
      try {
        local = await this.local.getClass(entry.id);
      } catch (error) {
        if (!(error instanceof PersistenceError) || error.code !== "not_found")
          throw error;
      }
      if (local && local.updatedAt >= entry.updatedAt) {
        const remoteFile = await this.remote.getFile(entry.documentFileId);
        await this.database.records.put({
          id: entry.id,
          dirty: false,
          localUpdatedAt: local.updatedAt,
          remoteFileId: entry.documentFileId,
          remoteVersion: remoteFile.version,
          avatarFileIds: record?.avatarFileIds ?? {},
        });
        continue;
      }
      const downloaded = await this.remote.loadClass(entry.documentFileId);
      if (local) await this.local.saveClass(downloaded);
      else await this.local.createClass(downloaded);
      const remoteFile = await this.remote.getFile(entry.documentFileId);
      await this.database.records.put({
        id: entry.id,
        dirty: false,
        localUpdatedAt: downloaded.updatedAt,
        remoteFileId: entry.documentFileId,
        remoteVersion: remoteFile.version,
        avatarFileIds: record?.avatarFileIds ?? {},
      });
    }
  }

  private async queueUnsyncedLocalClasses() {
    const summaries = await this.local.listClasses();
    for (const summary of summaries) {
      const record = await this.database.records.get(summary.id);
      if (!record) await this.markDirty(summary.id, summary.updatedAt);
    }
  }

  private async syncDeletion(record: SyncRecord) {
    if (record.remoteFileId) await this.remote.delete(record.remoteFileId);
    const manifestState = await this.database.manifest.get("manifest");
    const remote = await this.remote.getManifest();
    if (remote) {
      await this.remote.saveManifest(
        {
          ...remote.manifest,
          classes: remote.manifest.classes.filter(({ id }) => id !== record.id),
          updatedAt: new Date().toISOString(),
        },
        manifestState?.fileId ?? remote.file.id,
      );
    }
    await this.database.records.delete(record.id);
    this.channel.postMessage({ type: "synced", classId: record.id });
  }

  private async syncAvatars(classroom: Classroom, record: SyncRecord) {
    const avatarFileIds = { ...record.avatarFileIds };
    for (const student of classroom.students) {
      if (!student.avatar || avatarFileIds[student.avatar.id]) continue;
      const image = await this.local.getAvatar(student.avatar.id);
      if (!image) continue;
      const file = await this.remote.saveAvatar(student.avatar.id, image);
      avatarFileIds[student.avatar.id] = file.id;
    }
    const current = await this.database.records.get(record.id);
    if (current) await this.database.records.put({ ...current, avatarFileIds });
  }

  private async buildManifest(fileId?: string): Promise<ClasskitManifestV1> {
    const remote = fileId
      ? await this.remote.getManifest().catch(() => undefined)
      : undefined;
    const records = await this.database.records.toArray();
    const classes = await Promise.all(
      records.map(async (record) => {
        const classroom = await this.local.getClass(record.id);
        return record.remoteFileId
          ? {
              id: classroom.id,
              name: classroom.name,
              documentFileId: record.remoteFileId,
              updatedAt: classroom.updatedAt,
            }
          : undefined;
      }),
    );
    const localEntries = classes.filter(
      (entry): entry is NonNullable<typeof entry> => Boolean(entry),
    );
    const byId = new Map(
      remote?.manifest.classes.map((entry) => [entry.id, entry]) ?? [],
    );
    localEntries.forEach((entry) => byId.set(entry.id, entry));
    return {
      schemaVersion: 1,
      classes: [...byId.values()],
      updatedAt: new Date().toISOString(),
    };
  }
}
