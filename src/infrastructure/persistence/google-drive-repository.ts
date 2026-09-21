import {
  classkitManifestV1Schema,
  type ClasskitManifestV1,
} from "@/domain/documents/document.schema";
import type { Classroom } from "@/domain/classroom/classroom.schema";
import { createClassroomDocument } from "@/domain/documents/document.schema";
import { migrateClassroomDocument } from "@/domain/documents/migrations";
import { PersistenceError } from "./persistence-errors";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const MANIFEST_NAME = "classkit-manifest.json";
export const CLOUD_SNAPSHOT_NAME = "classkit.json";

export type DriveFile = { id: string; name: string; version: string };

export class GoogleDriveRepository {
  constructor(private readonly getToken: () => string | undefined) {}

  private async request(url: string, init: RequestInit = {}) {
    const token = this.getToken();
    if (!token)
      throw new PersistenceError("unauthorized", "Connect Google Drive first.");
    if (!navigator.onLine)
      throw new PersistenceError(
        "offline",
        "You are offline. Changes are queued.",
      );

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, ...init.headers },
      });
      if (response.status === 401)
        throw new PersistenceError(
          "unauthorized",
          "Google Drive authorization has expired. Reconnect to continue.",
        );
      if (response.status === 403)
        throw new PersistenceError(
          "forbidden",
          "Google Drive denied this request.",
        );
      if (response.status === 404)
        throw new PersistenceError(
          "not_found",
          "The Google Drive file was not found.",
        );
      if (response.status === 429)
        throw new PersistenceError(
          "rate_limited",
          "Google Drive is temporarily busy.",
        );
      if (!response.ok)
        throw new PersistenceError(
          "unknown",
          `Google Drive request failed (${response.status}).`,
        );
      return response;
    } catch (error) {
      if (error instanceof PersistenceError) throw error;
      if (error instanceof DOMException && error.name === "AbortError")
        throw new PersistenceError(
          "offline",
          "Google Drive did not respond. Changes are queued.",
        );
      throw new PersistenceError(
        "offline",
        "Google Drive is unavailable. Changes are queued.",
        {
          cause: error,
        },
      );
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async findByName(name: string): Promise<DriveFile | undefined> {
    const query = new URLSearchParams({
      q: `name = '${name.replaceAll("'", "\\'")}' and trashed = false`,
      spaces: "appDataFolder",
      fields: "files(id,name,version)",
    });
    const data = (await (
      await this.request(`${DRIVE_API}/files?${query}`)
    ).json()) as {
      files?: DriveFile[];
    };
    return data.files?.[0];
  }

  async listAppDataFiles(): Promise<DriveFile[]> {
    const query = new URLSearchParams({
      q: "trashed = false",
      spaces: "appDataFolder",
      fields: "files(id,name,version)",
      pageSize: "100",
    });
    const data = (await (
      await this.request(`${DRIVE_API}/files?${query}`)
    ).json()) as { files?: DriveFile[] };
    return data.files ?? [];
  }

  async getFile(fileId: string): Promise<DriveFile> {
    return (await (
      await this.request(`${DRIVE_API}/files/${fileId}?fields=id,name,version`)
    ).json()) as DriveFile;
  }

  async upload(
    name: string,
    content: Blob,
    mimeType: string,
    knownFileId?: string,
  ): Promise<DriveFile> {
    const existing = knownFileId
      ? { id: knownFileId }
      : await this.findByName(name);
    const boundary = `classkit-${crypto.randomUUID()}`;
    const metadata = JSON.stringify(
      existing
        ? { name, mimeType }
        : { name, mimeType, parents: ["appDataFolder"] },
    );
    const body = new Blob(
      [
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
        `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
        content,
        `\r\n--${boundary}--`,
      ],
      { type: `multipart/related; boundary=${boundary}` },
    );
    const response = await this.request(
      existing
        ? `${DRIVE_UPLOAD}/files/${existing.id}?uploadType=multipart&fields=id,name,version`
        : `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,version`,
      {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      },
    );
    return (await response.json()) as DriveFile;
  }

  async download(fileId: string): Promise<Blob> {
    return (
      await this.request(`${DRIVE_API}/files/${fileId}?alt=media`)
    ).blob();
  }

  async delete(fileId: string): Promise<void> {
    await this.request(`${DRIVE_API}/files/${fileId}`, { method: "DELETE" });
  }

  async getManifest(): Promise<
    { file: DriveFile; manifest: ClasskitManifestV1 } | undefined
  > {
    const file = await this.findByName(MANIFEST_NAME);
    if (!file) return undefined;
    const raw: unknown = JSON.parse(
      await (await this.download(file.id)).text(),
    );
    return { file, manifest: classkitManifestV1Schema.parse(raw) };
  }

  async getCloudSnapshot(): Promise<
    { file: DriveFile; raw: unknown } | undefined
  > {
    const file = await this.findByName(CLOUD_SNAPSHOT_NAME);
    if (!file) return undefined;
    const raw: unknown = JSON.parse(
      await (await this.download(file.id)).text(),
    );
    return { file, raw };
  }

  async saveCloudSnapshot(data: unknown, fileId?: string): Promise<DriveFile> {
    return this.upload(
      CLOUD_SNAPSHOT_NAME,
      new Blob([JSON.stringify(data)], { type: "application/json" }),
      "application/json",
      fileId,
    );
  }

  async saveManifest(
    manifest: ClasskitManifestV1,
    fileId?: string,
  ): Promise<DriveFile> {
    return this.upload(
      MANIFEST_NAME,
      new Blob([JSON.stringify(classkitManifestV1Schema.parse(manifest))], {
        type: "application/json",
      }),
      "application/json",
      fileId,
    );
  }

  async saveClass(classroom: Classroom, fileId?: string): Promise<DriveFile> {
    return this.upload(
      `classkit-class-${classroom.id}.json`,
      new Blob([JSON.stringify(createClassroomDocument(classroom))], {
        type: "application/json",
      }),
      "application/json",
      fileId,
    );
  }

  async loadClass(fileId: string): Promise<Classroom> {
    const raw: unknown = JSON.parse(await (await this.download(fileId)).text());
    return migrateClassroomDocument(raw).data;
  }

  async saveAvatar(
    avatarId: string,
    image: Blob,
    fileId?: string,
  ): Promise<DriveFile> {
    return this.upload(
      `classkit-avatar-${avatarId}.webp`,
      image,
      "image/webp",
      fileId,
    );
  }
}
