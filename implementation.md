# Classkit implementation plan

## 1. Purpose

Classkit is a static, desktop-first React application for primary-school teachers. It provides classroom-management tools that are not already handled well by Google Classroom.

The first feature is a visual classroom seating-arrangement editor. A teacher can:

- sign in with a Google account;
- create and manage multiple classes;
- add student records with first name, last name, optional note, and optional avatar;
- construct a classroom map using movable rectangle, circle, and text objects;
- place student avatars freely on the map;
- save multiple arrangements for a class;
- create an arrangement from a blank canvas or by duplicating an existing arrangement;
- select which arrangement is currently active; and
- have changes saved locally and synchronized to a hidden, app-specific Google Drive folder.

The MVP has no application backend. All application logic runs in the browser.

## 2. Product principles

1. **Fast during class:** editing must never wait for a network request.
2. **Safe by default:** every change is saved locally immediately and synchronized automatically.
3. **Teacher-owned:** only the Google account that created the data can access it in the MVP.
4. **Storage-independent domain:** components and editor logic must not depend directly on Google Drive.
5. **Stable file format:** persist Classkit domain objects, never serialized canvas-library objects.
6. **Focused editor:** build a classroom layout editor, not a general-purpose drawing application.
7. **Future-ready, not over-engineered:** create explicit extension points for shared storage and semantic activity groups, but do not implement them yet.

## 3. MVP scope

### Included

- Google sign-in and Drive authorization.
- Multiple classes per teacher.
- Student create, read, update, and delete workflows.
- Optional student photo upload.
- Initials and stable-colour avatar fallback.
- Multiple seating arrangements per class.
- Blank and duplicate-arrangement creation flows.
- Rectangle, circle, and text classroom objects.
- Optional labels for rectangle and circle objects.
- Object selection, move, resize, rotate, duplicate, delete, lock, and layer ordering.
- Student placement, movement, and removal from the canvas.
- Fixed logical canvas with fit-to-window scaling and zoom controls.
- Undo and redo for editor changes.
- Immediate IndexedDB persistence.
- Debounced synchronization to Google Drive `appDataFolder`.
- Clear save/synchronization status.
- Conflict protection for multiple tabs.
- Loading, empty, offline, expired-authorization, and corrupt-data states.

### Explicitly excluded

- Student or parent accounts.
- Multiple teachers editing or viewing the same class.
- Google Classroom integration.
- A custom server or server-side database.
- Mobile and tablet editor optimization.
- Real-time collaboration.
- Freehand drawing.
- Rules that automatically place students.
- Semantic attachment of students to tables or seats.
- Attendance, behaviour tracking, activity groups, or reporting.
- CSV as a canonical database format.
- Full offline authentication. Previously loaded data may remain locally usable, but Drive synchronization requires valid Google authorization.
- Automated unit and browser tests. They are not required for the MVP; use the verification checklist in section 17 instead.

## 4. Technical stack

Use the latest mutually compatible stable releases at the time implementation begins. Commit the lockfile.

| Concern            | Technology                                       |
| ------------------ | ------------------------------------------------ |
| Build              | Vite                                             |
| UI                 | React and TypeScript in strict mode              |
| Styling            | Tailwind CSS                                     |
| UI primitives      | shadcn/ui source copied into `src/components/ui` |
| Icons              | Lucide React                                     |
| Routing            | TanStack Router                                  |
| Server/async state | TanStack Query                                   |
| Editor state       | Zustand with Immer middleware                    |
| Forms              | React Hook Form                                  |
| Runtime validation | Zod                                              |
| Canvas             | Konva and react-konva                            |
| Local database     | IndexedDB through Dexie                          |
| Formatting/linting | Prettier and ESLint                              |

Do not add a component framework in addition to shadcn. Do not use a general whiteboard SDK.

## 5. Repository setup

Create a single Vite application rather than a monorepo.

Required configuration:

- React with TypeScript.
- Strict TypeScript settings, including `noUncheckedIndexedAccess`.
- `@/*` alias mapped to `src/*`.
- Tailwind configured through the supported Vite integration.
- shadcn primitives copied into the repository and treated as owned source code.
- Environment variables validated at startup.
- Separate development and production Google OAuth client configuration where appropriate.
- No client secret in the application. A Google web client ID is public configuration.

