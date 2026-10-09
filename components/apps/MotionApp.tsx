"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Field, Panel, StudioShell, ToolButton } from "@/components/studio/StudioShell";
import { getApp } from "@/lib/apps";
import { useHistory } from "@/lib/history";
import { downloadBlob, easeInOut, lerp, readFileAsDataUrl, uid } from "@/lib/id";

type Key = { t: number; v: number; ease: "linear" | "ease" | "hold" };

type MotionLayer = {
  id: string;
  name: string;
  kind: "solid" | "text" | "shape" | "footage" | "null" | "adjust" | "camera";
  visible: boolean;
  parentId: string | null;
  color: string;
  text?: string;
  src?: string;
  x: Key[];
  y: Key[];
  scale: Key[];
  rotation: Key[];
  opacity: Key[];
  effect: "none" | "blur" | "glow" | "wiggle";
};

type Comp = {
  name: string;
  width: number;
  height: number;
  duration: number;
  fps: number;
  layers: MotionLayer[];
  selectedId: string | null;
};

const app = getApp("motion")!;

function keys(value: number): Key[] {
  return [{ t: 0, v: value, ease: "ease" }];
}

function sample(keysList: Key[], time: number): number {
  if (keysList.length === 0) return 0;
  const first = keysList[0];
  const last = keysList[keysList.length - 1];
  if (!first || !last) return 0;
  if (time <= first.t) return first.v;
  if (time >= last.t) return last.v;
  for (let i = 0; i < keysList.length - 1; i += 1) {
    const a = keysList[i];
    const b = keysList[i + 1];
    if (!a || !b) continue;
    if (time >= a.t && time <= b.t) {
      if (a.ease === "hold") return a.v;
      const u = (time - a.t) / Math.max(0.0001, b.t - a.t);
      return lerp(a.v, b.v, a.ease === "ease" ? easeInOut(u) : u);
    }
  }
  return last.v;
}

function starter(): Comp {
  return {
    name: "Comp 1",
    width: 1280,
    height: 720,
    duration: 6,
    fps: 30,
    selectedId: "title",
    layers: [
      {
        id: "bg",
        name: "Solid",
        kind: "solid",
        visible: true,
        parentId: null,
        color: "#16131c",
        x: keys(0),
        y: keys(0),
        scale: keys(100),
        rotation: keys(0),
        opacity: keys(100),
        effect: "none",
      },
      {
        id: "orb",
        name: "Shape",
        kind: "shape",
        visible: true,
        parentId: null,
        color: "#e8a87c",
        x: [
          { t: 0, v: 200, ease: "ease" },
          { t: 6, v: 860, ease: "ease" },
        ],
        y: keys(260),
        scale: keys(100),
        rotation: [
          { t: 0, v: 0, ease: "linear" },
          { t: 6, v: 180, ease: "linear" },
        ],
        opacity: keys(100),
        effect: "glow",
      },
      {
        id: "title",
        name: "Title",
        kind: "text",
        visible: true,
        parentId: null,
        color: "#f3eee4",
        text: "ATELIER",
        x: keys(430),
        y: [
          { t: 0, v: 380, ease: "ease" },
          { t: 1.2, v: 330, ease: "ease" },
        ],
        scale: keys(100),
        rotation: keys(0),
        opacity: [
          { t: 0, v: 0, ease: "ease" },
          { t: 1, v: 100, ease: "ease" },
        ],
        effect: "none",
      },
    ],
  };
}

