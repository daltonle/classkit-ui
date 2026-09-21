import { z } from "zod";

import { classroomSchema } from "@/domain/classroom/classroom.schema";

const timestampSchema = z.iso.datetime({ offset: true });

export const classkitManifestV1Schema = z.object({
  schemaVersion: z.literal(1),
  classes: z.array(
    z.object({
      id: z.uuid(),
      name: z.string().trim().min(1),
      documentFileId: z.string().min(1),
      updatedAt: timestampSchema,
    }),
  ),
  updatedAt: timestampSchema,
});

export const classroomDocumentV1Schema = z.object({
  schemaVersion: z.literal(1),
  documentType: z.literal("classroom"),
  data: classroomSchema,
});

export type ClassroomDocumentV1 = z.infer<typeof classroomDocumentV1Schema>;
export type ClasskitManifestV1 = z.infer<typeof classkitManifestV1Schema>;

export function createClassroomDocument(
  classroom: z.infer<typeof classroomSchema>,
): ClassroomDocumentV1 {
  return classroomDocumentV1Schema.parse({
    schemaVersion: 1,
    documentType: "classroom",
    data: classroom,
  });
}