Initial environment schema:

```ts
const environmentSchema = z.object({
  VITE_GOOGLE_CLIENT_ID: z.string().min(1),
});
```

Include `.env.example`, but do not commit real credentials.

## 6. Suggested source structure

```text
src/
  app/
    App.tsx
    providers.tsx
    router.tsx
  components/
    ui/
  domain/
    classroom/
      classroom.ts
      classroom.schema.ts
    student/
      student.ts
      student.schema.ts
    seating-layout/
      seating-layout.ts
      seating-layout.schema.ts
    documents/
      document.schema.ts
      migrations.ts
  features/
    auth/
    classes/
    students/
    arrangements/
    seating-editor/
      components/
      hooks/
      model/
      store/
  infrastructure/
    auth/
      google-auth.ts
      google-types.ts
    persistence/
      classkit-repository.ts
      indexeddb-repository.ts
      google-drive-repository.ts
      synchronized-repository.ts
      persistence-errors.ts
    images/
      avatar-processing.ts
  routes/
  shared/
    components/
    hooks/
    lib/
    types/
```

Keep domain modules free of React, Konva, Google API, and IndexedDB imports.

## 7. Domain model

IDs should be generated client-side with `crypto.randomUUID()`.

Use ISO 8601 UTC strings for persisted timestamps. Use explicit Zod schemas for all data crossing a persistence boundary.

```ts
type Classroom = {
  id: string;
  name: string;
  schoolYear?: string;
  grade?: number;
  students: Student[];
  arrangements: SeatingArrangement[];
  activeArrangementId?: string;
  createdAt: string;
  updatedAt: string;
};

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  note?: string;
  avatar?: {
    id: string;
    mimeType: "image/webp";
  };
  avatarColor: string;
  createdAt: string;
  updatedAt: string;
};

type SeatingArrangement = {
  id: string;
  name: string;
  canvas: {
    width: 1200;
    height: 800;
    backgroundColor: string;
    gridSize: number;
    snapToGrid: boolean;
  };
  objects: LayoutObject[];
  studentPlacements: StudentPlacement[];
  createdAt: string;
  updatedAt: string;
};

type BaseLayoutObject = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  locked: boolean;
  fill: string;
  zIndex: number;
};

type RectangleObject = BaseLayoutObject & {
  type: "rectangle";
  width: number;
  height: number;
  label?: string;
};

type CircleObject = BaseLayoutObject & {
  type: "circle";
  radius: number;
  label?: string;
};

type TextObject = BaseLayoutObject & {
  type: "text";
  text: string;
  fontSize: number;
};

type LayoutObject = RectangleObject | CircleObject | TextObject;

type StudentPlacement = {
  studentId: string;
  x: number;
  y: number;
};
```

Enforce these invariants in domain functions and schemas:

- A class name is required after trimming.
- First name and last name are required after trimming.
- Arrangement names are required and unique within a class, compared case-insensitively.
- A student may occur at most once in a given arrangement.
- Every placement must refer to an existing student.
- `activeArrangementId`, if present, must refer to an existing arrangement.
- Coordinates and dimensions must be finite numbers.
- Objects and students should be constrained to remain at least partly reachable on the canvas.
- `zIndex` values should be normalized when persisting.
- A student cannot be deleted while referenced by any arrangement.

Use domain functions such as `createClassroom`, `duplicateArrangement`, `placeStudent`, `removeStudentPlacement`, and `canDeleteStudent`. Do not scatter invariants through components.

## 8. Persisted document format

Use JSON for canonical structured data. CSV may later be offered only as an import/export format.

Google Drive `appDataFolder` contains one portable, versioned snapshot:

```text
classkit.json
```

The snapshot keeps metadata separate from its application data:

```ts
type CloudSnapshotV1 = {
  schemaVersion: 1;
  createdAt: string;
  data: {
    classes: Classroom[];
    avatars: Array<{ id: string; mimeType: "image/webp"; base64: string }>;
  };
};
```

Rules:

- Store and retain Drive file IDs after creation; do not rely only on filenames.
- Treat the snapshot as a portable database backup, not as IndexedDB serialization.
- Never persist access tokens.
- Never persist raw Konva node JSON.
- Validate every downloaded document.
- Keep migrations as pure functions from one version to the next.
- Preserve the invalid raw document locally when migration or parsing fails, and show a recovery state rather than overwriting it.

