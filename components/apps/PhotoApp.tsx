"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Field, Panel, StudioShell, ToolButton } from "@/components/studio/StudioShell";
import { useHistory } from "@/lib/history";
import { clamp, downloadDataUrl, loadImage, readFileAsDataUrl, uid } from "@/lib/id";
import { getApp } from "@/lib/apps";

type Tool =
  | "move"
  | "marquee"
  | "brush"
  | "eraser"
  | "fill"
  | "gradient"
  | "type"
  | "shape"
  | "eyedropper"
  | "crop";

type Blend = GlobalCompositeOperation;

type PhotoLayer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blend: Blend;
  kind: "raster" | "text" | "shape" | "adjust";
  src?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  shape?: "rect" | "ellipse";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  shadow?: boolean;
  glow?: boolean;
  adjust?: {
    brightness: number;
    contrast: number;
    saturation: number;
    hue: number;
    invert: boolean;
    grayscale: boolean;
    blur: number;
    sharpen: number;
    grain: number;
    vignette: number;
    posterize: number;
  };
};

type Selection = { x: number; y: number; w: number; h: number } | null;

type Doc = {
  name: string;
  width: number;
  height: number;
  layers: PhotoLayer[];
  selectedId: string | null;
};

const BLENDS: Blend[] = [
  "source-over",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "soft-light",
  "hard-light",
  "difference",
];

const app = getApp("photo")!;

function emptyAdjust() {
  return {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
    invert: false,
    grayscale: false,
    blur: 0,
    sharpen: 0,
    grain: 0,
    vignette: 0,
    posterize: 0,
  };
}

const EMPTY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function starterDoc(): Doc {
  return {
    name: "Untitled",
    width: 1280,
    height: 800,
    selectedId: "bg",
    layers: [
      {
        id: "bg",
        name: "Background",
        visible: true,
        locked: false,
        opacity: 1,
        blend: "source-over",
        kind: "raster",
        x: 0,
        y: 0,
        width: 1280,
        height: 800,
        src: EMPTY_PNG,
      },
    ],
  };
}

function makeSolid(color: string, width: number, height: number): string {
  if (typeof document === "undefined") return EMPTY_PNG;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return EMPTY_PNG;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return canvas.toDataURL("image/png");
}

