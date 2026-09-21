import { z } from "zod";

const finiteNumber = z.number().finite();
const timestampSchema = z.iso.datetime({ offset: true });

const baseLayoutObjectSchema = z.object({
  id: z.uuid(),
  x: finiteNumber,
  y: finiteNumber,
  rotation: finiteNumber,
  locked: z.boolean(),
  fill: z.string().min(1),
  zIndex: z.number().int().nonnegative(),
});

export const rectangleObjectSchema = baseLayoutObjectSchema.extend({
  type: z.literal("rectangle"),
  width: finiteNumber.positive(),
  height: finiteNumber.positive(),
  label: z.string().trim().optional(),
});

export const circleObjectSchema = baseLayoutObjectSchema.extend({
  type: z.literal("circle"),
  radius: finiteNumber.positive(),
  label: z.string().trim().optional(),
});

export const textObjectSchema = baseLayoutObjectSchema.extend({
  type: z.literal("text"),
  text: z.string(),
  fontSize: finiteNumber.positive(),
});

export const layoutObjectSchema = z.discriminatedUnion("type", [
  rectangleObjectSchema,
  circleObjectSchema,
  textObjectSchema,
]);

export const studentPlacementSchema = z.object({
  studentId: z.uuid(),
  x: finiteNumber,
  y: finiteNumber,
});

export const seatingArrangementSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1, "Arrangement name is required"),
    canvas: z.object({
      width: z.literal(1200),
      height: z.literal(800),
      backgroundColor: z.string().min(1),
      gridSize: finiteNumber.positive(),
      snapToGrid: z.boolean(),
    }),
    objects: z.array(layoutObjectSchema),
    studentPlacements: z.array(studentPlacementSchema),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .superRefine((arrangement, context) => {
    const studentIds = new Set<string>();
    for (const [index, placement] of arrangement.studentPlacements.entries()) {
      if (studentIds.has(placement.studentId)) {
        context.addIssue({
          code: "custom",
          path: ["studentPlacements", index, "studentId"],
          message: "A student may only be placed once in an arrangement",
        });
      }
      studentIds.add(placement.studentId);

      if (
        placement.x < 0 ||
        placement.x > arrangement.canvas.width ||
        placement.y < 0 ||
        placement.y > arrangement.canvas.height
      ) {
        context.addIssue({
          code: "custom",
          path: ["studentPlacements", index],
          message: "Student placements must remain reachable on the canvas",
        });
      }
    }

    const objectIds = new Set<string>();
    for (const [index, object] of arrangement.objects.entries()) {
      if (objectIds.has(object.id)) {
        context.addIssue({
          code: "custom",
          path: ["objects", index, "id"],
          message: "Layout object IDs must be unique",
        });
      }
      objectIds.add(object.id);

      const horizontalReachable =
        object.type === "rectangle"
          ? object.x + object.width >= 0 && object.x <= arrangement.canvas.width
          : object.type === "circle"
            ? object.x + object.radius >= 0 &&
              object.x - object.radius <= arrangement.canvas.width
            : object.x >= 0 && object.x <= arrangement.canvas.width;
      const verticalReachable =
        object.type === "rectangle"
          ? object.y + object.height >= 0 &&
            object.y <= arrangement.canvas.height
          : object.type === "circle"
            ? object.y + object.radius >= 0 &&
              object.y - object.radius <= arrangement.canvas.height
            : object.y >= 0 && object.y <= arrangement.canvas.height;

      if (!horizontalReachable || !verticalReachable) {
        context.addIssue({
          code: "custom",
          path: ["objects", index],
          message: "Layout objects must remain partly reachable on the canvas",
        });
      }
    }
  });

export type RectangleObject = z.infer<typeof rectangleObjectSchema>;
export type CircleObject = z.infer<typeof circleObjectSchema>;
export type TextObject = z.infer<typeof textObjectSchema>;
export type LayoutObject = z.infer<typeof layoutObjectSchema>;
export type StudentPlacement = z.infer<typeof studentPlacementSchema>;
export type SeatingArrangement = z.infer<typeof seatingArrangementSchema>;
