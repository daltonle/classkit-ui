import { Link } from "@tanstack/react-router";
import { Cloud, LogIn, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { googleAuth } from "@/infrastructure/auth/google-auth";
import type { GoogleUser } from "@/infrastructure/auth/google-types";
import { GoogleDriveSpike } from "@/infrastructure/persistence/google-drive-spike";
import { processAvatarImage } from "@/infrastructure/images/avatar-processing";

const driveSpike = new GoogleDriveSpike(() => googleAuth.getAccessToken());

export function GoogleDriveSpikePage() {
  const [user, setUser] = useState<GoogleUser>();
  const [message, setMessage] = useState(
    "Connect a Google account to begin the Drive technical spike.",
  );
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The Google operation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p className="text-sm font-semibold text-sky-700">Technical spike</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        Google Drive connection
      </h1>
      <p className="mt-3 text-slate-600">
        Classkit requests access only to its private application-data folder. It
        cannot browse your other Google Drive files.
      </p>
      <section className="mt-8 space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p
          className="rounded-md bg-slate-50 p-3 text-sm text-slate-700"
          role="status"
        >
          {message}
        </p>
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const signedInUser = await googleAuth.signIn();
              setUser(signedInUser);
              setMessage(`Signed in as ${signedInUser.email}.`);
            })
          }
        >
          <LogIn aria-hidden="true" className="size-4" /> Sign in with Google
        </Button>
        <Button
          disabled={busy || !user}
          variant="outline"
          onClick={() =>
            void run(async () => {
              await googleAuth.authorizeDrive();
              setMessage(
                "Private Drive storage is authorized for this browser session.",
              );
            })
          }
        >
          <ShieldCheck aria-hidden="true" className="size-4" /> Allow private
          Drive storage
        </Button>
        <Button
          disabled={busy || !googleAuth.getAccessToken()}
          variant="outline"
          onClick={() =>
            void run(async () => {
              await driveSpike.verifyJsonLifecycle();
              setMessage(
                "JSON create, read, update, and delete completed successfully.",
              );
            })
          }
        >
          <Cloud aria-hidden="true" className="size-4" /> Verify JSON lifecycle
        </Button>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">
            Verify avatar transfer
          </span>
          <input
            type="file"
            accept="image/*"
            disabled={busy || !googleAuth.getAccessToken()}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void run(async () => {
                const image = await processAvatarImage(file);
                const fileId = await driveSpike.upload(
                  `avatar-spike-${crypto.randomUUID()}.webp`,
                  image,
                  "image/webp",
                );
                const downloaded = await driveSpike.download(fileId);
                await driveSpike.delete(fileId);
                if (!downloaded.size)
                  throw new Error("Downloaded avatar was empty.");
                setMessage(
                  "Avatar upload, download, and delete completed successfully.",
                );
              });
            }}
          />
        </label>
        <Button asChild variant="ghost">
          <Link to="/">Return home</Link>
        </Button>
      </section>
    </main>
  );
}
