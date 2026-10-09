"use client";

import { useMemo, useRef, useState } from "react";
import { Field, Panel, StudioShell, ToolButton } from "@/components/studio/StudioShell";
import { getApp } from "@/lib/apps";
import { useHistory } from "@/lib/history";
import { downloadBlob, downloadDataUrl, readFileAsDataUrl, uid } from "@/lib/id";

type Tool = "select" | "direct" | "pen" | "rect" | "ellipse" | "line" | "text" | "hand";

type VecNode = {
  id: string;
  type: "rect" | "ellipse" | "line" | "path" | "text" | "image" | "polygon";
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  name: string;
  points?: { x: number; y: number }[];
  text?: string;
  fontSize?: number;
  href?: string;
  effect?: "none" | "glow" | "shadow" | "repeat" | "envelope";
  repeat?: number;
};

type VecDoc = {
  name: string;
  width: number;
  height: number;
  objects: VecNode[];
  selectedId: string | null;
};

const app = getApp("vector")!;

const TRACE_PRESETS = [
  "Poster",
  "Sketch",
  "Logo",
  "Photo",
  "Low-fi",
  "High-fi",
  "2-color",
  "8-color",
  "16-color",
  "Silhouette",
  "Stamp",
  "Comic",
] as const;

function starter(): VecDoc {
  return {
    name: "Artboard 1",
    width: 1200,
    height: 800,
    selectedId: "title",
    objects: [
      {
        id: "bg",
        type: "rect",
        name: "Ground",
        x: 0,
        y: 0,
        w: 1200,
        h: 800,
        rotation: 0,
        fill: "#14121a",
        stroke: "none",
        strokeWidth: 0,
        opacity: 1,
        visible: true,
        locked: true,
      },
      {
        id: "orb",
        type: "ellipse",
        name: "Orb",
        x: 430,
        y: 180,
        w: 340,
        h: 340,
        rotation: 0,
        fill: "#e8a87c",
        stroke: "#f3eee4",
        strokeWidth: 0,
        opacity: 1,
        visible: true,
        locked: false,
        effect: "glow",
      },
      {
        id: "title",
        type: "text",
        name: "Title",
        x: 360,
        y: 340,
        w: 480,
        h: 80,
        rotation: 0,
        fill: "#0b0b0c",
        stroke: "none",
        strokeWidth: 0,
        opacity: 1,
        visible: true,
        locked: false,
        text: "VECTOR",
        fontSize: 72,
      },
    ],
  };
}

