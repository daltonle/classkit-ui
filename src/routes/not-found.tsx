import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <main className="grid min-h-[calc(100vh-73px)] place-items-center px-6 py-16">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold text-sky-700">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Page not found
        </h1>
        <p className="mt-4 text-slate-600">
          The page you requested does not exist or may have moved.
        </p>
        <Button asChild className="mt-7">
          <Link to="/">Return home</Link>
        </Button>
      </div>
    </main>
  );
}
