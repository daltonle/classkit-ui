import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, LayoutGrid, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { classQueryOptions } from "@/features/classes/class-queries";
import { PageHeader } from "@/shared/components/page-header";
import { StatusMessage } from "@/shared/components/status-message";

export function ClassOverviewPage() {
  const { classId } = useParams({ from: "/classes/$classId" });
  const classroomQuery = useQuery(classQueryOptions(classId));

  if (classroomQuery.isPending) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <StatusMessage title="Loading class…" />
      </main>
    );
  }
  if (classroomQuery.isError) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <StatusMessage title="This class could not be loaded">
          {classroomQuery.error.message}
        </StatusMessage>
      </main>
    );
  }

  const classroom = classroomQuery.data;
  const activeArrangement = classroom.arrangements.find(
    ({ id }) => id === classroom.activeArrangementId,
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Button asChild variant="ghost" className="mb-5 -ml-3">
        <Link to="/classes">
          <ArrowLeft aria-hidden="true" className="size-4" /> Back to classes
        </Link>
      </Button>
      <PageHeader
        eyebrow={
          [
            classroom.schoolYear,
            classroom.grade !== undefined
              ? `Grade ${classroom.grade}`
              : undefined,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        title={classroom.name}
        description="Manage this class roster and its classroom arrangements."
      />
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Link
          to="/classes/$classId/students"
          params={{ classId }}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-sky-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
        >
          <Users aria-hidden="true" className="size-7 text-sky-700" />
          <h2 className="mt-4 text-xl font-semibold">Student roster</h2>
          <p className="mt-2 text-slate-600">
            {classroom.students.length}{" "}
            {classroom.students.length === 1 ? "student" : "students"}
          </p>
        </Link>
        <Link
          to="/classes/$classId/arrangements"
          params={{ classId }}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-sky-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
        >
          <LayoutGrid aria-hidden="true" className="size-7 text-slate-500" />
          <h2 className="mt-4 text-xl font-semibold">Arrangements</h2>
          <p className="mt-2 text-slate-600">
            {activeArrangement
              ? `Active: ${activeArrangement.name}`
              : `${classroom.arrangements.length} saved arrangements`}
          </p>
        </Link>
      </div>
    </main>
  );
}
