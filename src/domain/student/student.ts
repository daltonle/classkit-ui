import { studentSchema, type Student } from "./student.schema";

const AVATAR_COLORS = [
  "#0369a1",
  "#0f766e",
  "#4f46e5",
  "#7e22ce",
  "#be123c",
  "#b45309",
] as const;

export type StudentDetails = {
  firstName: string;
  lastName?: string;
  note?: string;
};

export function avatarColorForId(id: string): string {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return (
    AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]
  );
}

export function createStudent(
  details: StudentDetails,
  now = new Date(),
): Student {
  const id = crypto.randomUUID();
  const timestamp = now.toISOString();

  return studentSchema.parse({
    id,
    firstName: details.firstName,
    lastName: details.lastName ?? "",
    points: 0,
    ...(details.note?.trim() ? { note: details.note } : {}),
    avatarColor: avatarColorForId(id),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function updateStudent(
  student: Student,
  details: StudentDetails,
  now = new Date(),
): Student {
  return studentSchema.parse({
    ...student,
    firstName: details.firstName,
    lastName: details.lastName ?? "",
    note: details.note?.trim() || undefined,
    updatedAt: now.toISOString(),
  });
}

export function studentInitials(student: Student): string {
  return `${student.firstName.at(0) ?? ""}${student.lastName.at(0) ?? ""}`.toUpperCase();
}

export function studentFullName(student: Student): string {
  return [student.firstName, student.lastName].filter(Boolean).join(" ");
}

export function adjustStudentPoints(
  student: Student,
  change: number,
  now = new Date(),
): Student {
  if (!Number.isInteger(change))
    throw new Error("Student point changes must be whole numbers.");
  return studentSchema.parse({
    ...student,
    points: student.points + change,
    updatedAt: now.toISOString(),
  });
}

export function compareStudents(left: Student, right: Student): number {
  return (
    left.lastName.localeCompare(right.lastName, undefined, {
      sensitivity: "base",
    }) ||
    left.firstName.localeCompare(right.firstName, undefined, {
      sensitivity: "base",
    })
  );
}
