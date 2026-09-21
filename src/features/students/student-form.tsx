import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState, type ChangeEvent } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/shared/components/form-field";

const studentFormSchema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name"),
  lastName: z.string().trim().min(1, "Enter a last name"),
  note: z.string(),
});

export type StudentFormValues = z.infer<typeof studentFormSchema>;

export function StudentForm({
  initialValues = { firstName: "", lastName: "", note: "" },
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialValues?: StudentFormValues;
  submitLabel: string;
  onSubmit: (values: StudentFormValues, avatarFile?: File) => Promise<void>;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: initialValues,
  });
  const [avatarFile, setAvatarFile] = useState<File>();

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values, avatarFile);
    } catch (error) {
      setError("root", {
        message:
          error instanceof Error
            ? error.message
            : "The student could not be saved.",
      });
    }
  });

  return (
    <form className="space-y-5" onSubmit={(event) => void submit(event)}>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="student-first-name"
          label="First name"
          error={errors.firstName?.message}
          {...register("firstName")}
        />
        <FormField
          id="student-last-name"
          label="Last name"
          error={errors.lastName?.message}
          {...register("lastName")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="student-note">Note (optional)</Label>
        <textarea
          id="student-note"
          rows={4}
          className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus-visible:border-sky-600 focus-visible:ring-2 focus-visible:ring-sky-600/20"
          aria-describedby="student-note-hint"
          {...register("note")}
        />
        <p id="student-note-hint" className="text-xs leading-5 text-slate-500">
          Keep notes brief. Do not record highly sensitive safeguarding,
          medical, or behavioural information in Classkit.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="student-avatar">Avatar photo (optional)</Label>
        <Input
          id="student-avatar"
          type="file"
          accept="image/*"
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setAvatarFile(event.target.files?.[0])
          }
        />
        <p className="text-xs leading-5 text-slate-500">
          Images are centre-cropped, resized to 256 pixels, and stored locally
          as WebP.
        </p>
      </div>
      {errors.root ? (
        <p className="text-sm text-rose-700" role="alert">
          {errors.root.message}
        </p>
      ) : null}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