## 9. Repository boundary

Define an interface owned by the application/domain boundary:

```ts
interface ClasskitRepository {
  listClasses(signal?: AbortSignal): Promise<ClassSummary[]>;
  getClass(classId: string, signal?: AbortSignal): Promise<Classroom>;
  createClass(classroom: Classroom): Promise<void>;
  saveClass(classroom: Classroom, options?: SaveOptions): Promise<SaveResult>;
  deleteClass(classId: string): Promise<void>;
  getAvatar(avatarId: string, signal?: AbortSignal): Promise<Blob | undefined>;
  saveAvatar(avatarId: string, image: Blob): Promise<void>;
  deleteAvatar(avatarId: string): Promise<void>;
}

type SaveOptions = {
  expectedRevision?: string;
};

type SaveResult = {
  revision: string;
  updatedAt: string;
};
```

Implement:

1. `IndexedDbRepository` for immediate local persistence.
2. `GoogleDriveRepository` for remote persistence.
3. `SynchronizedRepository` to coordinate local-first writes, pending operations, retries, and conflicts.

The application should consume the repository interface. It must not call Drive endpoints from route components or feature components.

## 10. Google identity and Drive authorization

Use Google Identity Services for the browser.

Authentication and authorization are distinct:

- Authentication establishes the signed-in Google identity.
- Authorization obtains a short-lived access token for Drive.

Request only:

```text
openid
email
profile
https://www.googleapis.com/auth/drive.appdata
```

Implementation requirements:

- Keep access tokens in memory only.
- Do not use or expose a client secret.
- Call Drive v3 REST endpoints with `fetch` and `Authorization: Bearer ...`.
- Request Drive access in response to a clear user gesture.
- Handle the user closing or rejecting the authorization prompt.
- Treat `401` as expired/invalid authorization and transition to `reconnect_required`.
- Do not repeatedly open authorization popups automatically.
- Allow locally cached editing while remote authorization is unavailable.
- Resume queued synchronization after the user reconnects.
- Provide a disconnect action that revokes consent where possible and clears local account data after confirmation.

Auth states should be explicit, for example:

```ts
type AuthState =
  | { status: "signed_out" }
  | { status: "signed_in"; user: GoogleUser; drive: "not_authorized" }
  | { status: "signed_in"; user: GoogleUser; drive: "authorized" }
  | { status: "signed_in"; user: GoogleUser; drive: "reconnect_required" };
```

## 11. Local-first synchronization

### Write path

1. Apply an editor command to in-memory state.
2. Save the resulting class document to IndexedDB immediately.
3. Mark the cloud snapshot as dirty in IndexedDB.
4. Debounce remote synchronization for approximately two seconds.
5. Compare the remote snapshot version with the last known version.
6. Upload, download, merge, or do nothing as appropriate; then record the remote version.

Coalesce repeated edits. Do not enqueue one Drive request for every pointer movement.

### Read path

1. Render locally cached class summaries immediately when available.
2. Fetch remote file metadata first; download the snapshot only when its version changed.
3. Validate and migrate the remote snapshot.
4. Reconcile it with local dirty state using record-level `updatedAt` values.
5. Update IndexedDB and the query cache.

### Sync status

Expose one of:

```ts
type SyncStatus =
  "saved" | "saving" | "offline" | "reconnect_required" | "conflict" | "error";
```

Display this status in the application header/editor header. `Ctrl/Cmd + S` should request an immediate sync but is not required for saving locally.

### Conflict policy

The MVP only has one owner, but multiple tabs can still conflict.

- Use Drive revision/version metadata as an optimistic concurrency token where practical.
- Use `BroadcastChannel` to notify other Classkit tabs about active edits and successful saves.
- Prefer a single active editor tab per class. A second editor tab should initially open read-only with a clear option to take over.
- Never silently overwrite a newer remote revision with an older dirty document.
- If automatic reconciliation is unsafe, preserve both versions locally and ask the teacher which version to keep.

## 12. Avatar processing

Avatar photos are optional.

On upload:

