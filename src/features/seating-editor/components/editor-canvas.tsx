import Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  Group,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";

import type {
  LayoutObject,
  SeatingArrangement,
} from "@/domain/seating-layout/seating-layout.schema";
import type { Student } from "@/domain/student/student.schema";
import { studentInitials } from "@/domain/student/student";
import {
  addObjectCommand,
  constrainObjectPosition,
  createObject,
  snapCoordinate,
  updateObjectCommand,
  moveStudentCommand,
} from "@/features/seating-editor/model/object-commands";
import { useEditorStore } from "@/features/seating-editor/store/editor-store";

function useWorkspaceSize(container: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 900, height: 600 });
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [container]);
  return size;
}

export function EditorCanvas({
  arrangement,
  students,
}: {
  arrangement: SeatingArrangement;
  students: Student[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const shapeRefs = useRef(new Map<string, Konva.Node>());
  const size = useWorkspaceSize(containerRef);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const selectedStudentId = useEditorStore((state) => state.selectedStudentId);
  const activeTool = useEditorStore((state) => state.activeTool);
  const zoom = useEditorStore((state) => state.zoom);
  const execute = useEditorStore((state) => state.execute);
  const selectObject = useEditorStore((state) => state.selectObject);
  const selectStudent = useEditorStore((state) => state.selectStudent);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);
  const fitScale = Math.min(
    (size.width - 64) / arrangement.canvas.width,
    (size.height - 64) / arrangement.canvas.height,
    1,
  );
  const scale = Math.max(0.1, fitScale * zoom);
  const offsetX = (size.width - arrangement.canvas.width * scale) / 2;
  const offsetY = (size.height - arrangement.canvas.height * scale) / 2;

  useEffect(() => {
    const transformer = transformerRef.current;
    const selectedObject = arrangement.objects.find(
      ({ id }) => id === selectedObjectId,
    );
    const node =
      selectedObjectId && !selectedObject?.locked
        ? shapeRefs.current.get(selectedObjectId)
        : undefined;
    transformer?.nodes(node ? [node] : []);
    transformer?.getLayer()?.batchDraw();
  }, [arrangement.objects, selectedObjectId]);

  const gridLines = useMemo(() => {
    if (!arrangement.canvas.snapToGrid) return [];
    const lines: Array<{ points: number[]; key: string }> = [];
    for (
      let x = arrangement.canvas.gridSize;
      x < arrangement.canvas.width;
      x += arrangement.canvas.gridSize
    ) {
      lines.push({
        key: `x-${x}`,
        points: [x, 0, x, arrangement.canvas.height],
      });
    }
    for (
      let y = arrangement.canvas.gridSize;
      y < arrangement.canvas.height;
      y += arrangement.canvas.gridSize
    ) {
      lines.push({
        key: `y-${y}`,
        points: [0, y, arrangement.canvas.width, y],
      });
    }
    return lines;
  }, [arrangement.canvas]);

  function select(event: KonvaEventObject<MouseEvent>, object: LayoutObject) {
    event.cancelBubble = true;
    selectObject(object.id);
    setActiveTool("select");
  }

  function finishDrag(
    event: KonvaEventObject<DragEvent>,
    object: LayoutObject,
  ) {
    const position = constrainObjectPosition(
      object,
      snapCoordinate(
        event.target.x(),
        arrangement.canvas.gridSize,
        arrangement.canvas.snapToGrid,
      ),
      snapCoordinate(
        event.target.y(),
        arrangement.canvas.gridSize,
        arrangement.canvas.snapToGrid,
      ),
      arrangement.canvas,
    );
    event.target.position(position);
    execute(updateObjectCommand(object.id, position, "Move object"));
  }

  function finishTransform(
    event: KonvaEventObject<Event>,
    object: LayoutObject,
  ) {
    const node = event.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scale({ x: 1, y: 1 });
    const dimensions =
      object.type === "rectangle"
        ? {
            width: Math.max(20, object.width * scaleX),
            height: Math.max(20, object.height * scaleY),
          }
        : object.type === "circle"
          ? {
              radius: Math.max(10, object.radius * Math.max(scaleX, scaleY)),
            }
          : { fontSize: Math.max(10, object.fontSize * scaleX) };
    const transformedObject = { ...object, ...dimensions } as LayoutObject;
    const position = constrainObjectPosition(
      transformedObject,
      node.x(),
      node.y(),
      arrangement.canvas,
    );
    const changes = { ...dimensions, ...position, rotation: node.rotation() };
    execute(updateObjectCommand(object.id, changes, "Transform object"));
  }

  function addObject(event: KonvaEventObject<MouseEvent | TouchEvent>) {
    const isCanvasBackground = event.target.name() === "canvas-background";
    if (activeTool === "select") {
      selectObject(undefined);
      return;
    }
    if (!isCanvasBackground) return;
    const pointer = event.target.getStage()?.getPointerPosition();
    if (!pointer) return;
    const x = snapCoordinate(
      (pointer.x - offsetX) / scale,
      arrangement.canvas.gridSize,
      arrangement.canvas.snapToGrid,
    );
    const y = snapCoordinate(
      (pointer.y - offsetY) / scale,
      arrangement.canvas.gridSize,
      arrangement.canvas.snapToGrid,
    );
    const object = createObject(arrangement, activeTool, x, y);
    execute(addObjectCommand(object));
    selectObject(object.id);
    setActiveTool("select");
  }

  function commonProps(object: LayoutObject) {
    return {
      id: `object-${object.id}`,
      ref: (node: Konva.Node | null) => {
        if (node) shapeRefs.current.set(object.id, node);
        else shapeRefs.current.delete(object.id);
      },
      x: object.x,
      y: object.y,
      rotation: object.rotation,
      fill: object.fill,
      draggable: !object.locked,
      onMouseDown: (event: KonvaEventObject<MouseEvent>) =>
        select(event, object),
      onTap: (event: KonvaEventObject<TouchEvent>) => {
        event.cancelBubble = true;
        selectObject(object.id);
      },
      onDragEnd: (event: KonvaEventObject<DragEvent>) =>
        finishDrag(event, object),
      onTransformEnd: (event: KonvaEventObject<Event>) =>
        finishTransform(event, object),
      stroke: selectedObjectId === object.id ? "#0284c7" : "#64748b",
      strokeWidth: selectedObjectId === object.id ? 3 : 1,
    };
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden bg-slate-200"
    >
      <Stage
        width={size.width}
        height={size.height}
        onMouseDown={addObject}
        onTap={addObject}
      >
        <Layer x={offsetX} y={offsetY} scaleX={scale} scaleY={scale}>
          <Rect
            name="canvas-background"
            width={arrangement.canvas.width}
            height={arrangement.canvas.height}
            fill={arrangement.canvas.backgroundColor}
            shadowColor="#0f172a"
            shadowBlur={18 / scale}
            shadowOpacity={0.2}
          />
          {gridLines.map((line) => (
            <Line
              key={line.key}
              points={line.points}
              stroke="#cbd5e1"
              strokeWidth={1 / scale}
              listening={false}
            />
          ))}
          {[...arrangement.objects]
            .sort((left, right) => left.zIndex - right.zIndex)
            .map((object) => {
              const props = commonProps(object);
              if (object.type === "rectangle")
                return (
                  <Fragment key={object.id}>
                    <Rect
                      {...props}
                      width={object.width}
                      height={object.height}
                      cornerRadius={4}
                    />
                    {object.label ? (
                      <Text
                        x={object.x}
                        y={object.y + object.height / 2 - 9}
                        width={object.width}
                        text={object.label}
                        align="center"
                        fontSize={16}
                        fill="#0f172a"
                        rotation={object.rotation}
                        listening={false}
                      />
                    ) : null}
                  </Fragment>
                );
              if (object.type === "circle")
                return (
                  <Fragment key={object.id}>
                    <Circle {...props} radius={object.radius} />
                    {object.label ? (
                      <Text
                        x={object.x - object.radius}
                        y={object.y - 9}
                        width={object.radius * 2}
                        text={object.label}
                        align="center"
                        fontSize={16}
                        fill="#0f172a"
                        rotation={object.rotation}
                        listening={false}
                      />
                    ) : null}
                  </Fragment>
                );
              return (
                <Text
                  key={object.id}
                  {...props}
                  text={object.text}
                  fontSize={object.fontSize}
                  padding={4}
                />
              );
            })}
          {arrangement.studentPlacements.map((placement) => {
            const student = students.find(
              ({ id }) => id === placement.studentId,
            );
            if (!student) return null;
            const selected = selectedStudentId === student.id;
            return (
              <Group
                key={student.id}
                x={placement.x}
                y={placement.y}
                draggable
                onMouseDown={(event) => {
                  event.cancelBubble = true;
                  selectStudent(student.id);
                }}
                onTap={(event) => {
                  event.cancelBubble = true;
                  selectStudent(student.id);
                }}
                onDragEnd={(event) =>
                  execute(
                    moveStudentCommand(
                      student.id,
                      event.target.x(),
                      event.target.y(),
                    ),
                  )
                }
              >
                <Circle
                  radius={30}
                  fill={student.avatarColor}
                  stroke={selected ? "#0284c7" : "#ffffff"}
                  strokeWidth={selected ? 4 : 2}
                />
                <Text
                  x={-30}
                  y={-8}
                  width={60}
                  text={studentInitials(student)}
                  align="center"
                  fontSize={16}
                  fontStyle="bold"
                  fill="#ffffff"
                  listening={false}
                />
                <Text
                  x={-45}
                  y={35}
                  width={90}
                  text={student.firstName}
                  align="center"
                  fontSize={14}
                  fill="#0f172a"
                  listening={false}
                />
              </Group>
            );
          })}
          <Transformer
            ref={transformerRef}
            rotateEnabled
            flipEnabled={false}
            enabledAnchors={[
              "top-left",
              "top-right",
              "bottom-left",
              "bottom-right",
              "middle-left",
              "middle-right",
              "top-center",
              "bottom-center",
            ]}
            boundBoxFunc={(oldBox, newBox) =>
              Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 20
                ? oldBox
                : newBox
            }
          />
        </Layer>
      </Stage>
    </div>
  );
}