function applyAdjust(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  adjust: NonNullable<PhotoLayer["adjust"]>,
) {
  const filter = [
    `brightness(${100 + adjust.brightness}%)`,
    `contrast(${100 + adjust.contrast}%)`,
    `saturate(${100 + adjust.saturation}%)`,
    `hue-rotate(${adjust.hue}deg)`,
    adjust.invert ? "invert(1)" : "",
    adjust.grayscale ? "grayscale(1)" : "",
    adjust.blur ? `blur(${adjust.blur}px)` : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (filter) {
    ctx.filter = filter;
    const snap = ctx.getImageData(0, 0, width, height);
    const tmp = document.createElement("canvas");
    tmp.width = width;
    tmp.height = height;
    tmp.getContext("2d")?.putImageData(snap, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(tmp, 0, 0);
    ctx.filter = "none";
  }
  if (adjust.vignette > 0) {
    const g = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.25,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.7,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${adjust.vignette / 100})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
  if (adjust.grain > 0 || adjust.posterize > 0 || adjust.sharpen > 0) {
    const data = ctx.getImageData(0, 0, width, height);
    const px = data.data;
    const levels = adjust.posterize > 0 ? Math.max(2, 16 - Math.round(adjust.posterize / 8)) : 0;
    for (let i = 0; i < px.length; i += 4) {
      if (adjust.grain > 0) {
        const n = (Math.random() - 0.5) * adjust.grain * 1.6;
        px[i] = clamp((px[i] ?? 0) + n, 0, 255);
        px[i + 1] = clamp((px[i + 1] ?? 0) + n, 0, 255);
        px[i + 2] = clamp((px[i + 2] ?? 0) + n, 0, 255);
      }
      if (levels) {
        const step = 255 / (levels - 1);
        px[i] = Math.round((px[i] ?? 0) / step) * step;
        px[i + 1] = Math.round((px[i + 1] ?? 0) / step) * step;
        px[i + 2] = Math.round((px[i + 2] ?? 0) / step) * step;
      }
    }
    ctx.putImageData(data, 0, 0);
  }
}

export function PhotoApp() {
  const { state: doc, setState, undo, redo } = useHistory<Doc>(starterDoc());
  const [tool, setTool] = useState<Tool>("move");
  const [brush, setBrush] = useState({ size: 18, color: "#f3eee4", hardness: 80 });
  const [menu, setMenu] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [zoom, setZoom] = useState(0.7);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{
    x: number;
    y: number;
    lx: number;
    ly: number;
    mode: "draw" | "move" | "select" | "crop";
  } | null>(null);

  const selected = useMemo(
    () => doc.layers.find((layer) => layer.id === doc.selectedId) ?? null,
    [doc.layers, doc.selectedId],
  );

  const composite = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = doc.width;
    canvas.height = doc.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, doc.width, doc.height);
    for (const layer of doc.layers) {
      if (!layer.visible) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blend;
      if (layer.shadow) {
        ctx.shadowColor = "rgba(0,0,0,0.55)";
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 10;
      }
      if (layer.glow) {
        ctx.shadowColor = layer.color ?? "#e8a87c";
        ctx.shadowBlur = 22;
      }
      if (layer.kind === "raster" && layer.src) {
        const image = await loadImage(layer.src);
        ctx.drawImage(image, layer.x, layer.y, layer.width, layer.height);
      } else if (layer.kind === "text") {
        ctx.fillStyle = layer.color ?? "#f3eee4";
        ctx.font = `${layer.fontSize ?? 48}px ${layer.fontFamily ?? "Georgia, serif"}`;
        ctx.fillText(layer.text ?? "Type", layer.x, layer.y);
      } else if (layer.kind === "shape") {
        ctx.fillStyle = layer.fill ?? "#e8a87c";
        ctx.strokeStyle = layer.stroke ?? "#f3eee4";
        ctx.lineWidth = layer.strokeWidth ?? 0;
        if (layer.shape === "ellipse") {
          ctx.beginPath();
          ctx.ellipse(
            layer.x + layer.width / 2,
            layer.y + layer.height / 2,
            layer.width / 2,
            layer.height / 2,
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          if ((layer.strokeWidth ?? 0) > 0) ctx.stroke();
        } else {
          ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
          if ((layer.strokeWidth ?? 0) > 0) ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
        }
      } else if (layer.kind === "adjust" && layer.adjust) {
        applyAdjust(ctx, doc.width, doc.height, layer.adjust);
      }
      ctx.restore();
    }
    if (selection) {
      ctx.save();
      ctx.strokeStyle = "#e8a87c";
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(selection.x, selection.y, selection.w, selection.h);
      ctx.restore();
    }
  }, [doc, selection]);

  useEffect(() => {
    void composite();
  }, [composite]);

  useEffect(() => {
    setState((current) => ({
      ...current,
      layers: current.layers.map((layer) =>
        layer.id === "bg" && layer.src === EMPTY_PNG
          ? { ...layer, src: makeSolid("#1c1916", current.width, current.height) }
          : layer,
      ),
    }));
  }, [setState]);

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    downloadDataUrl(canvas.toDataURL("image/png"), `${doc.name}.png`);
  };

  const exportJpeg = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    downloadDataUrl(canvas.toDataURL("image/jpeg", 0.92), `${doc.name}.jpg`);
  };

  const exportWebp = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    downloadDataUrl(canvas.toDataURL("image/webp", 0.92), `${doc.name}.webp`);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "e") {
        event.preventDefault();
        exportPng();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const patchLayer = (id: string, patch: Partial<PhotoLayer>) => {
    setState((current) => ({
      ...current,
      layers: current.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
    }));
  };

  const addLayer = (layer: PhotoLayer) => {
    setState((current) => ({
      ...current,
      layers: [...current.layers, layer],
      selectedId: layer.id,
    }));
  };

  const paintAt = async (x: number, y: number, erase = false) => {
    if (!selected || selected.kind !== "raster" || selected.locked || !selected.src) return;
    const image = await loadImage(selected.src);
    const canvas = document.createElement("canvas");
    canvas.width = selected.width;
    canvas.height = selected.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0, selected.width, selected.height);
    ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
    ctx.fillStyle = brush.color;
    ctx.beginPath();
    ctx.arc(x - selected.x, y - selected.y, brush.size / 2, 0, Math.PI * 2);
    ctx.fill();
    patchLayer(selected.id, { src: canvas.toDataURL("image/png") });
  };

  const openFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const src = await readFileAsDataUrl(file);
      const image = await loadImage(src);
      const width = Math.min(image.width, doc.width);
      const height = Math.round((image.height / image.width) * width);
      addLayer({
        id: uid("px"),
        name: file.name,
        visible: true,
        locked: false,
        opacity: 1,
        blend: "source-over",
        kind: "raster",
        src,
        x: 80,
        y: 80,
        width,
        height,
      });
    }
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / zoom;
    const y = (event.clientY - rect.top) / zoom;
    dragRef.current = {
      x,
      y,
      lx: selected?.x ?? 0,
      ly: selected?.y ?? 0,
      mode:
        tool === "brush" || tool === "eraser"
          ? "draw"
          : tool === "marquee" || tool === "crop"
            ? "select"
            : "move",
    };
    if (tool === "eyedropper") {
      const ctx = canvasRef.current?.getContext("2d");
      const pixel = ctx?.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      if (pixel) {
        setBrush((b) => ({
          ...b,
          color: `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`,
        }));
      }
    }
    if (tool === "fill" && selected?.kind === "raster") {
      void (async () => {
        if (!selected.src) return;
        const image = await loadImage(selected.src);
        const canvas = document.createElement("canvas");
        canvas.width = selected.width;
        canvas.height = selected.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(image, 0, 0);
        ctx.fillStyle = brush.color;
        ctx.fillRect(0, 0, selected.width, selected.height);
        patchLayer(selected.id, { src: canvas.toDataURL("image/png") });
      })();
    }
    if (tool === "brush" || tool === "eraser") {
      void paintAt(x, y, tool === "eraser");
    }
    if (tool === "type") {
      addLayer({
        id: uid("type"),
        name: "Type",
        visible: true,
        locked: false,
        opacity: 1,
        blend: "source-over",
        kind: "text",
        x,
        y,
        width: 400,
        height: 80,
        text: "Atelier",
        fontSize: 72,
        fontFamily: "Georgia, serif",
        color: brush.color,
        shadow: true,
      });
    }
    if (tool === "shape") {
      addLayer({
        id: uid("shape"),
        name: "Shape",
        visible: true,
        locked: false,
        opacity: 1,
        blend: "source-over",
        kind: "shape",
        shape: "rect",
        x,
        y,
        width: 220,
        height: 140,
        fill: brush.color,
        stroke: "#f3eee4",
        strokeWidth: 0,
      });
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / zoom;
    const y = (event.clientY - rect.top) / zoom;
    const dx = x - dragRef.current.x;
    const dy = y - dragRef.current.y;
    if (dragRef.current.mode === "draw") {
      void paintAt(x, y, tool === "eraser");
    } else if (dragRef.current.mode === "move" && selected && !selected.locked && tool === "move") {
      patchLayer(selected.id, {
        x: dragRef.current.lx + dx,
        y: dragRef.current.ly + dy,
      });
    } else if (dragRef.current.mode === "select") {
      setSelection({
        x: Math.min(dragRef.current.x, x),
        y: Math.min(dragRef.current.y, y),
        w: Math.abs(dx),
        h: Math.abs(dy),
      });
    }
  };

  const onPointerUp = () => {
    if (tool === "crop" && selection && selection.w > 8 && selection.h > 8) {
      setState((current) => ({
        ...current,
        width: Math.round(selection.w),
        height: Math.round(selection.h),
        layers: current.layers.map((layer) => ({
          ...layer,
          x: layer.x - selection.x,
          y: layer.y - selection.y,
        })),
      }));
      setSelection(null);
    }
    dragRef.current = null;
  };

  return (
    <StudioShell
      app={app}
      openMenu={menu}
      onOpenMenu={setMenu}
      status={`${doc.name} · ${doc.width}×${doc.height} · ${doc.layers.length} layers`}
      menus={[
        {
          label: "File",
          items: [
            {
              label: "New",
              shortcut: "⌘N",
              onSelect: () => setState(starterDoc()),
            },
            { label: "Open…", shortcut: "⌘O", onSelect: () => fileRef.current?.click() },
            { label: "Export PNG", shortcut: "⌘E", onSelect: exportPng },
            { label: "Export JPEG", onSelect: exportJpeg },
            { label: "Export WebP", onSelect: exportWebp },
          ],
        },
        {
          label: "Edit",
          items: [
            { label: "Undo", shortcut: "⌘Z", onSelect: undo },
            { label: "Redo", shortcut: "⇧⌘Z", onSelect: redo },
            { label: "Deselect", onSelect: () => setSelection(null) },
            {
              label: "Delete layer",
              danger: true,
              onSelect: () =>
                setState((current) => ({
                  ...current,
                  layers: current.layers.filter((layer) => layer.id !== current.selectedId),
                  selectedId: current.layers[0]?.id ?? null,
                })),
            },
          ],
        },
        {
          label: "Layer",
          items: [
            {
              label: "New raster layer",
              onSelect: () =>
                addLayer({
                  id: uid("px"),
                  name: "Layer",
                  visible: true,
                  locked: false,
                  opacity: 1,
                  blend: "source-over",
                  kind: "raster",
                  src: makeSolid("rgba(0,0,0,0)", doc.width, doc.height),
                  x: 0,
                  y: 0,
                  width: doc.width,
                  height: doc.height,
                }),
            },
            {
              label: "Adjustment layer",
              onSelect: () =>
                addLayer({
                  id: uid("adj"),
                  name: "Curves / Adjust",
                  visible: true,
                  locked: false,
                  opacity: 1,
                  blend: "source-over",
                  kind: "adjust",
                  x: 0,
                  y: 0,
                  width: doc.width,
                  height: doc.height,
                  adjust: emptyAdjust(),
                }),
            },
            {
              label: "Duplicate",
              onSelect: () => {
                if (!selected) return;
                addLayer({ ...selected, id: uid("copy"), name: `${selected.name} copy` });
              },
            },
          ],
        },
        {
          label: "Image",
          items: [
            {
              label: "Flatten visible",
              onSelect: () => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                setState((current) => ({
                  ...current,
                  layers: [
                    {
                      id: uid("flat"),
                      name: "Flattened",
                      visible: true,
                      locked: false,
                      opacity: 1,
                      blend: "source-over",
                      kind: "raster",
                      src: canvas.toDataURL("image/png"),
                      x: 0,
                      y: 0,
                      width: current.width,
                      height: current.height,
                    },
                  ],
                  selectedId: null,
                }));
              },
            },
          ],
        },
      ]}
      tools={
        <>
          {(
            [
              ["move", "Mv"],
              ["marquee", "Mq"],
              ["brush", "Br"],
              ["eraser", "Er"],
              ["fill", "Fl"],
              ["gradient", "Gd"],
              ["type", "Ty"],
              ["shape", "Sh"],
              ["eyedropper", "Ey"],
              ["crop", "Cr"],
            ] as const
          ).map(([id, label]) => (
            <ToolButton key={id} label={label} active={tool === id} onClick={() => setTool(id)} />
          ))}
        </>
      }
      inspector={
        <>
          <Panel title="Document">
            <p className="text-[12px] text-cream-dim">{doc.name}</p>
            <div className="flex gap-2 text-[11px] text-mute">
              <span>{doc.width} × {doc.height}</span>
              <span>Zoom {Math.round(zoom * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.25}
              max={2}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </Panel>
          <Panel title="Layers">
            <div className="space-y-1">
              {[...doc.layers].reverse().map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => setState((current) => ({ ...current, selectedId: layer.id }))}
                  className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[12px] ${
                    layer.id === doc.selectedId ? "bg-line text-cream" : "text-cream-dim hover:bg-panel-2"
                  }`}
                >
                  <span className="truncate">{layer.name}</span>
                  <span className="text-[10px] uppercase text-mute">{layer.kind}</span>
                </button>
              ))}
            </div>
          </Panel>
          {selected ? (
            <Panel title="Properties">
              <Field label="Opacity">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={selected.opacity}
                  onChange={(e) => patchLayer(selected.id, { opacity: Number(e.target.value) })}
                />
              </Field>
              <Field label="Blend">
                <select
                  className="w-full rounded border border-line bg-ink px-2 py-1 text-[12px]"
                  value={selected.blend}
                  onChange={(e) => patchLayer(selected.id, { blend: e.target.value as Blend })}
                >
                  {BLENDS.map((blend) => (
                    <option key={blend} value={blend}>
                      {blend}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border border-line px-2 py-1 text-[11px]"
                  onClick={() => patchLayer(selected.id, { visible: !selected.visible })}
                >
                  {selected.visible ? "Hide" : "Show"}
                </button>
                <button
                  type="button"
                  className="rounded border border-line px-2 py-1 text-[11px]"
                  onClick={() => patchLayer(selected.id, { locked: !selected.locked })}
                >
                  {selected.locked ? "Unlock" : "Lock"}
                </button>
                <button
                  type="button"
                  className="rounded border border-line px-2 py-1 text-[11px]"
                  onClick={() => patchLayer(selected.id, { shadow: !selected.shadow })}
                >
                  Shadow
                </button>
                <button
                  type="button"
                  className="rounded border border-line px-2 py-1 text-[11px]"
                  onClick={() => patchLayer(selected.id, { glow: !selected.glow })}
                >
                  Glow
                </button>
              </div>
              {selected.kind === "text" ? (
                <>
                  <Field label="Text">
                    <input
                      className="w-full rounded border border-line bg-ink px-2 py-1 text-[12px]"
                      value={selected.text ?? ""}
                      onChange={(e) => patchLayer(selected.id, { text: e.target.value })}
                    />
                  </Field>
                  <Field label="Size">
                    <input
                      type="range"
                      min={12}
                      max={160}
                      value={selected.fontSize ?? 48}
                      onChange={(e) => patchLayer(selected.id, { fontSize: Number(e.target.value) })}
                    />
                  </Field>
                </>
              ) : null}
              {selected.kind === "adjust" && selected.adjust ? (
                <>
                  {(
                    [
                      ["brightness", "Brightness"],
                      ["contrast", "Contrast"],
                      ["saturation", "Saturation"],
                      ["hue", "Hue"],
                      ["blur", "Blur"],
                      ["grain", "Grain"],
                      ["vignette", "Vignette"],
                      ["posterize", "Posterize"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} label={label}>
                      <input
                        type="range"
                        min={key === "hue" ? -180 : 0}
                        max={key === "hue" ? 180 : 100}
                        value={selected.adjust?.[key] ?? 0}
                        onChange={(e) =>
                          patchLayer(selected.id, {
                            adjust: {
                              ...emptyAdjust(),
                              ...selected.adjust,
                              [key]: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </Field>
                  ))}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded border border-line px-2 py-1 text-[11px]"
                      onClick={() =>
                        patchLayer(selected.id, {
                          adjust: {
                            ...emptyAdjust(),
                            ...selected.adjust,
                            invert: !selected.adjust?.invert,
                          },
                        })
                      }
                    >
                      Invert
                    </button>
                    <button
                      type="button"
                      className="rounded border border-line px-2 py-1 text-[11px]"
                      onClick={() =>
                        patchLayer(selected.id, {
                          adjust: {
                            ...emptyAdjust(),
                            ...selected.adjust,
                            grayscale: !selected.adjust?.grayscale,
                          },
                        })
                      }
                    >
                      Gray
                    </button>
                  </div>
                </>
              ) : null}
            </Panel>
          ) : null}
          <Panel title="Brush">
            <Field label="Size">
              <input
                type="range"
                min={2}
                max={80}
                value={brush.size}
                onChange={(e) => setBrush((b) => ({ ...b, size: Number(e.target.value) }))}
              />
            </Field>
            <Field label="Color">
              <input
                type="color"
                value={brush.color.startsWith("#") ? brush.color : "#f3eee4"}
                onChange={(e) => setBrush((b) => ({ ...b, color: e.target.value }))}
              />
            </Field>
          </Panel>
        </>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void openFiles(e.target.files)}
      />
      <div className="checker flex h-full items-center justify-center overflow-auto p-6">
        <canvas
          ref={canvasRef}
          className="cursor-crosshair shadow-2xl"
          style={{ width: doc.width * zoom, height: doc.height * zoom }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>
    </StudioShell>
  );
}
