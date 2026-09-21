import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addStudent,
  deleteStudent,
  getStudentReferences,
  replaceStudent,
} from "@/domain/classroom/classroom";
import {
  compareStudents,
  createStudent,
  updateStudent,
} from "@/domain/student/student";
import type { Student } from "@/domain/student/student.schema";
import { classKeys, classQueryOptions } from "@/features/classes/class-queries";
import { StudentAvatar } from "@/features/students/student-avatar";
import {
  StudentForm,
  type StudentFormValues,
} from "@/features/students/student-form";
import { classkitRepository } from "@/infrastructure/persistence/repository";
import { processAvatarImage } from "@/infrastructure/images/avatar-processing";
import { PageHeader } from "@/shared/components/page-header";
import { StatusMessage } from "@/shared/components/status-message";

type FormMode = { type: "add" } | { type: "edit"; student: Student };

export function StudentsPage() {
  const { classId } = useParams({ from: "/classes/$classId/students" });
  const queryClient = useQueryClient();
  const classroomQuery = useQuery(classQueryOptions(classId));
  const [search, setSearch] = useState("");
  const [formMode, setFormMode] = useState<FormMode>();
  const [actionError, setActionError] = useState<string>();
  const [blockedStudentId, setBlockedStudentId] = useState<string>();

  const students = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return [...(classroomQuery.data?.students ?? [])]
      .sort(compareStudents)
      .filter(
        ({ firstName, lastName }) =>
          !normalizedSearch ||
          firstName.toLocaleLowerCase().includes(normalizedSearch) ||
          lastName.toLocaleLowerCase().includes(normalizedSearch),
      );
  }, [classroomQuery.data?.students, search]);

  async function persistClassroom(
    classroom: NonNullable<typeof classroomQuery.data>,
  ) {
    await classkitRepository.saveClass(classroom);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: classKeys.detail(classId) }),
      queryClient.invalidateQueries({ queryKey: classKeys.all }),
    ]);
  }

  async function saveStudent(values: StudentFormValues, avatarFile?: File) {
    if (!classroomQuery.data) return;
    let student =
      formMode?.type === "edit"
        ? updateStudent(formMode.student, values)
        : createStudent(values);
    const previousAvatarId = student.avatar?.id;
    let newAvatarId: string | undefined;

    if (avatarFile) {
      const processedImage = await processAvatarImage(avatarFile);
      newAvatarId = crypto.randomUUID();
      await classkitRepository.saveAvatar(newAvatarId, processedImage);
      student = {
        ...student,
        avatar: { id: newAvatarId, mimeType: "image/webp" },
      };
    }

    const updatedClassroom =
      formMode?.type === "edit"
        ? replaceStudent(classroomQuery.data, student)
        : addStudent(classroomQuery.data, student);
    try {
      await persistClassroom(updatedClassroom);
    } catch (error) {
      if (newAvatarId) await classkitRepository.deleteAvatar(newAvatarId);
      throw error;
    }
    if (newAvatarId && previousAvatarId) {
      await classkitRepository.deleteAvatar(previousAvatarId);
    }
    setActionError(undefined);
    setFormMode(undefined);
  }

  async function requestDelete(student: Student) {
    if (!classroomQuery.data) return;
    const references = getStudentReferences(classroomQuery.data, student.id);
    if (references.length > 0) {
      setBlockedStudentId(student.id);
      return;
    }
    if (
      !window.confirm(
        `Permanently delete ${student.firstName} ${student.lastName}?`,
      )
    )
      return;

    try {
      await persistClassroom(deleteStudent(classroomQuery.data, student.id));
      if (student.avatar)
        await classkitRepository.deleteAvatar(student.avatar.id);
      setActionError(undefined);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The student could not be deleted.",
      );
    }
  }

  if (classroomQuery.isPending) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <StatusMessage title="Loading roster…" />
      </main>
    );
  }
  if (classroomQuery.isError) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <StatusMessage title="The roster could not be loaded">
          {classroomQuery.error.message}
        </StatusMessage>
      </main>
    );
  }

  const classroom = classroomQuery.data;
  const blockedStudent = classroom.students.find(
    ({ id }) => id === blockedStudentId,
  );
  const blockedReferences = blockedStudent
    ? getStudentReferences(classroom, blockedStudent.id)
    : [];

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
        title="Student roster"
        description="Names are sorted by last name. Student data is saved locally on this device."
        actions={
          <Button onClick={() => setFormMode({ type: "add" })}>
            <Plus aria-hidden="true" className="size-4" /> Add student
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

      {blockedStudent ? (
        <section
          className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5"
          role="alert"
        >
          <h2 className="font-semibold text-amber-950">
            Remove this student from arrangements first
          </h2>
          <p className="mt-2 text-sm text-amber-900">
            {blockedStudent.firstName} appears in {blockedReferences.length}{" "}
            {blockedReferences.length === 1 ? "arrangement" : "arrangements"}:{" "}
            {blockedReferences
              .map(({ arrangementName }) => arrangementName)
              .join(", ")}
            .
          </p>
          <Button
            className="mt-4"
            size="sm"
            variant="outline"
            onClick={() => setBlockedStudentId(undefined)}
          >
            Close
          </Button>
        </section>
      ) : null}

      {formMode ? (
        <section
          className="mt-8 rounded-xl border border-sky-200 bg-white p-6 shadow-sm sm:p-8"
          aria-labelledby="student-form-heading"
        >
          <h2 id="student-form-heading" className="mb-6 text-xl font-semibold">
            {formMode.type === "add"
              ? "Add student"
              : `Edit ${formMode.student.firstName}`}
          </h2>
          <StudentForm
            key={formMode.type === "edit" ? formMode.student.id : "new"}
            initialValues={
              formMode.type === "edit"
                ? {
                    firstName: formMode.student.firstName,
                    lastName: formMode.student.lastName,
                    note: formMode.student.note ?? "",
                  }
                : undefined
            }
            submitLabel={
              formMode.type === "add" ? "Add student" : "Save student"
            }
            onSubmit={saveStudent}
            onCancel={() => setFormMode(undefined)}
          />
        </section>
      ) : null}

      <div className="relative mt-8 max-w-md">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-2.5 left-3 size-5 text-slate-400"
        />
        <Input
          aria-label="Search students"
          className="pl-10"
          placeholder="Search by first or last name"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="mt-6">
        {classroom.students.length === 0 ? (
          <StatusMessage title="No students yet">
            Add the first student to build this class roster.
          </StatusMessage>
        ) : students.length === 0 ? (
          <StatusMessage title="No matching students">
            Try a different name or clear the search.
          </StatusMessage>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {students.map((student) => (
              <li
                key={student.id}
                className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap"
              >
                <StudentAvatar student={student} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-950">
                    {student.firstName} {student.lastName}
                  </p>
                  {student.note ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <FileText aria-hidden="true" className="size-3.5" /> Note
                      added
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFormMode({ type: "edit", student })}
                  >
                    <Pencil aria-hidden="true" className="size-3.5" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-700 hover:bg-rose-50"
                    onClick={() => void requestDelete(student)}
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" /> Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