- accept common browser-supported image formats;
- validate MIME type and a reasonable source-size limit;
- correct orientation if required by the browser/image pipeline;
- crop to a square through a simple crop dialog;
- resize client-side to approximately 256 by 256 pixels;
- encode as WebP at a sensible quality;
- store only the processed image, not the original;
- show initials and a deterministic colour when no image is present or loading fails.

The deterministic colour should derive from the student ID, not array position, so it remains stable.

Student notes are not rendered on the canvas. Show the full name and note only in the selected-student inspector or student form. Include restrained guidance that notes should not contain highly sensitive safeguarding, medical, or behavioural records unless the product is deliberately expanded to support that responsibility.

## 13. Routes and screens

Suggested URLs:

```text
/
/classes
/classes/new
/classes/$classId
/classes/$classId/students
/classes/$classId/arrangements
/classes/$classId/arrangements/$arrangementId/edit
```

Route access should be guarded by auth state. Avoid redirect loops while auth is initializing.

### Welcome/auth screen

- Product name and concise purpose.
- Sign in with Google action.
- Separate explanation and action for allowing private Drive storage.
- Consent rejection and reconnect states.
- Do not imply Classkit can read the teacher's other Drive files.

### Classes screen

- Display all locally known classes.
- Create, open, rename, and delete a class.
- Show active arrangement and last updated time where available.
- Include loading, empty, offline, and synchronization-error states.
- Permanently deleting a class requires confirmation.

### Class overview

- Class name, optional school year, and optional numeric grade/year level.
- Student count.
- Active arrangement summary.
- Navigation to roster and arrangements.
- Quick action to open the active arrangement.

### Student roster

- List students alphabetically by last name then first name.
- Add and edit student using a dialog or dedicated panel.
- Search by first or last name.
- Display avatar, full name, and a subtle indication when a note exists.
- Do not display full notes in the list.
- Deletion is blocked while a student appears in any arrangement.
- A blocked-deletion dialog states the number of arrangements and links to them.
- Once unplaced from all arrangements, deletion requires confirmation and removes the avatar blob.

### Arrangements screen

- List arrangements and indicate the active one.
- Create from blank or duplicate an existing arrangement, with both choices equally prominent.
- Open, rename, duplicate, set active, and delete.
- Arrangement names must be unique within the class.
- Deleting the active arrangement requires selecting another active arrangement or confirming that none will be active.

### Seating editor

Desktop layout:

- Top header: back, arrangement name, sync status, undo, redo, and overflow actions.
- Left toolbar: selection, rectangle, circle, and text.
- Centre: canvas workspace.
- Right panel: unplaced students when nothing is selected; object/student properties when selected.
- Bottom controls: zoom out, zoom value, zoom in, fit to screen, and grid toggle.

## 14. Seating editor behaviour

Use a logical canvas size of 1200 by 800. Scale the stage to the viewport; persist logical coordinates, not display pixels.

### Classroom objects

- Create rectangle, circle, and text objects.
- Newly created rectangle/circle objects receive sensible default dimensions and colour.
- Rectangle and circle labels are optional.
- Move unlocked objects by dragging.
- Resize and rotate selected unlocked objects using a Konva Transformer.
- Edit fill, label/text, and locked status in the inspector.
- Locked objects cannot move, resize, rotate, or delete until unlocked.
- Support duplicate, delete, bring forward, send backward, bring to front, and send to back.
- Keep each object at least partly reachable after transforms.

### Student placements

- The right panel separates `Unplaced` and `Placed` students.
- Dragging or adding an unplaced student to the canvas creates one placement.
- Each placement renders a circular avatar and first name.
- A placement may be moved freely and must remain reachable.
- Selecting a placement shows full name, optional note, and a `Remove from arrangement` action.
- Removing a placement returns the student to the unplaced list; it does not delete the student.
- A student cannot be placed twice in one arrangement.
- Classroom objects should render below student placements by default.

### Selection and keyboard controls

MVP keyboard shortcuts:

