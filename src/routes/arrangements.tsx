import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Copy,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addArrangement,
  deleteArrangement,
  renameArrangement,
  setActiveArrangement,
} from "@/domain/classroom/classroom";
import {
  createArrangement,
  duplicateArrangement,
} from "@/domain/seating-layout/seating-layout";
import type { Classroom } from "@/domain/classroom/classroom.schema";
import { classKeys, classQueryOptions } from "@/features/classes/class-queries";
import { classkitRepository } from "@/infrastructure/persistence/repository";
import { PageHeader } from "@/shared/components/page-header";
import { StatusMessage } from "@/shared/components/status-message";

type CreateMode = { type: "blank" } | { type: "duplicate"; sourceId?: string };

function domainErrorMessage(error: unknown) {
  if (
    error instanceof Error &&
    error.message.includes("Arrangement names must be unique")
  ) {
    return "Use a unique arrangement name for this class.";
  }
  return error instanceof Error
    ? error.message
    : "The arrangement could not be saved.";
}

export function ArrangementsPage() {
  const { classId } = useParams({ from: "/classes/$classId/arrangements" });
  const queryClient = useQueryClient();
  const classroomQuery = useQuery(classQueryOptions(classId));
  const [createMode, setCreateMode] = useState<CreateMode>();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  async function persist(classroom: Classroom) {
    setIsSaving(true);
    try {
      await classkitRepository.saveClass(classroom);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: classKeys.detail(classId) }),
        queryClient.invalidateQueries({ queryKey: classKeys.all }),
      ]);
      setError(undefined);
    } catch (caught) {
      setError(domainErrorMessage(caught));
      throw caught;
    } finally {
      setIsSaving(false);
    }
  }

  function beginCreate(mode: CreateMode) {
    setCreateMode(mode);
    setName("");
    setError(undefined);
  }

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classroomQuery.data || !createMode) return;
    try {
      const arrangement =
        createMode.type === "blank"
          ? createArrangement(name)
          : duplicateArrangement(
              classroomQuery.data.arrangements.find(
                ({ id }) => id === createMode.sourceId,
              ) ??
                (() => {
                  throw new Error("Choose an arrangement to duplicate.");
                })(),
              name,
            );
      await persist(addArrangement(classroomQuery.data, arrangement));
      setCreateMode(undefined);
      setName("");
    } catch (caught) {
      setError(domainErrorMessage(caught));
    }
  }

  async function submitRename(arrangementId: string) {
    if (!classroomQuery.data) return;
    try {
      await persist(
        renameArrangement(classroomQuery.data, arrangementId, editingName),
      );
      setEditingId(undefined);
    } catch {
      // The shared persistence helper displays the error.
    }
  }

  async function makeActive(arrangementId: string) {
    if (!classroomQuery.data) return;
    try {
      await persist(setActiveArrangement(classroomQuery.data, arrangementId));
    } catch {
      // The shared persistence helper displays the error.
    }
  }

  async function requestDelete(arrangementId: string, arrangementName: string) {
    if (!classroomQuery.data) return;
    const isActive = classroomQuery.data.activeArrangementId === arrangementId;
    const prompt = isActive
      ? `${arrangementName} is active. Delete it and leave this class without an active arrangement?`
      : `Permanently delete ${arrangementName}?`;
    if (!window.confirm(prompt)) return;
    try {
      await persist(deleteArrangement(classroomQuery.data, arrangementId));
    } catch {
      // The shared persistence helper displays the error.
    }
  }

  if (classroomQuery.isPending) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <StatusMessage title="Loading arrangements…" />
      </main>
    );
  }
  if (classroomQuery.isError) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <StatusMessage title="Arrangements could not be loaded">
          {classroomQuery.error.message}
        </StatusMessage>
      </main>
    );
  }

  const classroom = classroomQuery.data;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Button asChild variant="ghost" className="mb-5 -ml-3">
        <Link to="/classes/$classId" params={{ classId }}>
          <ArrowLeft aria-hidden="true" className="size-4" /> Back to{" "}
          {classroom.name}
        </Link>
      </Button>
      <PageHeader
        eyebrow={classroom.name}
        title="Seating arrangements"
        description="Create different room layouts and choose the one currently in use."
      />

      <section
        className="mt-8 grid gap-5 md:grid-cols-2"
        aria-label="Create an arrangement"
      >
        <button
          type="button"
          className="rounded-xl border border-sky-200 bg-sky-50 p-6 text-left transition hover:border-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
          onClick={() => beginCreate({ type: "blank" })}
        >
          <Plus aria-hidden="true" className="size-7 text-sky-700" />
          <span className="mt-4 block text-lg font-semibold">
            Start with a blank canvas
          </span>
          <span className="mt-2 block text-sm text-slate-600">
            Build a completely new classroom layout.
          </span>
        </button>
        <button
          type="button"
          className="rounded-xl border border-violet-200 bg-violet-50 p-6 text-left transition hover:border-violet-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() =>
            beginCreate({
              type: "duplicate",
              sourceId: classroom.arrangements[0]?.id,
            })
          }
          disabled={classroom.arrangements.length === 0}
        >
          <Copy aria-hidden="true" className="size-7 text-violet-700" />
          <span className="mt-4 block text-lg font-semibold">
            Duplicate an arrangement
          </span>
          <span className="mt-2 block text-sm text-slate-600">
            {classroom.arrangements.length === 0
              ? "Create an arrangement first."
              : "Use an existing layout as your starting point."}
          </span>
        </button>
      </section>

      <Dialog
        open={Boolean(createMode)}
        onOpenChange={(open) => {
          if (!open) {
            setCreateMode(undefined);
            setError(undefined);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {createMode?.type === "duplicate"
                ? "Duplicate arrangement"
                : "New blank arrangement"}
            </DialogTitle>
            <DialogDescription>
              {createMode?.type === "duplicate"
                ? "Choose an existing layout and give the independent copy a new name."
                : "Name the arrangement now. You can build its layout in the editor."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="mt-6 space-y-5"
            onSubmit={(event) => void submitCreate(event)}
          >
            {createMode?.type === "duplicate" ? (
              <div className="space-y-2">
                <Label htmlFor="source-arrangement">
                  Arrangement to duplicate
                </Label>
                <select
                  id="source-arrangement"
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus-visible:border-sky-600 focus-visible:ring-2 focus-visible:ring-sky-600/20"
                  value={createMode.sourceId}
                  onChange={(event) =>
                    setCreateMode({
                      type: "duplicate",
                      sourceId: event.target.value,
                    })
                  }
                >
                  {classroom.arrangements.map((arrangement) => (
                    <option key={arrangement.id} value={arrangement.id}>
                      {arrangement.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="arrangement-name">Arrangement name</Label>
              <Input
                id="arrangement-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            {error ? (
              <p
                className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateMode(undefined);
                  setError(undefined);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving…" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {error && !createMode ? (
        <p
          className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <section className="mt-10" aria-labelledby="arrangement-list-heading">
        <h2 id="arrangement-list-heading" className="text-xl font-semibold">
          Saved arrangements
        </h2>
        {classroom.arrangements.length === 0 ? (
          <div className="mt-5">
            <StatusMessage title="No arrangements yet">
              Start with a blank canvas to create the first layout.
            </StatusMessage>
          </div>
        ) : (
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {classroom.arrangements.map((arrangement) => {
              const isActive = classroom.activeArrangementId === arrangement.id;
              return (
                <article
                  key={arrangement.id}
                  className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  {editingId === arrangement.id ? (
                    <form
                      className="flex gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submitRename(arrangement.id);
                      }}
                    >
                      <Input
                        aria-label="Arrangement name"
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        required
                      />
                      <Button type="submit" size="sm" disabled={isSaving}>
                        <Check aria-hidden="true" className="size-4" /> Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(undefined)}
                      >
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold">
                            {arrangement.name}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {arrangement.objects.length} objects ·{" "}
                            {arrangement.studentPlacements.length} students
                            placed
                          </p>
                        </div>
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                            <Star aria-hidden="true" className="size-3" />{" "}
                            Active
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                        <Button asChild size="sm">
                          <Link
                            to="/classes/$classId/arrangements/$arrangementId/edit"
                            params={{ classId, arrangementId: arrangement.id }}
                          >
                            Open editor
                          </Link>
                        </Button>
                        {!isActive ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void makeActive(arrangement.id)}
                          >
                            Set active
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(arrangement.id);
                            setEditingName(arrangement.name);
                          }}
                        >
                          <Pencil aria-hidden="true" className="size-3.5" />{" "}
                          Rename
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setCreateMode({
                              type: "duplicate",
                              sourceId: arrangement.id,
                            });
                            setName(`${arrangement.name} copy`);
                          }}
                        >
                          <Copy aria-hidden="true" className="size-3.5" />{" "}
                          Duplicate
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-700 hover:bg-rose-50"
                          onClick={() =>
                            void requestDelete(arrangement.id, arrangement.name)
                          }
                        >
                          <Trash2 aria-hidden="true" className="size-3.5" />{" "}
                          Delete
                        </Button>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
