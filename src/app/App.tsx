import { Link, Outlet } from "@tanstack/react-router";

import { parseEnvironment } from "@/shared/lib/environment";

export function App() {
  parseEnvironment(import.meta.env);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link className="text-xl font-bold tracking-tight" to="/">
            Classkit
          </Link>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
            Foundation preview
          </span>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