export function VectorApp() {
  const { state: doc, setState, undo, redo } = useHistory<VecDoc>(starter());
  const [tool, setTool] = useState<Tool>("select");
  const [menu, setMenu] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const [pen, setPen] = useState<{ x: number; y: number }[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: string; x: number; y: number; ox: number; oy: number } | null>(null);

  const selected = useMemo(
    () => doc.objects.find((item) => item.id === doc.selectedId) ?? null,
    [doc.objects, doc.selectedId],
  );

  const patch = (id: string, next: Partial<VecNode>) => {
    setState((current) => ({
      ...current,
      objects: current.objects.map((item) => (item.id === id ? { ...item, ...next } : item)),
    }));
  };

  const add = (node: VecNode) => {
    setState((current) => ({
      ...current,
      objects: [...current.objects, node],
      selectedId: node.id,
    }));
  };

  const exportSvg = () => {
    const markup = svgRef.current?.outerHTML ?? "";
    downloadBlob(new Blob([markup], { type: "image/svg+xml" }), `${doc.name}.svg`);
  };

  const exportPng = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = doc.width;
      canvas.height = doc.height;
      canvas.getContext("2d")?.drawImage(image, 0, 0);
      downloadDataUrl(canvas.toDataURL("image/png"), `${doc.name}.png`);
      URL.revokeObjectURL(url);
    };
    image.src = url;
  };

  const exportJson = () => {
    downloadBlob(
      new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }),
      `${doc.name}.atelier.json`,
    );
  };

  const booleanOp = (mode: "unite" | "subtract" | "intersect" | "exclude") => {
    if (!selected) return;
    const other = [...doc.objects].reverse().find((item) => item.id !== selected.id && item.visible);
    if (!other) return;
    const x = Math.min(selected.x, other.x);
    const y = Math.min(selected.y, other.y);
    const r = Math.max(selected.x + selected.w, other.x + other.w);
    const b = Math.max(selected.y + selected.h, other.y + other.h);
    if (mode === "unite") {
      add({
        ...selected,
        id: uid("bool"),
        name: "Unite",
        type: "rect",
        x,
        y,
        w: r - x,
        h: b - y,
      });
    } else if (mode === "subtract") {
      patch(selected.id, {
        w: Math.max(40, selected.w - other.w / 2),
        h: Math.max(40, selected.h - other.h / 2),
        name: "Subtract",
      });
    } else if (mode === "intersect") {
      add({
        ...selected,
        id: uid("bool"),
        name: "Intersect",
        type: "rect",
        x: Math.max(selected.x, other.x),
        y: Math.max(selected.y, other.y),
        w: Math.max(
          20,
          Math.min(selected.x + selected.w, other.x + other.w) - Math.max(selected.x, other.x),
        ),
        h: Math.max(
          20,
          Math.min(selected.y + selected.h, other.y + other.h) - Math.max(selected.y, other.y),
        ),
      });
    } else {
      add({
        ...selected,
        id: uid("bool"),
        name: "Exclude",
        opacity: 0.55,
      });
    }
  };

  const traceImage = async (file: File, preset: string) => {
    const src = await readFileAsDataUrl(file);
    const image = new Image();
    await new Promise((resolve) => {
      image.onload = resolve;
      image.src = src;
    });
    const colors =
      preset.includes("2") ? 2 : preset.includes("8") ? 8 : preset.includes("16") ? 16 : 6;
    const cell = preset === "Low-fi" || preset === "Stamp" ? 28 : preset === "High-fi" ? 10 : 18;
    const canvas = document.createElement("canvas");
    const scale = 600 / image.width;
    canvas.width = 600;
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const nodes: VecNode[] = [];
    for (let y = 0; y < canvas.height; y += cell) {
      for (let x = 0; x < canvas.width; x += cell) {
        const i = (y * canvas.width + x) * 4;
        const r = data[i] ?? 0;
        const g = data[i + 1] ?? 0;
        const b = data[i + 2] ?? 0;
        const q = (channel: number) => Math.round(channel / (255 / (colors - 1))) * (255 / (colors - 1));
        const fill = `rgb(${q(r)}, ${q(g)}, ${q(b)})`;
        nodes.push({
          id: uid("tr"),
          type: "rect",
          name: "Trace",
          x: x + 40,
          y: y + 40,
          w: cell,
          h: cell,
          rotation: 0,
          fill,
          stroke: "none",
          strokeWidth: 0,
          opacity: preset === "Silhouette" ? (r + g + b > 380 ? 0 : 1) : 1,
          visible: true,
          locked: false,
        });
      }
    }
    setState((current) => ({
      ...current,
      objects: [...current.objects, ...nodes.filter((n) => n.opacity > 0)],
    }));
  };

  const onCanvasDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / zoom;
    const y = (event.clientY - rect.top) / zoom;
    if (tool === "rect" || tool === "ellipse" || tool === "line" || tool === "text") {
      add({
        id: uid(tool),
        type: tool === "text" ? "text" : tool,
        name: tool,
        x,
        y,
        w: tool === "line" ? 180 : 160,
        h: tool === "line" ? 0 : 110,
        rotation: 0,
        fill: tool === "text" ? "#f3eee4" : "#e8a87c",
        stroke: "#f3eee4",
        strokeWidth: tool === "line" ? 3 : 0,
        opacity: 1,
        visible: true,
        locked: false,
        text: tool === "text" ? "Type" : undefined,
        fontSize: 48,
      });
      return;
    }
    if (tool === "pen") {
      const next = [...pen, { x, y }];
      setPen(next);
      if (next.length > 1) {
        const existing = doc.objects.find((item) => item.id === "live-pen");
        const node: VecNode = {
          id: "live-pen",
          type: "path",
          name: "Pen path",
          x: 0,
          y: 0,
          w: doc.width,
          h: doc.height,
          rotation: 0,
          fill: "none",
          stroke: "#e8a87c",
          strokeWidth: 2,
          opacity: 1,
          visible: true,
          locked: false,
          points: next,
        };
        if (existing) patch("live-pen", { points: next });
        else add(node);
      }
    }
  };

  return (
    <StudioShell
      app={app}
      openMenu={menu}
      onOpenMenu={setMenu}
      status={`${doc.name} · ${doc.objects.length} objects · ${TRACE_PRESETS.length} trace presets`}
      menus={[
        {
          label: "File",
          items: [
            { label: "New artboard", onSelect: () => setState(starter()) },
            { label: "Place image…", onSelect: () => fileRef.current?.click() },
            { label: "Export SVG", onSelect: exportSvg },
            { label: "Export PNG", onSelect: exportPng },
            { label: "Save JSON", onSelect: exportJson },
          ],
        },
        {
          label: "Edit",
          items: [
            { label: "Undo", shortcut: "⌘Z", onSelect: undo },
            { label: "Redo", shortcut: "⇧⌘Z", onSelect: redo },
            {
              label: "Delete",
              danger: true,
              onSelect: () =>
                setState((current) => ({
                  ...current,
                  objects: current.objects.filter((item) => item.id !== current.selectedId),
                })),
            },
          ],
        },
        {
          label: "Object",
          items: [
            { label: "Unite", onSelect: () => booleanOp("unite") },
            { label: "Subtract", onSelect: () => booleanOp("subtract") },
            { label: "Intersect", onSelect: () => booleanOp("intersect") },
            { label: "Exclude", onSelect: () => booleanOp("exclude") },
          ],
        },
        {
          label: "Effect",
          items: [
            { label: "Glow", onSelect: () => selected && patch(selected.id, { effect: "glow" }) },
            { label: "Drop shadow", onSelect: () => selected && patch(selected.id, { effect: "shadow" }) },
            { label: "Live repeat", onSelect: () => selected && patch(selected.id, { effect: "repeat", repeat: 6 }) },
            { label: "Envelope", onSelect: () => selected && patch(selected.id, { effect: "envelope" }) },
          ],
        },
      ]}
      tools={
        <>
          {(
            [
              ["select", "Se"],
              ["direct", "Di"],
              ["pen", "Pe"],
              ["rect", "Re"],
              ["ellipse", "El"],
              ["line", "Ln"],
              ["text", "Ty"],
              ["hand", "Ha"],
            ] as const
          ).map(([id, label]) => (
            <ToolButton key={id} label={label} active={tool === id} onClick={() => setTool(id)} />
          ))}
        </>
      }
      inspector={
        <>
          <Panel title="Appearance">
            {selected ? (
              <>
                <Field label="Fill">
                  <input
                    type="color"
                    value={selected.fill.startsWith("#") ? selected.fill : "#e8a87c"}
                    onChange={(e) => patch(selected.id, { fill: e.target.value })}
                  />
                </Field>
                <Field label="Stroke">
                  <input
                    type="color"
                    value={selected.stroke.startsWith("#") ? selected.stroke : "#f3eee4"}
                    onChange={(e) => patch(selected.id, { stroke: e.target.value })}
                  />
                </Field>
                <Field label="Stroke width">
                  <input
                    type="range"
                    min={0}
                    max={24}
                    value={selected.strokeWidth}
                    onChange={(e) => patch(selected.id, { strokeWidth: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Opacity">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selected.opacity}
                    onChange={(e) => patch(selected.id, { opacity: Number(e.target.value) })}
                  />
                </Field>
                {selected.type === "text" ? (
                  <Field label="Text">
                    <input
                      className="w-full rounded border border-line bg-ink px-2 py-1 text-[12px]"
                      value={selected.text ?? ""}
                      onChange={(e) => patch(selected.id, { text: e.target.value })}
                    />
                  </Field>
                ) : null}
              </>
            ) : (
              <p className="text-[12px] text-mute">Select an object.</p>
            )}
          </Panel>
          <Panel title="Layers">
            {[...doc.objects].reverse().map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setState((c) => ({ ...c, selectedId: item.id }))}
                className={`mb-1 flex w-full justify-between rounded px-2 py-1.5 text-[12px] ${
                  item.id === doc.selectedId ? "bg-line" : "hover:bg-panel-2"
                }`}
              >
                <span>{item.name}</span>
                <span className="text-mute">{item.type}</span>
              </button>
            ))}
          </Panel>
          <Panel title="Image trace">
            <p className="text-[11px] text-mute">Twelve presets. Place a raster, then pick a look.</p>
            <div className="grid grid-cols-2 gap-1">
              {TRACE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="rounded border border-line px-2 py-1 text-[11px] hover:bg-panel-2"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = () => {
                      const file = input.files?.[0];
                      if (file) void traceImage(file, preset);
                    };
                    input.click();
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="View">
            <input
              type="range"
              min={0.3}
              max={2}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </Panel>
        </>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.svg"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const href = await readFileAsDataUrl(file);
          add({
            id: uid("img"),
            type: "image",
            name: file.name,
            x: 80,
            y: 80,
            w: 360,
            h: 240,
            rotation: 0,
            fill: "none",
            stroke: "none",
            strokeWidth: 0,
            opacity: 1,
            visible: true,
            locked: false,
            href,
          });
        }}
      />
      <div className="flex h-full items-center justify-center overflow-auto bg-[#0c0c0e] p-8">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${doc.width} ${doc.height}`}
          width={doc.width * zoom}
          height={doc.height * zoom}
          className="bg-[#0e0e12] shadow-2xl"
          onPointerDown={onCanvasDown}
        >
          {doc.objects.map((item) => {
            if (!item.visible) return null;
            const filter =
              item.effect === "glow"
                ? "url(#glow)"
                : item.effect === "shadow"
                  ? "url(#shadow)"
                  : undefined;
            const copies = item.effect === "repeat" ? item.repeat ?? 4 : 1;
            return Array.from({ length: copies }, (_, index) => {
              const ox = item.effect === "repeat" ? index * 18 : 0;
              const oy = item.effect === "repeat" ? index * 12 : 0;
              const common = {
                opacity: item.opacity,
                filter,
                transform: `translate(${ox} ${oy}) rotate(${item.effect === "envelope" ? 8 : item.rotation} ${item.x + item.w / 2} ${item.y + item.h / 2})`,
                onPointerDown: (event: React.PointerEvent) => {
                  event.stopPropagation();
                  setState((c) => ({ ...c, selectedId: item.id }));
                  drag.current = { id: item.id, x: event.clientX, y: event.clientY, ox: item.x, oy: item.y };
                },
                onPointerMove: (event: React.PointerEvent) => {
                  if (!drag.current || drag.current.id !== item.id || tool !== "select") return;
                  const dx = (event.clientX - drag.current.x) / zoom;
                  const dy = (event.clientY - drag.current.y) / zoom;
                  patch(item.id, { x: drag.current.ox + dx, y: drag.current.oy + dy });
                },
                onPointerUp: () => {
                  drag.current = null;
                },
              };
              if (item.type === "rect") {
                return (
                  <rect
                    key={`${item.id}-${index}`}
                    x={item.x}
                    y={item.y}
                    width={item.w}
                    height={item.h}
                    fill={item.fill}
                    stroke={item.id === doc.selectedId ? "#e8a87c" : item.stroke}
                    strokeWidth={item.id === doc.selectedId ? 2 : item.strokeWidth}
                    {...common}
                  />
                );
              }
              if (item.type === "ellipse") {
                return (
                  <ellipse
                    key={`${item.id}-${index}`}
                    cx={item.x + item.w / 2}
                    cy={item.y + item.h / 2}
                    rx={item.w / 2}
                    ry={item.h / 2}
                    fill={item.fill}
                    stroke={item.id === doc.selectedId ? "#e8a87c" : item.stroke}
                    strokeWidth={item.strokeWidth}
                    {...common}
                  />
                );
              }
              if (item.type === "line") {
                return (
                  <line
                    key={`${item.id}-${index}`}
                    x1={item.x}
                    y1={item.y}
                    x2={item.x + item.w}
                    y2={item.y + item.h}
                    stroke={item.stroke}
                    strokeWidth={item.strokeWidth || 2}
                    {...common}
                  />
                );
              }
              if (item.type === "path" && item.points) {
                const d = item.points
                  .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
                  .join(" ");
                return (
                  <path
                    key={`${item.id}-${index}`}
                    d={d}
                    fill={item.fill}
                    stroke={item.stroke}
                    strokeWidth={item.strokeWidth}
                    {...common}
                  />
                );
              }
              if (item.type === "image" && item.href) {
                return (
                  <image
                    key={`${item.id}-${index}`}
                    href={item.href}
                    x={item.x}
                    y={item.y}
                    width={item.w}
                    height={item.h}
                    {...common}
                  />
                );
              }
              return (
                <text
                  key={`${item.id}-${index}`}
                  x={item.x}
                  y={item.y}
                  fill={item.fill}
                  fontSize={item.fontSize ?? 48}
                  fontFamily="Georgia, serif"
                  {...common}
                >
                  {item.text}
                </text>
              );
            });
          })}
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="shadow">
              <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000" floodOpacity="0.55" />
            </filter>
          </defs>
        </svg>
      </div>
    </StudioShell>
  );
}