| Shortcut                                 | Action                                                       |
| ---------------------------------------- | ------------------------------------------------------------ |
| `Delete` / `Backspace`                   | Delete selected unlocked object or remove selected placement |
| `Ctrl/Cmd + Z`                           | Undo                                                         |
| `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y` | Redo                                                         |
| `Ctrl/Cmd + D`                           | Duplicate selected classroom object                          |
| `Ctrl/Cmd + S`                           | Synchronize immediately                                      |
| Arrow keys                               | Nudge selected item by one logical pixel                     |
| Shift + arrow keys                       | Nudge by ten logical pixels                                  |
| `Escape`                                 | Clear selection or cancel the current tool                   |

Do not fire editor shortcuts while the user is typing in an input, textarea, or content-editable element.

### Grid and zoom

- Grid is visual and optional.
- Snap-to-grid is stored per arrangement.
- Support zoom controls and fit-to-screen.
- Set practical minimum and maximum zoom values.
- Zoom is view state and does not need to be persisted as domain data.
- Panning may be implemented with a modifier key or dedicated interaction if needed, but must not conflict with object dragging.

### History

Implement command/snapshot history within the editor store.

- Pointer-move frames must not each create a history entry.
- A completed drag or transform creates one entry.
- Text/property editing should be coalesced sensibly.
- Limit history to a reasonable number such as 100 entries.
- Undo/redo changes are persisted and synchronized like other edits.
- History itself is session state and is not persisted.

## 15. UI and accessibility

- Desktop-first target, with a documented minimum supported viewport such as 1024 pixels wide.
- The non-canvas application UI must be keyboard accessible.
- Every icon-only control needs an accessible label and tooltip.
- Do not communicate sync state, selection, or errors using colour alone.
- Dialogs must trap focus and return focus to their trigger.
- Provide textual actions for placing/removing students in addition to drag-and-drop.
- Use sufficiently large avatar labels and maintain contrast over arbitrary object colours.
- Respect reduced-motion preferences.
- Provide an unsupported-small-screen message rather than a broken mobile editor.

## 16. Error handling

Define typed application errors rather than exposing raw fetch errors:

```ts
type PersistenceErrorCode =
  | "offline"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "invalid_document"
  | "quota_exceeded"
  | "rate_limited"
  | "unknown";
```

Requirements:

- Preserve local changes on every remote error.
- Retry transient network, rate-limit, and server errors with bounded exponential backoff and jitter.
- Do not retry authorization or validation errors indefinitely.
- Show user-readable recovery actions.
- Keep technical detail available for development logging without displaying student data in logs.
- Never log access tokens, full class documents, avatars, or student notes.

## 17. MVP verification strategy

Automated unit, component, and browser tests are not required for the MVP. Each milestone must still pass formatting, linting, strict type-checking, and a production build. Manually verify the affected workflows before review.

Use this critical-path checklist as features become available:

1. Sign in/authorize and create the first class.
2. Add students with and without photos.
3. Create a blank arrangement, add objects, and place students.
4. Reload and verify local/remote restoration.
5. Duplicate an arrangement and modify it independently.
6. Attempt to delete a placed student and verify blocking/navigation.
7. Remove the student from all arrangements and delete successfully.
8. Edit offline, reconnect, and verify synchronization.

## 18. Implementation milestones

Build in vertical slices. Every milestone should leave the repository formatting, linting, type-checking, and building successfully.

### Milestone 0: foundation

- Create Vite React TypeScript project.
- Configure Tailwind, aliases, linting, and formatting.
- Manually add only the shadcn primitives currently required.
- Add application shell, router, error boundary, and environment validation.
- Add CI commands for formatting, type-checking, linting, and production builds.

Acceptance criteria:

- App starts and production build succeeds.
- Unknown routes render a useful not-found page.
- Verification commands run in CI/non-interactive mode.

### Milestone 1: domain and local persistence

- Implement types, Zod schemas, invariants, and V1 envelopes.
- Implement IndexedDB schema and repository.
- Build classes and student-roster screens against local persistence.
- Implement initials avatars without photo upload first.

Acceptance criteria:

- Classes and students survive reloads.
- Invalid persisted documents do not crash the app.
- A referenced student cannot be deleted.

### Milestone 2: arrangement management

- Implement arrangement list and active arrangement.
- Support blank creation, duplication, rename, and deletion.
- Create editor route and store with undo/redo command handling.

Acceptance criteria:

- Duplicate produces independent object/placement IDs where applicable.
- Both blank and duplicate flows are equally discoverable.
- Arrangement changes survive reloads.

