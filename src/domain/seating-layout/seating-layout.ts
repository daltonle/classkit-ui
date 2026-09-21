import {
  seatingArrangementSchema,
  type SeatingArrangement,
  type StudentPlacement,
} from "./seating-layout.schema";

export function createArrangement(
  name: string,
  now = new Date(),
): SeatingArrangement {
  const timestamp = now.toISOString();
  return seatingArrangementSchema.parse({
    id: crypto.randomUUID(),
    name,
    canvas: {
      width: 1200,
      height: 800,
      backgroundColor: "#ffffff",
      gridSize: 20,
      snapToGrid: false,
    },
    objects: [],
    studentPlacements: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function duplicateArrangement(
  arrangement: SeatingArrangement,
  name: string,
  now = new Date(),
): SeatingArrangement {
  const timestamp = now.toISOString();
  return seatingArrangementSchema.parse({
    ...structuredClone(arrangement),
    id: crypto.randomUUID(),
    name,
    objects: arrangement.objects.map((object) => ({
      ...structuredClone(object),
      id: crypto.randomUUID(),
    })),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function placeStudent(
  arrangement: SeatingArrangement,
  placement: StudentPlacement,
  now = new Date(),
): SeatingArrangement {
  if (
    arrangement.studentPlacements.some(
      (existing) => existing.studentId === placement.studentId,
    )
  ) {
    throw new Error("This student is already placed in the arrangement.");
  }

  return seatingArrangementSchema.parse({
    ...arrangement,
    studentPlacements: [...arrangement.studentPlacements, placement],
    updatedAt: now.toISOString(),
  });
}

export function removeStudentPlacement(
  arrangement: SeatingArrangement,
  studentId: string,
  now = new Date(),
): SeatingArrangement {
  return seatingArrangementSchema.parse({
    ...arrangement,
    studentPlacements: arrangement.studentPlacements.filter(
      (placement) => placement.studentId !== studentId,
    ),
    updatedAt: now.toISOString(),
  });
}

export function normalizeArrangement(
  arrangement: SeatingArrangement,
): SeatingArrangement {
  const objects = [...arrangement.objects]
    .sort((left, right) => left.zIndex - right.zIndex)
    .map((object, zIndex) => ({ ...object, zIndex }));

  return seatingArrangementSchema.parse({ ...arrangement, objects });
}
