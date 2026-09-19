import { z } from "zod";

export const environmentSchema = z.object({
  VITE_GOOGLE_CLIENT_ID: z.string().trim().min(1),
});

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(values: unknown): Environment {
  const result = environmentSchema.safeParse(values);

  if (!result.success) {
    throw new Error(
      "Classkit is missing required configuration. Copy .env.example to .env and set VITE_GOOGLE_CLIENT_ID.",
    );
  }

  return result.data;
}
