import {
  createRootRoute,
  createRoute,
  createRouter,
  type RouterHistory,
} from "@tanstack/react-router";

import { App } from "@/app/App";
import { HomePage } from "@/routes/home";
import { NotFoundPage } from "@/routes/not-found";

const rootRoute = createRootRoute({
  component: App,
  notFoundComponent: NotFoundPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const routeTree = rootRoute.addChildren([indexRoute]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, history });
}

export const router = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
