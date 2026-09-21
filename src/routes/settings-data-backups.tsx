import { Link } from "@tanstack/react-router";
import { Cloud, DatabaseBackup, Settings2, UserRound } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { googleAuth } from "@/infrastructure/auth/google-auth";
import { synchronizedRepository } from "@/infrastructure/persistence/repository";

const confirmationText = "DELETE";

export function SettingsDataBackupsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<string>();
  const hasDriveAccess = useSyncExternalStore(
    googleAuth.subscribe,
    googleAuth.hasDriveAccess,
    googleAuth.hasDriveAccess,
  );

  async function connectDrive() {
    setMessage(undefined);
    try {
      await googleAuth.authorizeDrive();
      await synchronizedRepository.syncNow();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Google Drive could not be connected.",
      );
    }
  }

  async function deleteBackups() {
    setIsDeleting(true);
    try {
      const count = await synchronizedRepository.deleteDriveBackups();
      await googleAuth.disconnect();
      setMessage(
        `${count} Drive ${count === 1 ? "file was" : "files were"} permanently deleted. Local Classkit data was kept.`,
      );
      setDialogOpen(false);
      setConfirmation("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The Drive backup could not be deleted.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-6 py-10 md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="px-3 py-2 text-sm font-semibold">Settings</p>
        <nav aria-label="Settings navigation" className="space-y-1">
          <span className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-500">
            <UserRound aria-hidden="true" className="size-4" /> Account settings{" "}
            <span className="ml-auto text-xs">Soon</span>
          </span>
          <Link
            activeProps={{ className: "bg-sky-50 text-sky-900" }}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            to="/settings/data-backups"
          >
            <DatabaseBackup aria-hidden="true" className="size-4" /> Data &
            backups
          </Link>
        </nav>
      </aside>

      <section>
        <div className="flex items-start gap-3">
          <Settings2 aria-hidden="true" className="mt-1 size-6 text-sky-700" />
          <div>
            <p className="text-sm font-semibold text-sky-700">Settings</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Data & backups
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              Classkit works from local browser storage first. Google Drive
              keeps a private, portable backup when connected.
            </p>
          </div>
        </div>

        {message ? (
          <p
            className="mt-6 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700"
            role="status"
          >
            {message}
          </p>
        ) : null}

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h2 className="font-semibold">Google Drive backup</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {hasDriveAccess
                  ? "Connected. Backups are stored in Google Drive's private app-data folder."
                  : "Not connected. Local data stays available in this browser."}
              </p>
            </div>
            {!hasDriveAccess ? (
              <Button onClick={() => void connectDrive()} variant="outline">
                <Cloud aria-hidden="true" className="size-4" /> Connect Drive
              </Button>
            ) : null}
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-6">
          <h2 className="font-semibold text-rose-950">Delete Drive backups</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-rose-900">
            Permanently deletes every Classkit file in the hidden Google Drive
            app-data folder, including previous-format backup files. Your local
            browser data is not deleted.
          </p>
          <Button
            className="mt-4"
            disabled={!hasDriveAccess}
            onClick={() => setDialogOpen(true)}
            variant="destructive"
          >
            Delete all Drive backups
          </Button>
          {!hasDriveAccess ? (
            <p className="mt-2 text-sm text-rose-800">
              Connect Google Drive before deleting backups.
            </p>
          ) : null}
        </section>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete all Drive backups?</DialogTitle>
            <DialogDescription>
              This permanently deletes every file Classkit can access in its
              private Google Drive app-data folder. It does not delete local
              browser data.
            </DialogDescription>
          </DialogHeader>
          <label className="mt-5 block text-sm font-medium">
            Type {confirmationText} to confirm
            <Input
              className="mt-2"
              onChange={(event) => setConfirmation(event.target.value)}
              value={confirmation}
            />
          </label>
          <div className="mt-6 flex justify-end gap-3">
            <Button onClick={() => setDialogOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button
              disabled={confirmation !== confirmationText || isDeleting}
              onClick={() => void deleteBackups()}
              variant="destructive"
            >
              {isDeleting ? "Deleting…" : "Delete backups"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