### Milestone 3: canvas editor

- Implement fixed logical canvas and responsive scaling.
- Add rectangle, circle, and text tools.
- Add selection, drag, resize, rotation, labels, lock, duplicate, delete, and layer controls.
- Add keyboard shortcuts, grid, snapping, zoom, and fit-to-screen.

Acceptance criteria:

- Saved domain JSON contains no Konva-specific serialization.
- Drag/transform operations each create one undo step.
- Locked objects cannot be accidentally edited.

### Milestone 4: student placements and avatars

- Add unplaced/placed roster panel.
- Add drag and button-based placement controls.
- Render avatar/initials plus first name.
- Add student inspector and remove-from-arrangement action.
- Add photo crop, WebP conversion, local avatar persistence, and fallback handling.

Acceptance criteria:

- A student cannot appear twice in an arrangement.
- A failed avatar load falls back without breaking the editor.
- Deleting a referenced student explains which arrangements must be updated.

### Milestone 5: Google technical spike

Complete this before relying on Drive for product data, and keep the spike behind the repository interface.

- Configure Google Cloud project, OAuth consent screen, authorized JavaScript origins, and Drive API.
- Implement authentication and Drive authorization.
- Create, find, read, update, and delete a test JSON file in `appDataFolder`.
- Upload and retrieve a processed avatar.
- Test deployed-origin authorization, token expiry, prompt cancellation, and reconnect.

Acceptance criteria:

- Only the `drive.appdata` Drive scope is requested.
- No secret or access token is committed or persisted.
- The spike works on the real deployed origin.

### Milestone 6: synchronized persistence

- Implement Google Drive repository.
- Implement versioned cloud-snapshot lifecycle.
- Implement synchronized repository, global dirty metadata, status, debounce, merge, and reconnect.
- Add tab coordination and deterministic last-write-wins merging.
- Replace local-only screen wiring with synchronized persistence.

Acceptance criteria:

- UI edits remain instant under slow network conditions.
- Offline edits survive reload and synchronize later.
- A failed Drive write cannot erase the local document.
- A stale tab cannot silently overwrite newer data.

### Milestone 7: hardening

- Complete error and empty states.
- Add account disconnect and delete-local-data flows.
- Perform accessibility and keyboard review.
- Add privacy-focused logging rules.
- Manually verify all critical paths from section 17.
- Add README setup, Google Cloud configuration, architecture, and deployment documentation.

Acceptance criteria:

- Formatting, type-checking, linting, and the production build all pass.
- No known path loses locally saved work.
- A new developer can configure the project from the README.

## 19. Definition of done

The initial Classkit feature is done when a teacher can:

1. Open the deployed static application on a desktop browser.
2. Sign in with Google and grant narrow Classkit Drive access.
3. Create a class and add students with optional avatars.
4. Create a classroom arrangement from blank.
5. Draw and label classroom objects.
6. Place every student once or leave selected students unplaced.
7. Move, resize, rotate, lock, duplicate, layer, and remove relevant items.
8. See changes autosave locally and synchronize to Drive.
9. Reload the application and recover the arrangement.
10. Duplicate the arrangement and edit the copy independently.
11. Set an arrangement as active.
12. Be prevented from deleting a student still used by an arrangement.
13. Continue editing cached data through a temporary network/auth interruption and synchronize after reconnecting.

## 20. Instructions for Codex

When implementing this plan:

- Read this entire file and the existing repository instructions before changing files.
- Inspect the worktree before scaffolding; preserve unrelated user changes.
- Work milestone by milestone, in order, unless the user requests a narrower slice.
- At the start of a milestone, briefly state its goal and likely files.
- Keep changes reviewable; do not attempt all milestones in one unreviewable patch.
- Keep domain invariants in pure functions so they can be reviewed independently of UI wiring.
- Add only the shadcn components needed by the current milestone, using copied source files.
- Keep Google, IndexedDB, React, and Konva concerns behind their intended boundaries.
- Do not fabricate Google credentials. Add setup documentation and `.env.example`, then report what the user must configure.
- Run formatting, type-checking, linting, and a production build after each completed milestone.
- Report exact verification results and any remaining limitation.
- Stop and ask before making a choice that materially contradicts this specification.
