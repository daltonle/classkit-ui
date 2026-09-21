import { z } from "zod";

import { seatingArrangementSchema } from "@/domain/seating-layout/seating-layout.schema";
import { studentSchema } from "@/domain/student/student.schema";

const timestampSchema = z.iso.datetime({ offset: true });

export const classroomSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1, "Class name is required"),
    schoolYear: z.string().trim().optional(),
    grade: z.number().int().nonnegative().finite().optional(),
    students: z.array(studentSchema),
    arrangements: z.array(seatingArrangementSchema),
    activeArrangementId: z.uuid().optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .superRefine((classroom, context) => {
    const studentIds = new Set(classroom.students.map(({ id }) => id));
    const arrangementNames = new Set<string>();

    if (studentIds.size !== classroom.students.length) {
      context.addIssue({
        code: "custom",
        path: ["students"],
        message: "Student IDs must be unique within a class",
      });
    }

    for (const [
      arrangementIndex,
      arrangement,
    ] of classroom.arrangements.entries()) {
      const normalizedName = arrangement.name.trim().toLocaleLowerCase();
      if (arrangementNames.has(normalizedName)) {
        context.addIssue({
          code: "custom",
          path: ["arrangements", arrangementIndex, "name"],
          message: "Arrangement names must be unique within a class",
        });
      }
      arrangementNames.add(normalizedName);

      for (const [
        placementIndex,
        placement,
      ] of arrangement.studentPlacements.entries()) {
        if (!studentIds.has(placement.studentId)) {
          context.addIssue({
            code: "custom",
            path: [
              "arrangements",
              arrangementIndex,
              "studentPlacements",
              placementIndex,
              "studentId",
            ],
            message: "Every placement must refer to an existing student",
          });
        }
      }
    }

    if (
      classroom.activeArrangementId &&
      !classroom.arrangements.some(
        ({ id }) => id === classroom.activeArrangementId,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["activeArrangementId"],
        message: "The active arrangement must belong to this class",
      });
    }
  });

export type Classroom = z.infer<typeof classroomSchema>;
