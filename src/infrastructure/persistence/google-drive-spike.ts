import { PersistenceError } from "./persistence-errors";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";

export class GoogleDriveSpike {
  constructor(private readonly getToken: () => string | undefined) {}

  private async request(url: string, init: RequestInit = {}) {
    const token = this.getToken();
    if (!token)
      throw new PersistenceError("unauthorized", "Connect Google Drive first.");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, ...init.headers },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new PersistenceError(
          "unknown",
          "Google Drive did not respond within 30 seconds. Try the upload again.",
        );
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
    if (response.status === 401)
      throw new PersistenceError(
        "unauthorized",
        "Google Drive authorization has expired. Reconnect to continue.",
      );
    if (!response.ok)
      throw new PersistenceError(
        "unknown",
        `Google Drive request failed (${response.status}).`,
      );
    return response;
  }

  async findByName(
    name: string,
  ): Promise<{ id: string; name: string } | undefined> {
    const query = new URLSearchParams({
      q: `name = '${name.replaceAll("'", "\\'")}' and trashed = false`,
      spaces: "appDataFolder",
      fields: "files(id,name)",
    });
    const response = await this.request(`${DRIVE_API}/files?${query}`);
    const data = (await response.json()) as {
      files?: Array<{ id: string; name: string }>;
    };
    return data.files?.[0];
  }

  async upload(name: string, content: Blob, mimeType: string): Promise<string> {
    const existing = await this.findByName(name);
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
    const url = existing
      ? `${DRIVE_UPLOAD}/files/${existing.id}?uploadType=multipart`
      : `${DRIVE_UPLOAD}/files?uploadType=multipart`;
    const response = await this.request(url, {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    return ((await response.json()) as { id: string }).id;
  }

  async download(fileId: string): Promise<Blob> {
    return (
      await this.request(`${DRIVE_API}/files/${fileId}?alt=media`)
    ).blob();
  }

  async delete(fileId: string): Promise<void> {
    await this.request(`${DRIVE_API}/files/${fileId}`, { method: "DELETE" });
  }

  async verifyJsonLifecycle(): Promise<void> {
    const name = "classkit-spike.json";
    const first = await this.upload(
      name,
      new Blob([JSON.stringify({ stage: "created" })], {
        type: "application/json",
      }),
      "application/json",
    );
    const second = await this.upload(
      name,
      new Blob([JSON.stringify({ stage: "updated" })], {
        type: "application/json",
      }),
      "application/json",
    );
    const text = await (await this.download(second)).text();
    const parsed: unknown = JSON.parse(text);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("stage" in parsed) ||
      parsed.stage !== "updated"
    )
      throw new Error("Drive returned unexpected spike content.");
    await this.delete(second || first);
  }
}
