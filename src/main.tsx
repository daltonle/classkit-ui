import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ErrorBoundary } from "@/app/error-boundary";
import { AppProviders } from "@/app/providers";
import { router } from "@/app/router";
import "@/styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("The Classkit root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
);
