import { useEffect } from "react";

import {
  constrainObjectPosition,
  deleteObjectCommand,
  duplicateObjectCommand,
  updateObjectCommand,
} from "@/features/seating-editor/model/object-commands";
import { useEditorStore } from "@/features/seating-editor/store/editor-store";

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function useEditorShortcuts(onSave: () => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      const state = useEditorStore.getState();
      const selected = state.arrangement?.objects.find(
        ({ id }) => id === state.selectedObjectId,
      );
      const modifier = event.metaKey || event.ctrlKey;

      if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        onSave();
        return;
      }
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        state.redo();
        return;
      }
      if (modifier && event.key.toLowerCase() === "d" && selected) {
        event.preventDefault();
        state.execute(duplicateObjectCommand(selected.id));
        state.selectObject(
          useEditorStore.getState().arrangement?.objects.at(-1)?.id,
        );
        return;
      }
      if (event.key === "Escape") {
        state.selectObject(undefined);
        state.setActiveTool("select");
        return;
      }
      if (
        selected &&
        !selected.locked &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        event.preventDefault();
        state.execute(deleteObjectCommand(selected.id));
        state.selectObject(undefined);
        return;
      }
      if (
        selected &&
        !selected.locked &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
      ) {
        event.preventDefault();
        const distance = event.shiftKey ? 10 : 1;
        const x =
          selected.x +
          (event.key === "ArrowLeft"
            ? -distance
            : event.key === "ArrowRight"
              ? distance
              : 0);
        const y =
          selected.y +
          (event.key === "ArrowUp"
            ? -distance
            : event.key === "ArrowDown"
              ? distance
              : 0);
        const canvas = state.arrangement?.canvas;
        if (!canvas) return;
        const position = constrainObjectPosition(selected, x, y, canvas);
        state.execute(
          updateObjectCommand(selected.id, position, "Nudge object"),
        );
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSave]);
}
