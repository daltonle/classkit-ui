import { MapPin, Trash2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Student } from "@/domain/student/student.schema";
import {
  placeStudentCommand,
  removeStudentCommand,
} from "@/features/seating-editor/model/object-commands";
import { useEditorStore } from "@/features/seating-editor/store/editor-store";
import { StudentAvatar } from "@/features/students/student-avatar";

export function StudentRosterPanel({ students }: { students: Student[] }) {
  const arrangement = useEditorStore((state) => state.arrangement);
  const selectedStudentId = useEditorStore((state) => state.selectedStudentId);
  const execute = useEditorStore((state) => state.execute);
  const selectStudent = useEditorStore((state) => state.selectStudent);
  const placedIds = new Set(
    arrangement?.studentPlacements.map(({ studentId }) => studentId),
  );
  const selectedStudent = students.find(({ id }) => id === selectedStudentId);
  const unplaced = students.filter(({ id }) => !placedIds.has(id));
  const placed = students.filter(({ id }) => placedIds.has(id));

  function place(student: Student) {
    if (!arrangement) return;
    execute(placeStudentCommand(student.id, 600, 400));
    selectStudent(student.id);
  }

  if (selectedStudent && placedIds.has(selectedStudent.id)) {
    return (
      <aside className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <StudentAvatar student={selectedStudent} />
          <div className="min-w-0">
            <h2 className="truncate font-semibold">
              {selectedStudent.firstName} {selectedStudent.lastName}
            </h2>
            <p className="text-sm text-slate-500">Placed in this arrangement</p>
          </div>
        </div>
        {selectedStudent.note ? (
          <p className="mt-5 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
            {selectedStudent.note}
          </p>
        ) : null}
        <Button
          className="mt-5 w-full"
          variant="destructive"
          onClick={() => {
            execute(removeStudentCommand(selectedStudent.id));
            selectStudent(undefined);
          }}
        >
          <Trash2 aria-hidden="true" className="size-4" /> Remove from
          arrangement
        </Button>
      </aside>
    );
  }

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold">Students</h2>
      <section className="mt-4">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Unplaced ({unplaced.length})
        </h3>
        <ul className="mt-2 space-y-2">
          {unplaced.map((student) => (
            <li
              key={student.id}
              className="flex items-center gap-2 rounded-md bg-slate-50 p-2"
            >
              <StudentAvatar student={student} className="size-8 text-xs" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {student.firstName} {student.lastName}
              </span>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Place ${student.firstName} ${student.lastName}`}
                title="Place on canvas"
                onClick={() => place(student)}
              >
                <UserPlus aria-hidden="true" className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-5 border-t border-slate-200 pt-4">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Placed ({placed.length})
        </h3>
        <ul className="mt-2 space-y-1">
          {placed.map((student) => (
            <li key={student.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-slate-50"
                onClick={() => selectStudent(student.id)}
              >
                <MapPin aria-hidden="true" className="size-4 text-sky-700" />
                {student.firstName} {student.lastName}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
