import { current } from "immer";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { SeatingArrangement } from "@/domain/seating-layout/seating-layout.schema";

const HISTORY_LIMIT = 100;

export type EditorCommand = {
  name: string;
  apply: (arrangement: SeatingArrangement) => SeatingArrangement;
};

export type EditorTool = "select" | "rectangle" | "circle" | "text";

type EditorState = {
  classId?: string;
  arrangement?: SeatingArrangement;
  past: SeatingArrangement[];
  future: SeatingArrangement[];
  selectedObjectId?: string;
  selectedStudentId?: string;
  activeTool: EditorTool;
  zoom: number;
  initialize: (classId: string, arrangement: SeatingArrangement) => void;
  execute: (command: EditorCommand) => void;
  undo: () => void;
  redo: () => void;
  selectObject: (objectId?: string) => void;
  selectStudent: (studentId?: string) => void;
  setActiveTool: (tool: EditorTool) => void;
  setZoom: (zoom: number) => void;
  reset: () => void;
};

export const useEditorStore = create<EditorState>()(
  immer((set) => ({
    past: [],
    future: [],
    activeTool: "select",
    zoom: 1,
    initialize: (classId, arrangement) =>
      set({
        classId,
        arrangement: structuredClone(arrangement),
        past: [],
        future: [],
        selectedObjectId: undefined,
        selectedStudentId: undefined,
        activeTool: "select",
        zoom: 1,
      }),
    execute: (command) =>
      set((state) => {
        if (!state.arrangement) return;
        const snapshot = structuredClone(current(state.arrangement));
        const next = command.apply(structuredClone(snapshot));
        if (
          next === state.arrangement ||
          JSON.stringify(next) === JSON.stringify(snapshot)
        )
          return;
        state.past.push(snapshot);
        if (state.past.length > HISTORY_LIMIT) state.past.shift();
        state.arrangement = structuredClone(next);
        state.future = [];
      }),
    undo: () =>
      set((state) => {
        const previous = state.past.pop();
        if (!previous || !state.arrangement) return;
        state.future.unshift(structuredClone(current(state.arrangement)));
        state.arrangement = previous;
      }),
    redo: () =>
      set((state) => {
        const next = state.future.shift();
        if (!next || !state.arrangement) return;
        state.past.push(structuredClone(current(state.arrangement)));
        state.arrangement = next;
      }),
    selectObject: (selectedObjectId) =>
      set({ selectedObjectId, selectedStudentId: undefined }),
    selectStudent: (selectedStudentId) =>
      set({ selectedStudentId, selectedObjectId: undefined }),
    setActiveTool: (activeTool) => set({ activeTool }),
    setZoom: (zoom) => set({ zoom: Math.min(2, Math.max(0.25, zoom)) }),
    reset: () =>
      set({
        classId: undefined,
        arrangement: undefined,
        past: [],
        future: [],
        selectedObjectId: undefined,
        selectedStudentId: undefined,
        activeTool: "select",
        zoom: 1,
      }),
  })),
);
