import type { ComponentProps, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FormField({
  label,
  error,
  hint,
  ...props
}: Omit<ComponentProps<typeof Input>, "id"> & {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
}) {
  const errorId = error ? `${props.id}-error` : undefined;
  const hintId = hint ? `${props.id}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={props.id}>{label}</Label>
      <Input
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {hint ? (
        <div id={hintId} className="text-xs leading-5 text-slate-500">
          {hint}
        </div>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
