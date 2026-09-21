import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  Grid3X3,
  Maximize,
  Minus,
  Plus,
  Redo2,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { replaceArrangement } from "@/domain/classroom/classroom";
import { classKeys, classQueryOptions } from "@/features/classes/class-queries";
import { EditorCanvas } from "@/features/seating-editor/components/editor-canvas";
import { EditorToolbar } from "@/features/seating-editor/components/editor-toolbar";
import { ObjectInspector } from "@/features/seating-editor/components/object-inspector";
import { StudentRosterPanel } from "@/features/seating-editor/components/student-roster-panel";
import { useEditorShortcuts } from "@/features/seating-editor/hooks/use-editor-shortcuts";
import { updateCanvasCommand } from "@/features/seating-editor/model/object-commands";
import { useEditorStore } from "@/features/seating-editor/store/editor-store";
import { classkitRepository } from "@/infrastructure/persistence/repository";
import { StatusMessage } from "@/shared/components/status-message";

export function SeatingEditorPage() {
  const { classId, arrangementId } = useParams({
    from: "/classes/$classId/arrangements/$arrangementId/edit",
  });
  const queryClient = useQueryClient();
  const classroomQuery = useQuery(classQueryOptions(classId));
  const arrangement = useEditorStore((state) => state.arrangement);
  const historyCount = useEditorStore((state) => state.past.length);
  const futureCount = useEditorStore((state) => state.future.length);
  const initialize = useEditorStore((state) => state.initialize);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const execute = useEditorStore((state) => state.execute);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const selectedStudentId = useEditorStore((state) => state.selectedStudentId);
  const zoom = useEditorStore((state) => state.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const reset = useEditorStore((state) => state.reset);
  const [saveError, setSaveError] = useState<string>();
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const lastSavedSnapshot = useRef<string | undefined>(undefined);
  const saveQueue = useRef(Promise.resolve());
  const sourceArrangement = classroomQuery.data?.arrangements.find(
    ({ id }) => id === arrangementId,
  );

  useEffect(() => {
    if (!sourceArrangement) return;
    const state = useEditorStore.getState();
    if (state.classId !== classId || state.arrangement?.id !== arrangementId) {
      lastSavedSnapshot.current = JSON.stringify(sourceArrangement);
      initialize(classId, sourceArrangement);
    }
  }, [arrangementId, classId, initialize, sourceArrangement]);

  useEffect(() => () => reset(), [reset]);

  const persistArrangement = useCallback(
    (current: NonNullable<typeof arrangement>) => {
      setSaveStatus("saving");
      saveQueue.current = saveQueue.current
        .then(async () => {
          const classroom = await classkitRepository.getClass(classId);
          await classkitRepository.saveClass(
            replaceArrangement(classroom, current),
          );
          await queryClient.invalidateQueries({ queryKey: classKeys.all });
          setSaveError(undefined);
          if (
            JSON.stringify(useEditorStore.getState().arrangement) ===
            JSON.stringify(current)
          ) {
            setSaveStatus("saved");
          }
        })
        .catch((error: unknown) => {
          setSaveStatus("saved");
          setSaveError(
            error instanceof Error
              ? error.message
              : "The arrangement could not be saved.",
          );
        });
    },
    [classId, queryClient],
  );

  useEffect(() => {
    if (!arrangement) return;
    const snapshot = JSON.stringify(arrangement);
    if (snapshot === lastSavedSnapshot.current) return;
    lastSavedSnapshot.current = snapshot;
    persistArrangement(arrangement);
  }, [arrangement, persistArrangement]);

  const saveNow = useCallback(() => {
    const current = useEditorStore.getState().arrangement;
    if (current) persistArrangement(current);
  }, [persistArrangement]);

  useEditorShortcuts(saveNow);

  if (classroomQuery.isPending) {
    return (
      <main className="p-6">
        <StatusMessage title="Loading editor…" />
      </main>
    );
  }
  if (classroomQuery.isError) {
    return (
      <main className="p-6">
        <StatusMessage title="The editor could not be loaded">
          {classroomQuery.error.message}
        </StatusMessage>
      </main>
    );
  }
  if (!sourceArrangement) {
    return (
      <main className="p-6">
        <StatusMessage title="Arrangement not found">
          <Button asChild className="mt-4">
            <Link to="/classes/$classId/arrangements" params={{ classId }}>
              Return to arrangements
            </Link>
          </Button>
        </StatusMessage>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-73px)] bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-5 py-3">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/classes/$classId/arrangements" params={{ classId }}>
              <ArrowLeft aria-hidden="true" className="size-4" /> Arrangements
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold">
              {arrangement?.name ?? sourceArrangement.name}
            </h1>
            <p className="text-xs text-slate-500">
              {saveError
                ? "Local save failed"
                : saveStatus === "saving"
                  ? "Saving locally…"
                  : "Saved locally"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            aria-label="Undo"
            title="Undo"
            disabled={historyCount === 0}
            onClick={undo}
          >
            <Undo2 aria-hidden="true" className="size-4" /> Undo
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Redo"
            title="Redo"
            disabled={futureCount === 0}
            onClick={redo}
          >
            <Redo2 aria-hidden="true" className="size-4" /> Redo
          </Button>
        </div>
      </header>

      {saveError ? (
        <p
          className="mx-auto mt-5 max-w-[1600px] rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          role="alert"
        >
          {saveError}
        </p>
      ) : null}

      <div className="grid min-h-[calc(100vh-73px)] place-items-center bg-slate-100 p-6 lg:hidden">
        <div className="w-full max-w-lg">
          <StatusMessage title="A larger screen is required">
            The seating editor supports desktop viewports at least 1024 pixels
            wide.
          </StatusMessage>
        </div>
      </div>
      <div className="mx-auto hidden max-w-[1600px] grid-cols-[72px_minmax(0,1fr)_288px] gap-4 p-5 lg:grid">
        <div className="row-span-2">
          <EditorToolbar />
        </div>
        <section
          className="h-[min(70vh,800px)] min-h-[620px] overflow-hidden rounded-xl border border-slate-200 bg-slate-200"
          aria-label="Canvas workspace"
        >
          {arrangement ? (
            <EditorCanvas
              arrangement={arrangement}
              students={classroomQuery.data.students}
            />
          ) : null}
        </section>

        <div className="row-span-2 overflow-y-auto">
          {selectedObjectId && !selectedStudentId ? (
            <ObjectInspector />
          ) : (
            <StudentRosterPanel students={classroomQuery.data.students} />
          )}
        </div>

        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={() => setZoom(zoom - 0.1)}
          >
            <Minus aria-hidden="true" className="size-4" />
          </Button>
          <span className="w-14 text-center text-sm font-medium">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Zoom in"
            title="Zoom in"
            onClick={() => setZoom(zoom + 0.1)}
          >
            <Plus aria-hidden="true" className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setZoom(1)}>
            <Maximize aria-hidden="true" className="size-4" /> Fit
          </Button>
          <Button
            variant={arrangement?.canvas.snapToGrid ? "default" : "outline"}
            size="sm"
            aria-pressed={arrangement?.canvas.snapToGrid}
            onClick={() =>
              arrangement &&
              execute(
                updateCanvasCommand({
                  snapToGrid: !arrangement.canvas.snapToGrid,
                }),
              )
            }
          >
            <Grid3X3 aria-hidden="true" className="size-4" /> Grid & snap
          </Button>
        </div>
      </div>
    </main>
  );
}
