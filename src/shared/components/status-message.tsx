import type { ReactNode } from "react";

export function StatusMessage({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {children ? (
        <div className="mt-2 text-sm text-slate-600">{children}</div>
      ) : null}
    </div>
  );
}
