import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers";
import { createAppRouter } from "@/app/router";

beforeAll(() => {
  vi.stubEnv(
    "VITE_GOOGLE_CLIENT_ID",
    "vitest-client-id.apps.googleusercontent.com",
  );
});

describe("application routing", () => {
  it("renders the welcome screen", async () => {
    const router = createAppRouter(
      createMemoryHistory({ initialEntries: ["/"] }),
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(
      await screen.findByRole("heading", {
        name: /shape a classroom where every student can thrive/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders a useful not-found screen for unknown routes", async () => {
    const router = createAppRouter(
      createMemoryHistory({ initialEntries: ["/missing-page"] }),
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(
      await screen.findByRole("heading", { name: /page not found/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /return home/i })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
