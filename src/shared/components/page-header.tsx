import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5 border-b border-slate-200 pb-6">
      <div>
        {eyebrow ? (
          <p className="text-sm font-semibold text-sky-700">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-slate-600">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex gap-3">{actions}</div> : null}
    </div>
  );
}