export function MotionApp() {
  const { state: comp, setState, undo, redo } = useHistory<Comp>(starter());
  const [menu, setMenu] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "orbit" | "pan" | "dolly">("select");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [camera, setCamera] = useState({ orbit: 0, pan: 0, dolly: 1 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => comp.layers.find((layer) => layer.id === comp.selectedId) ?? null,
    [comp.layers, comp.selectedId],
  );

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setTime((t) => (t + 1 / comp.fps >= comp.duration ? 0 : t + 1 / comp.fps));
    }, 1000 / comp.fps);
    return () => window.clearInterval(id);
  }, [playing, comp.fps, comp.duration]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.width = comp.width;
    canvas.height = comp.height;
    ctx.clearRect(0, 0, comp.width, comp.height);
    ctx.save();
    ctx.translate(comp.width / 2 + camera.pan, comp.height / 2);
    ctx.rotate((camera.orbit * Math.PI) / 180);
    ctx.scale(camera.dolly, camera.dolly);
    ctx.translate(-comp.width / 2, -comp.height / 2);
    for (const layer of comp.layers) {
      if (!layer.visible || layer.kind === "camera" || layer.kind === "null") continue;
      const wiggle = layer.effect === "wiggle" ? Math.sin(time * 12) * 10 : 0;
      const x = sample(layer.x, time) + wiggle;
      const y = sample(layer.y, time);
      const scale = sample(layer.scale, time) / 100;
      const rot = sample(layer.rotation, time);
      const opacity = sample(layer.opacity, time) / 100;
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(x, y);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.scale(scale, scale);
      if (layer.effect === "blur") ctx.filter = "blur(6px)";
      if (layer.effect === "glow") {
        ctx.shadowColor = layer.color;
        ctx.shadowBlur = 24;
      }
      if (layer.kind === "solid") {
        ctx.fillStyle = layer.color;
        ctx.fillRect(0, 0, comp.width, comp.height);
      } else if (layer.kind === "shape") {
        ctx.fillStyle = layer.color;
        ctx.beginPath();
        ctx.arc(80, 80, 80, 0, Math.PI * 2);
        ctx.fill();
      } else if (layer.kind === "text") {
        ctx.fillStyle = layer.color;
        ctx.font = "72px Georgia, serif";
        ctx.fillText(layer.text ?? "Text", 0, 0);
      } else if (layer.kind === "footage" && layer.src) {
        const image = new Image();
        image.src = layer.src;
        ctx.drawImage(image, 0, 0, 320, 180);
      } else if (layer.kind === "adjust") {
        ctx.fillStyle = "rgba(255,220,180,0.08)";
        ctx.fillRect(-x, -y, comp.width, comp.height);
      }
      ctx.restore();
    }
    ctx.restore();
  }, [comp, time, camera]);

  const patchLayer = (id: string, patch: Partial<MotionLayer>) => {
    setState((current) => ({
      ...current,
      layers: current.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
    }));
  };

  const addKey = (prop: "x" | "y" | "scale" | "rotation" | "opacity") => {
    if (!selected) return;
    const list = [...selected[prop], { t: Number(time.toFixed(2)), v: sample(selected[prop], time), ease: "ease" as const }];
    list.sort((a, b) => a.t - b.t);
    patchLayer(selected.id, { [prop]: list });
  };

  const exportWebm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stream = canvas.captureStream(comp.fps);
    const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => downloadBlob(new Blob(chunks, { type: "video/webm" }), `${comp.name}.webm`);
    setTime(0);
    setPlaying(true);
    rec.start();
    window.setTimeout(() => {
      rec.stop();
      setPlaying(false);
    }, comp.duration * 1000);
  };

  const exportLottie = () => {
    const json = {
      v: "5.7.4",
      fr: comp.fps,
      ip: 0,
      op: comp.duration * comp.fps,
      w: comp.width,
      h: comp.height,
      nm: comp.name,
      layers: comp.layers.map((layer, index) => ({
        ty: layer.kind === "text" ? 5 : 4,
        nm: layer.name,
        ind: index + 1,
        ks: {
          p: { k: layer.x.map((k, i) => ({ t: k.t * comp.fps, s: [k.v, layer.y[i]?.v ?? 0] })) },
          s: { k: layer.scale.map((k) => ({ t: k.t * comp.fps, s: [k.v, k.v] })) },
          r: { k: layer.rotation.map((k) => ({ t: k.t * comp.fps, s: [k.v] })) },
          o: { k: layer.opacity.map((k) => ({ t: k.t * comp.fps, s: [k.v] })) },
        },
      })),
    };
    downloadBlob(new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }), `${comp.name}.json`);
  };

  return (
    <StudioShell
      app={app}
      openMenu={menu}
      onOpenMenu={setMenu}
      status={`${comp.name} · ${time.toFixed(2)}s / ${comp.duration}s · ${comp.fps} fps`}
      menus={[
        {
          label: "File",
          items: [
            { label: "New comp", onSelect: () => setState(starter()) },
            { label: "Import footage…", onSelect: () => fileRef.current?.click() },
            { label: "Export WebM", onSelect: exportWebm },
            { label: "Export Lottie JSON", onSelect: exportLottie },
          ],
        },
        { label: "Edit", items: [{ label: "Undo", onSelect: undo }, { label: "Redo", onSelect: redo }] },
        {
          label: "Layer",
          items: [
            {
              label: "New solid",
              onSelect: () =>
                setState((c) => ({
                  ...c,
                  layers: [
                    ...c.layers,
                    {
                      id: uid("sol"),
                      name: "Solid",
                      kind: "solid",
                      visible: true,
                      parentId: null,
                      color: "#2a2233",
                      x: keys(0),
                      y: keys(0),
                      scale: keys(100),
                      rotation: keys(0),
                      opacity: keys(100),
                      effect: "none",
                    },
                  ],
                })),
            },
            {
              label: "New null",
              onSelect: () =>
                setState((c) => ({
                  ...c,
                  layers: [
                    ...c.layers,
                    {
                      id: uid("null"),
                      name: "Null",
                      kind: "null",
                      visible: true,
                      parentId: null,
                      color: "#888",
                      x: keys(640),
                      y: keys(360),
                      scale: keys(100),
                      rotation: keys(0),
                      opacity: keys(100),
                      effect: "none",
                    },
                  ],
                })),
            },
          ],
        },
      ]}
      tools={
        <>
          {(
            [
              ["select", "Se"],
              ["orbit", "Or"],
              ["pan", "Pa"],
              ["dolly", "Do"],
            ] as const
          ).map(([id, label]) => (
            <ToolButton key={id} label={label} active={tool === id} onClick={() => setTool(id)} />
          ))}
        </>
      }
      inspector={
        <>
          <Panel title="Transform">
            {selected ? (
              <>
                <p className="text-[12px] text-cream-dim">{selected.name}</p>
                {(["x", "y", "scale", "rotation", "opacity"] as const).map((prop) => (
                  <button
                    key={prop}
                    type="button"
                    className="mr-1 mt-1 rounded border border-line px-2 py-1 text-[11px]"
                    onClick={() => addKey(prop)}
                  >
                    Key {prop}
                  </button>
                ))}
                <Field label="Effect">
                  <select
                    className="w-full rounded border border-line bg-ink px-2 py-1 text-[12px]"
                    value={selected.effect}
                    onChange={(e) =>
                      patchLayer(selected.id, { effect: e.target.value as MotionLayer["effect"] })
                    }
                  >
                    <option value="none">None</option>
                    <option value="blur">Blur</option>
                    <option value="glow">Glow</option>
                    <option value="wiggle">Wiggle</option>
                  </select>
                </Field>
                <Field label="Parent">
                  <select
                    className="w-full rounded border border-line bg-ink px-2 py-1 text-[12px]"
                    value={selected.parentId ?? ""}
                    onChange={(e) => patchLayer(selected.id, { parentId: e.target.value || null })}
                  >
                    <option value="">None</option>
                    {comp.layers
                      .filter((layer) => layer.id !== selected.id)
                      .map((layer) => (
                        <option key={layer.id} value={layer.id}>
                          {layer.name}
                        </option>
                      ))}
                  </select>
                </Field>
                {selected.kind === "text" ? (
                  <Field label="Text">
                    <input
                      className="w-full rounded border border-line bg-ink px-2 py-1 text-[12px]"
                      value={selected.text ?? ""}
                      onChange={(e) => patchLayer(selected.id, { text: e.target.value })}
                    />
                  </Field>
                ) : null}
              </>
            ) : (
              <p className="text-[12px] text-mute">Select a layer.</p>
            )}
          </Panel>
          <Panel title="Camera">
            <Field label="Orbit">
              <input
                type="range"
                min={-40}
                max={40}
                value={camera.orbit}
                onChange={(e) => setCamera((c) => ({ ...c, orbit: Number(e.target.value) }))}
              />
            </Field>
            <Field label="Pan">
              <input
                type="range"
                min={-200}
                max={200}
                value={camera.pan}
                onChange={(e) => setCamera((c) => ({ ...c, pan: Number(e.target.value) }))}
              />
            </Field>
            <Field label="Dolly">
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={camera.dolly}
                onChange={(e) => setCamera((c) => ({ ...c, dolly: Number(e.target.value) }))}
              />
            </Field>
          </Panel>
          <Panel title="Layers">
            {[...comp.layers].reverse().map((layer) => (
              <button
                key={layer.id}
                type="button"
                onClick={() => setState((c) => ({ ...c, selectedId: layer.id }))}
                className={`mb-1 flex w-full justify-between rounded px-2 py-1.5 text-[12px] ${
                  layer.id === comp.selectedId ? "bg-line" : "hover:bg-panel-2"
                }`}
              >
                <span>{layer.name}</span>
                <span className="text-mute">{layer.kind}</span>
              </button>
            ))}
          </Panel>
        </>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const src = await readFileAsDataUrl(file);
          setState((c) => ({
            ...c,
            layers: [
              ...c.layers,
              {
                id: uid("ft"),
                name: file.name,
                kind: "footage",
                visible: true,
                parentId: null,
                color: "#fff",
                src,
                x: keys(200),
                y: keys(160),
                scale: keys(100),
                rotation: keys(0),
                opacity: keys(100),
                effect: "none",
              },
            ],
          }));
        }}
      />
      <div className="flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center bg-[#08080a]">
          <canvas
            ref={canvasRef}
            className="max-h-full max-w-full shadow-2xl"
            onPointerMove={(event) => {
              if (event.buttons !== 1) return;
              if (tool === "orbit") setCamera((c) => ({ ...c, orbit: c.orbit + event.movementX * 0.2 }));
              if (tool === "pan") setCamera((c) => ({ ...c, pan: c.pan + event.movementX }));
              if (tool === "dolly") setCamera((c) => ({ ...c, dolly: Math.max(0.4, c.dolly + event.movementY * -0.01) }));
            }}
          />
        </div>
        <div className="border-t border-line bg-panel p-3">
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              className="rounded bg-cream px-3 py-1 text-xs text-ink"
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? "Stop" : "Play"}
            </button>
            <span className="text-[11px] text-mute">{time.toFixed(2)}s</span>
          </div>
          <input
            type="range"
            className="w-full"
            min={0}
            max={comp.duration}
            step={1 / comp.fps}
            value={time}
            onChange={(e) => setTime(Number(e.target.value))}
          />
        </div>
      </div>
    </StudioShell>
  );
}
