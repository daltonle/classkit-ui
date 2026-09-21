import { classroomSchema, type Classroom } from "./classroom.schema";

import { normalizeArrangement } from "@/domain/seating-layout/seating-layout";
import type { SeatingArrangement } from "@/domain/seating-layout/seating-layout.schema";
import type { Student } from "@/domain/student/student.schema";

export type ClassroomDetails = {
  name: string;
  schoolYear?: string;
  grade?: number;
};

export type StudentReference = {
  arrangementId: string;
  arrangementName: string;
};

export function createClassroom(
  details: ClassroomDetails,
  now = new Date(),
): Classroom {
  const timestamp = now.toISOString();
  return classroomSchema.parse({
    id: crypto.randomUUID(),
    name: details.name,
    ...(details.schoolYear?.trim() ? { schoolYear: details.schoolYear } : {}),
    ...(details.grade !== undefined ? { grade: details.grade } : {}),
    students: [],
    arrangements: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function updateClassroomDetails(
  classroom: Classroom,
  details: ClassroomDetails,
  now = new Date(),
): Classroom {
  return classroomSchema.parse({
    ...classroom,
    name: details.name,
    schoolYear: details.schoolYear?.trim() || undefined,
    grade: details.grade,
    updatedAt: now.toISOString(),
  });
}

export function addStudent(
  classroom: Classroom,
  student: Student,
  now = new Date(),
): Classroom {
  return classroomSchema.parse({
    ...classroom,
    students: [...classroom.students, student],
    updatedAt: now.toISOString(),
  });
}

export function replaceStudent(
  classroom: Classroom,
  student: Student,
  now = new Date(),
): Classroom {
  if (!classroom.students.some(({ id }) => id === student.id)) {
    throw new Error("Student does not belong to this class.");
  }

  return classroomSchema.parse({
    ...classroom,
    students: classroom.students.map((existing) =>
      existing.id === student.id ? student : existing,
    ),
    updatedAt: now.toISOString(),
  });
}

export function getStudentReferences(
  classroom: Classroom,
  studentId: string,
): StudentReference[] {
  return classroom.arrangements
    .filter((arrangement) =>
      arrangement.studentPlacements.some(
        (placement) => placement.studentId === studentId,
      ),
    )
    .map(({ id, name }) => ({ arrangementId: id, arrangementName: name }));
}

export function canDeleteStudent(
  classroom: Classroom,
  studentId: string,
): boolean {
  return getStudentReferences(classroom, studentId).length === 0;
}

export function deleteStudent(
  classroom: Classroom,
  studentId: string,
  now = new Date(),
): Classroom {
  if (!canDeleteStudent(classroom, studentId)) {
    throw new Error("A placed student cannot be deleted.");
  }

  return classroomSchema.parse({
    ...classroom,
    students: classroom.students.filter(({ id }) => id !== studentId),
    updatedAt: now.toISOString(),
  });
}

export function addArrangement(
  classroom: Classroom,
  arrangement: SeatingArrangement,
  now = new Date(),
): Classroom {
  return classroomSchema.parse({
    ...classroom,
    arrangements: [...classroom.arrangements, arrangement],
    updatedAt: now.toISOString(),
  });
}

export function replaceArrangement(
  classroom: Classroom,
  arrangement: SeatingArrangement,
  now = new Date(),
): Classroom {
  if (!classroom.arrangements.some(({ id }) => id === arrangement.id)) {
    throw new Error("Arrangement does not belong to this class.");
  }

  return classroomSchema.parse({
    ...classroom,
    arrangements: classroom.arrangements.map((existing) =>
      existing.id === arrangement.id ? arrangement : existing,
    ),
    updatedAt: now.toISOString(),
  });
}

export function renameArrangement(
  classroom: Classroom,
  arrangementId: string,
  name: string,
  now = new Date(),
): Classroom {
  const arrangement = classroom.arrangements.find(
    ({ id }) => id === arrangementId,
  );
  if (!arrangement)
    throw new Error("Arrangement does not belong to this class.");

  return replaceArrangement(
    classroom,
    { ...arrangement, name: name.trim(), updatedAt: now.toISOString() },
    now,
  );
}

export function setActiveArrangement(
  classroom: Classroom,
  arrangementId: string | undefined,
  now = new Date(),
): Classroom {
  return classroomSchema.parse({
    ...classroom,
    activeArrangementId: arrangementId,
    updatedAt: now.toISOString(),
  });
}

export function deleteArrangement(
  classroom: Classroom,
  arrangementId: string,
  now = new Date(),
): Classroom {
  if (!classroom.arrangements.some(({ id }) => id === arrangementId)) {
    throw new Error("Arrangement does not belong to this class.");
  }

  return classroomSchema.parse({
    ...classroom,
    arrangements: classroom.arrangements.filter(
      ({ id }) => id !== arrangementId,
    ),
    activeArrangementId:
      classroom.activeArrangementId === arrangementId
        ? undefined
        : classroom.activeArrangementId,
    updatedAt: now.toISOString(),
  });
}

export function normalizeClassroom(classroom: Classroom): Classroom {
  return classroomSchema.parse({
    ...classroom,
    arrangements: classroom.arrangements.map(normalizeArrangement),
  });
}
