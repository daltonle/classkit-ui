import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { error?: Error };

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Classkit encountered an unexpected error", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
          <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold text-rose-700">
              Something went wrong
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Classkit could not start
            </h1>
            <p className="mt-3 text-slate-600">{this.state.error.message}</p>
            <Button className="mt-6" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
