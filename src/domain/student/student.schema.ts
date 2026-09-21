import { z } from "zod";

const timestampSchema = z.iso.datetime({ offset: true });

export const studentSchema = z.object({
  id: z.uuid(),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().default(""),
  points: z.number().int().default(0),
  note: z.string().trim().optional(),
  avatar: z
    .object({
      id: z.uuid(),
      mimeType: z.literal("image/webp"),
    })
    .optional(),
  avatarColor: z.string().min(1),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type Student = z.infer<typeof studentSchema>;
