import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  type RouterHistory,
} from "@tanstack/react-router";

import { App } from "@/app/App";
import { ArrangementsPage } from "@/routes/arrangements";
import { ClassOverviewPage } from "@/routes/class-overview";
import { ClassesPage } from "@/routes/classes";
import { HomePage } from "@/routes/home";
import { GoogleDriveSpikePage } from "@/routes/google-drive-spike";
import { NewClassPage } from "@/routes/new-class";
import { NotFoundPage } from "@/routes/not-found";
import { StudentsPage } from "@/routes/students";

const rootRoute = createRootRoute({
  component: App,
  notFoundComponent: NotFoundPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const googleDriveSpikeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/drive-spike",
  component: GoogleDriveSpikePage,
});

const classesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/classes",
  component: ClassesPage,
});

const newClassRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/classes/new",
  component: NewClassPage,
});

const classOverviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/classes/$classId",
  component: ClassOverviewPage,
});

const studentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/classes/$classId/students",
  component: StudentsPage,
});

const arrangementsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/classes/$classId/arrangements",
  component: ArrangementsPage,
});

const seatingEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/classes/$classId/arrangements/$arrangementId/edit",
  component: lazyRouteComponent(
    () => import("@/routes/seating-editor"),
    "SeatingEditorPage",
  ),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  googleDriveSpikeRoute,
  classesRoute,
  newClassRoute,
  classOverviewRoute,
  studentsRoute,
  arrangementsRoute,
  seatingEditorRoute,
]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, history });
}

export const router = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
