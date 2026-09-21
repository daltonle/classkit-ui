import type {
  LayoutObject,
  SeatingArrangement,
} from "@/domain/seating-layout/seating-layout.schema";
import type { EditorCommand } from "@/features/seating-editor/store/editor-store";
import {
  placeStudent,
  removeStudentPlacement,
} from "@/domain/seating-layout/seating-layout";

export type ObjectTool = "rectangle" | "circle" | "text";
const REACHABLE_MARGIN = 20;

function timestamp() {
  return new Date().toISOString();
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function constrainObjectPosition(
  object: LayoutObject,
  x: number,
  y: number,
  canvas: SeatingArrangement["canvas"],
) {
  if (object.type === "rectangle") {
    return {
      x: clamp(
        x,
        -object.width + REACHABLE_MARGIN,
        canvas.width - REACHABLE_MARGIN,
      ),
      y: clamp(
        y,
        -object.height + REACHABLE_MARGIN,
        canvas.height - REACHABLE_MARGIN,
      ),
    };
  }
  if (object.type === "circle") {
    return {
      x: clamp(
        x,
        -object.radius + REACHABLE_MARGIN,
        canvas.width + object.radius - REACHABLE_MARGIN,
      ),
      y: clamp(
        y,
        -object.radius + REACHABLE_MARGIN,
        canvas.height + object.radius - REACHABLE_MARGIN,
      ),
    };
  }
  return {
    x: clamp(x, 0, canvas.width - REACHABLE_MARGIN),
    y: clamp(y, 0, canvas.height - REACHABLE_MARGIN),
  };
}

export function createObject(
  arrangement: SeatingArrangement,
  type: ObjectTool,
  x: number,
  y: number,
): LayoutObject {
  const base = {
    id: crypto.randomUUID(),
    x,
    y,
    rotation: 0,
    locked: false,
    fill: type === "text" ? "#0f172a" : "#bae6fd",
    zIndex: arrangement.objects.length,
  };
  if (type === "rectangle") return { ...base, type, width: 180, height: 100 };
  if (type === "circle") return { ...base, type, radius: 60 };
  return { ...base, type, text: "Text", fontSize: 28 };
}

function withObjects(
  arrangement: SeatingArrangement,
  objects: LayoutObject[],
): SeatingArrangement {
  return {
    ...arrangement,
    objects: objects.map((object, zIndex) => ({ ...object, zIndex })),
    updatedAt: timestamp(),
  };
}

export function addObjectCommand(object: LayoutObject): EditorCommand {
  return {
    name: `Add ${object.type}`,
    apply: (arrangement) =>
      withObjects(arrangement, [...arrangement.objects, object]),
  };
}

export function updateObjectCommand(
  objectId: string,
  changes: Partial<LayoutObject>,
  name = "Update object",
): EditorCommand {
  return {
    name,
    apply: (arrangement) => {
      const target = arrangement.objects.find(({ id }) => id === objectId);
      if (
        !target ||
        Object.entries(changes).every(
          ([key, value]) => target[key as keyof LayoutObject] === value,
        )
      ) {
        return arrangement;
      }
      return withObjects(
        arrangement,
        arrangement.objects.map((object) =>
          object.id === objectId
            ? ({ ...object, ...changes } as LayoutObject)
            : object,
        ),
      );
    },
  };
}

export function deleteObjectCommand(objectId: string): EditorCommand {
  return {
    name: "Delete object",
    apply: (arrangement) =>
      withObjects(
        arrangement,
        arrangement.objects.filter(({ id }) => id !== objectId),
      ),
  };
}

export function duplicateObjectCommand(objectId: string): EditorCommand {
  return {
    name: "Duplicate object",
    apply: (arrangement) => {
      const source = arrangement.objects.find(({ id }) => id === objectId);
      if (!source) return arrangement;
      const draftDuplicate = {
        ...structuredClone(source),
        id: crypto.randomUUID(),
        x: source.x + 24,
        y: source.y + 24,
        locked: false,
        zIndex: arrangement.objects.length,
      };
      const duplicate = {
        ...draftDuplicate,
        ...constrainObjectPosition(
          draftDuplicate,
          draftDuplicate.x,
          draftDuplicate.y,
          arrangement.canvas,
        ),
      };
      return withObjects(arrangement, [...arrangement.objects, duplicate]);
    },
  };
}

export type LayerAction = "forward" | "backward" | "front" | "back";

export function layerObjectCommand(
  objectId: string,
  action: LayerAction,
): EditorCommand {
  return {
    name: "Reorder object",
    apply: (arrangement) => {
      const objects = [...arrangement.objects].sort(
        (a, b) => a.zIndex - b.zIndex,
      );
      const index = objects.findIndex(({ id }) => id === objectId);
      if (index < 0) return arrangement;
      const [object] = objects.splice(index, 1);
      if (!object) return arrangement;
      const target =
        action === "front"
          ? objects.length
          : action === "back"
            ? 0
            : action === "forward"
              ? Math.min(index + 1, objects.length)
              : Math.max(index - 1, 0);
      objects.splice(target, 0, object);
      return withObjects(arrangement, objects);
    },
  };
}

export function updateCanvasCommand(
  changes: Partial<SeatingArrangement["canvas"]>,
): EditorCommand {
  return {
    name: "Update canvas",
    apply: (arrangement) => ({
      ...arrangement,
      canvas: { ...arrangement.canvas, ...changes },
      updatedAt: timestamp(),
    }),
  };
}

export function snapCoordinate(
  value: number,
  gridSize: number,
  enabled: boolean,
) {
  return enabled ? Math.round(value / gridSize) * gridSize : value;
}

export function constrainStudentPosition(
  x: number,
  y: number,
  canvas: SeatingArrangement["canvas"],
) {
  return {
    x: clamp(x, 0, canvas.width),
    y: clamp(y, 0, canvas.height),
  };
}

export function placeStudentCommand(
  studentId: string,
  x: number,
  y: number,
): EditorCommand {
  return {
    name: "Place student",
    apply: (arrangement) =>
      placeStudent(arrangement, {
        studentId,
        ...constrainStudentPosition(x, y, arrangement.canvas),
      }),
  };
}

export function moveStudentCommand(
  studentId: string,
  x: number,
  y: number,
): EditorCommand {
  return {
    name: "Move student",
    apply: (arrangement) => ({
      ...arrangement,
      studentPlacements: arrangement.studentPlacements.map((placement) =>
        placement.studentId === studentId
          ? {
              ...placement,
              ...constrainStudentPosition(x, y, arrangement.canvas),
            }
          : placement,
      ),
      updatedAt: timestamp(),
    }),
  };
}

export function removeStudentCommand(studentId: string): EditorCommand {
  return {
    name: "Remove student from arrangement",
    apply: (arrangement) => removeStudentPlacement(arrangement, studentId),
  };
}
