import { Link, Outlet } from "@tanstack/react-router";
import { useState, useSyncExternalStore } from "react";

import { googleAuth } from "@/infrastructure/auth/google-auth";
import {
  synchronizedRepository,
  type SyncStatus,
} from "@/infrastructure/persistence/repository";
import { parseEnvironment } from "@/shared/lib/environment";

const syncLabels: Record<SyncStatus, string> = {
  saved: "Saved locally",
  saving: "Saving to Drive…",
  offline: "Offline — changes queued",
  reconnect_required: "Reconnect Drive",
  conflict: "Sync conflict — local copy preserved",
  error: "Sync error — changes queued",
};

export function App() {
  parseEnvironment(import.meta.env);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncStatus = useSyncExternalStore(
    synchronizedRepository.subscribe,
    synchronizedRepository.getStatus,
    synchronizedRepository.getStatus,
  );
  const hasDriveAccess = useSyncExternalStore(
    googleAuth.subscribe,
    googleAuth.hasDriveAccess,
    googleAuth.hasDriveAccess,
  );
  const driveConnected = hasDriveAccess && syncStatus !== "reconnect_required";
  const syncStatusLabel =
    syncStatus === "saved" && driveConnected
      ? "Drive synchronized"
      : syncLabels[syncStatus];

  async function connectAndSync() {
    setIsConnectingDrive(true);
    try {
      if (!hasDriveAccess || syncStatus === "reconnect_required")
        await googleAuth.authorizeDrive();
      await synchronizedRepository.syncNow();
    } catch {
      synchronizedRepository.requireReconnect();
    } finally {
      setIsConnectingDrive(false);
    }
  }

  async function syncOnDemand() {
    setIsSyncing(true);
    try {
      await synchronizedRepository.syncNow();
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link className="text-xl font-bold tracking-tight" to="/">
            Classkit
          </Link>
          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-2"
          >
            <span
              className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700"
              role="status"
            >
              {driveConnected
                ? "Google Drive connected"
                : "Google Drive not connected"}
            </span>
            {!driveConnected ? (
              <button
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isConnectingDrive}
                onClick={() => void connectAndSync()}
                type="button"
              >
                {isConnectingDrive
                  ? "Connecting Drive…"
                  : hasDriveAccess
                    ? "Reconnect Drive"
                    : "Connect Drive"}
              </button>
            ) : null}
            <button
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!driveConnected || isSyncing}
              onClick={() => void syncOnDemand()}
              type="button"
            >
              {isSyncing ? "Syncing…" : "Sync now"}
            </button>
            <span className="text-sm text-slate-600">{syncStatusLabel}</span>
            <Link
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
              to="/classes"
            >
              Classes
            </Link>
            <Link
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
              to="/settings/data-backups"
            >
              Settings
            </Link>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
