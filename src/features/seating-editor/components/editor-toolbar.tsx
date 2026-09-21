import { Circle, MousePointer2, Square, Type } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  useEditorStore,
  type EditorTool,
} from "@/features/seating-editor/store/editor-store";

const tools: Array<{
  id: EditorTool;
  label: string;
  icon: typeof MousePointer2;
}> = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "rectangle", label: "Rectangle", icon: Square },
  { id: "circle", label: "Circle", icon: Circle },
  { id: "text", label: "Text", icon: Type },
];

export function EditorToolbar() {
  const activeTool = useEditorStore((state) => state.activeTool);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);

  return (
    <aside
      className="rounded-xl border border-slate-200 bg-white p-2"
      aria-label="Editor tools"
    >
      <div className="space-y-2">
        {tools.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            variant={activeTool === id ? "default" : "ghost"}
            className="h-auto w-full flex-col gap-1 px-1 py-2 text-[11px]"
            aria-pressed={activeTool === id}
            title={label}
            onClick={() => setActiveTool(id)}
          >
            <Icon aria-hidden="true" className="size-5" />
            {label}
          </Button>
        ))}
      </div>
    </aside>
  );
}
