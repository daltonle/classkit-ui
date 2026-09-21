import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { FormField } from "@/shared/components/form-field";

const classFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a class name"),
  schoolYear: z.string(),
  grade: z
    .number()
    .int("Grade must be a whole number")
    .nonnegative("Grade cannot be negative")
    .optional(),
});

export type ClassFormValues = z.infer<typeof classFormSchema>;

export function ClassForm({
  initialValues = { name: "", schoolYear: "", grade: undefined },
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialValues?: ClassFormValues;
  submitLabel: string;
  onSubmit: (values: ClassFormValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ClassFormValues>({
    resolver: zodResolver(classFormSchema),
    defaultValues: initialValues,
  });

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      setError("root", {
        message:
          error instanceof Error
            ? error.message
            : "The class could not be saved.",
      });
    }
  });

  return (
    <form className="space-y-5" onSubmit={(event) => void submit(event)}>
      <FormField
        id="class-name"
        label="Class name"
        error={errors.name?.message}
        {...register("name")}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="school-year"
          label="School year (optional)"
          placeholder="2026"
          error={errors.schoolYear?.message}
          {...register("schoolYear")}
        />
        <FormField
          id="grade"
          label="Grade / year level (optional)"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          placeholder="4"
          error={errors.grade?.message}
          {...register("grade", {
            setValueAs: (value: string) =>
              value.trim() === "" ? undefined : Number(value),
          })}
        />
      </div>
      {errors.root ? (
        <p className="text-sm text-rose-700" role="alert">
          {errors.root.message}
        </p>
      ) : null}
      <div className="flex justify-end gap-3">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
