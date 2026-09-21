import { environment } from "@/shared/lib/environment";
import type { AuthState, GoogleIdentityApi, GoogleUser } from "./google-types";

const GIS_URL = "https://accounts.google.com/gsi/client";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

function decodeJwt(credential: string): GoogleUser {
  const payload = credential.split(".")[1];
  if (!payload)
    throw new Error("Google returned an invalid identity credential.");
  const decoded = JSON.parse(
    atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
  ) as Record<string, unknown>;
  if (typeof decoded.sub !== "string" || typeof decoded.email !== "string")
    throw new Error("Google identity data is incomplete.");
  return {
    id: decoded.sub,
    email: decoded.email,
    name: typeof decoded.name === "string" ? decoded.name : decoded.email,
    ...(typeof decoded.picture === "string"
      ? { picture: decoded.picture }
      : {}),
  };
}

export class GoogleAuth {
  private accessToken?: string;
  private identityInitialized = false;
  private readonly listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  hasDriveAccess = () => Boolean(this.accessToken);

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  async load(): Promise<GoogleIdentityApi> {
    if (window.google) return window.google;
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        `script[src="${GIS_URL}"]`,
      );
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Google Identity Services could not load.")),
          { once: true },
        );
        return;
      }
      const script = document.createElement("script");
      script.src = GIS_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Google Identity Services could not load."));
      document.head.append(script);
    });
    if (!window.google)
      throw new Error(
        "Google Identity Services was unavailable after loading.",
      );
    return window.google;
  }

  async signIn(): Promise<GoogleUser> {
    const google = await this.load();
    return new Promise<GoogleUser>((resolve, reject) => {
      google.accounts.id.initialize({
        client_id: environment.VITE_GOOGLE_CLIENT_ID,
        callback: ({ credential }) => {
          try {
            resolve(decodeJwt(credential));
          } catch (error) {
            reject(
              error instanceof Error
                ? error
                : new Error("Google identity data could not be read."),
            );
          }
        },
      });
      this.identityInitialized = true;
      google.accounts.id.prompt();
    });
  }

  async authorizeDrive(): Promise<string> {
    const google = await this.load();
    return new Promise<string>((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: environment.VITE_GOOGLE_CLIENT_ID,
        scope: DRIVE_SCOPE,
        callback: (response) => {
          if (!response.access_token) {
            reject(
              new Error(
                response.error_description ??
                  response.error ??
                  "Drive authorization was not granted.",
              ),
            );
            return;
          }
          this.accessToken = response.access_token;
          this.notify();
          resolve(response.access_token);
        },
        error_callback: (error) =>
          reject(
            new Error(error.message ?? "Drive authorization was cancelled."),
          ),
      });
      client.requestAccessToken({ prompt: "consent" });
    });
  }

  getAccessToken() {
    return this.accessToken;
  }

  async disconnect(user?: GoogleUser) {
    const google = await this.load();
    const token = this.accessToken;
    this.accessToken = undefined;
    this.notify();
    if (token) google.accounts.oauth2.revoke(token);
    if (user && this.identityInitialized) google.accounts.id.revoke(user.email);
  }

  toState(user?: GoogleUser): AuthState {
    if (!user) return { status: "signed_out" };
    return {
      status: "signed_in",
      user,
      drive: this.accessToken ? "authorized" : "not_authorized",
    };
  }
}

export const googleAuth = new GoogleAuth();
