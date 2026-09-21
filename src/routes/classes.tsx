import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { updateClassroomDetails } from "@/domain/classroom/classroom";
import { ClassForm, type ClassFormValues } from "@/features/classes/class-form";
import {
  classKeys,
  classesQueryOptions,
} from "@/features/classes/class-queries";
import { classkitRepository } from "@/infrastructure/persistence/repository";
import { PageHeader } from "@/shared/components/page-header";
import { StatusMessage } from "@/shared/components/status-message";

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ClassesPage() {
  const queryClient = useQueryClient();
  const classesQuery = useQuery(classesQueryOptions());
  const [editingClassId, setEditingClassId] = useState<string>();
  const [actionError, setActionError] = useState<string>();

  const deleteMutation = useMutation({
    mutationFn: (classId: string) => classkitRepository.deleteClass(classId),
    onSuccess: async () => {
      setActionError(undefined);
      await queryClient.invalidateQueries({ queryKey: classKeys.all });
    },
    onError: (error) => setActionError(error.message),
  });

  async function renameClass(classId: string, values: ClassFormValues) {
    const classroom = await classkitRepository.getClass(classId);
    const updated = updateClassroomDetails(classroom, values);
    await classkitRepository.saveClass(updated);
    setEditingClassId(undefined);
    await queryClient.invalidateQueries({ queryKey: classKeys.all });
    await queryClient.invalidateQueries({
      queryKey: classKeys.detail(classId),
    });
  }

  function requestDelete(classId: string, className: string) {
    if (
      window.confirm(
        `Permanently delete ${className}? This removes its locally saved roster and arrangements and cannot be undone.`,
      )
    ) {
      deleteMutation.mutate(classId);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        title="Classes"
        description="Create a workspace for each class and keep its roster in one place."
        actions={
          <Button asChild>
            <Link to="/classes/new">
              <Plus aria-hidden="true" className="size-4" />
              New class
            </Link>
          </Button>
        }
      />

      {actionError ? (
        <p
          className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}

      <div className="mt-8">
        {classesQuery.isPending ? (
          <StatusMessage title="Loading your classes…" />
        ) : classesQuery.isError ? (
          <StatusMessage title="Classes could not be loaded">
            <p>{classesQuery.error.message}</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => void classesQuery.refetch()}
            >
              Try again
            </Button>
          </StatusMessage>
        ) : classesQuery.data.length === 0 ? (
          <StatusMessage title="No classes yet">
            <p>Create your first class to start building its roster.</p>
            <Button asChild className="mt-5">
              <Link to="/classes/new">Create a class</Link>
            </Button>
          </StatusMessage>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {classesQuery.data.map((classroom) => (
              <article
                key={classroom.id}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                {editingClassId === classroom.id ? (
                  <ClassForm
                    initialValues={{
                      name: classroom.name,
                      schoolYear: classroom.schoolYear ?? "",
                      grade: classroom.grade,
                    }}
                    submitLabel="Save class"
                    onSubmit={(values) => renameClass(classroom.id, values)}
                    onCancel={() => setEditingClassId(undefined)}
                  />
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-semibold">
                          <Link
                            className="hover:text-sky-700"
                            to="/classes/$classId"
                            params={{ classId: classroom.id }}
                          >
                            {classroom.name}
                          </Link>
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Updated {formatUpdatedAt(classroom.updatedAt)}
                        </p>
                      </div>
                      <BookOpen
                        aria-hidden="true"
                        className="size-6 text-sky-700"
                      />
                    </div>
                    <div className="mt-5 flex items-center gap-2 text-sm text-slate-600">
                      <Users aria-hidden="true" className="size-4" />
                      {classroom.studentCount}{" "}
                      {classroom.studentCount === 1 ? "student" : "students"}
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {classroom.activeArrangementName
                        ? `Active arrangement: ${classroom.activeArrangementName}`
                        : "No active arrangement"}
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                      <Button asChild size="sm">
                        <Link
                          to="/classes/$classId"
                          params={{ classId: classroom.id }}
                        >
                          Open
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingClassId(classroom.id)}
                      >
                        <Pencil aria-hidden="true" className="size-3.5" />{" "}
                        Rename
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-700 hover:bg-rose-50"
                        onClick={() =>
                          requestDelete(classroom.id, classroom.name)
                        }
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 aria-hidden="true" className="size-3.5" />{" "}
                        Delete
                      </Button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
