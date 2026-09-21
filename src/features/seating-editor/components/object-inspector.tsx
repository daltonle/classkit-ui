import { Copy, Lock, Trash2, Unlock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LayoutObject } from "@/domain/seating-layout/seating-layout.schema";
import {
  deleteObjectCommand,
  duplicateObjectCommand,
  layerObjectCommand,
  updateObjectCommand,
} from "@/features/seating-editor/model/object-commands";
import { useEditorStore } from "@/features/seating-editor/store/editor-store";

export function ObjectInspector() {
  const arrangement = useEditorStore((state) => state.arrangement);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const execute = useEditorStore((state) => state.execute);
  const selectObject = useEditorStore((state) => state.selectObject);
  const object = arrangement?.objects.find(({ id }) => id === selectedObjectId);

  if (!object) {
    return (
      <aside className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Arrangement</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Choose a tool to add an object, or select an object to edit its
          properties.
        </p>
        <dl className="mt-5 space-y-3 text-sm">
          <div>
            <dt className="text-slate-500">Objects</dt>
            <dd className="font-medium">{arrangement?.objects.length ?? 0}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Grid</dt>
            <dd className="font-medium">
              {arrangement?.canvas.snapToGrid ? "Visible with snapping" : "Off"}
            </dd>
          </div>
        </dl>
      </aside>
    );
  }
  const selectedObject = object;

  function update(changes: Partial<LayoutObject>, name?: string) {
    execute(updateObjectCommand(selectedObject.id, changes, name));
  }

  function remove() {
    if (selectedObject.locked) return;
    execute(deleteObjectCommand(selectedObject.id));
    selectObject(undefined);
  }

  function duplicate() {
    execute(duplicateObjectCommand(selectedObject.id));
    const next = useEditorStore.getState().arrangement?.objects.at(-1);
    selectObject(next?.id);
  }

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold capitalize">{object.type}</h2>
        <span className="text-xs text-slate-500">
          Layer {object.zIndex + 1}
        </span>
      </div>

      <div className="mt-5 space-y-5">
        {object.type === "text" ? (
          <div className="space-y-2">
            <Label htmlFor="object-text">Text</Label>
            <Input
              id="object-text"
              key={`${object.id}-text-${object.text}`}
              defaultValue={object.text}
              onBlur={(event) =>
                update({ text: event.target.value }, "Edit text")
              }
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="object-label">Label (optional)</Label>
            <Input
              id="object-label"
              key={`${object.id}-label-${object.label ?? ""}`}
              defaultValue={object.label ?? ""}
              onBlur={(event) =>
                update({ label: event.target.value || undefined }, "Edit label")
              }
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="object-fill">Fill colour</Label>
          <div className="flex gap-2">
            <Input
              id="object-fill"
              type="color"
              className="w-14 p-1"
              value={object.fill}
              onChange={(event) =>
                update({ fill: event.target.value }, "Change fill")
              }
            />
            <Input
              aria-label="Fill colour value"
              key={`${object.id}-${object.fill}`}
              defaultValue={object.fill}
              onBlur={(event) => {
                if (event.target.value.trim())
                  update({ fill: event.target.value }, "Change fill");
              }}
            />
          </div>
        </div>

        <Button
          className="w-full"
          variant="outline"
          onClick={() =>
            update(
              { locked: !object.locked },
              object.locked ? "Unlock object" : "Lock object",
            )
          }
        >
          {object.locked ? (
            <Unlock aria-hidden="true" className="size-4" />
          ) : (
            <Lock aria-hidden="true" className="size-4" />
          )}
          {object.locked ? "Unlock object" : "Lock object"}
        </Button>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-800">Layer order</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => execute(layerObjectCommand(object.id, "front"))}
            >
              To front
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => execute(layerObjectCommand(object.id, "forward"))}
            >
              Forward
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => execute(layerObjectCommand(object.id, "backward"))}
            >
              Backward
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => execute(layerObjectCommand(object.id, "back"))}
            >
              To back
            </Button>
          </div>
        </div>

        <div className="flex gap-2 border-t border-slate-200 pt-4">
          <Button
            className="flex-1"
            size="sm"
            variant="outline"
            onClick={duplicate}
          >
            <Copy aria-hidden="true" className="size-4" /> Duplicate
          </Button>
          <Button
            className="flex-1"
            size="sm"
            variant="destructive"
            disabled={object.locked}
            onClick={remove}
          >
            <Trash2 aria-hidden="true" className="size-4" /> Delete
          </Button>
        </div>
      </div>
    </aside>
  );
}
