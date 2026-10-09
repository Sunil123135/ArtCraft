"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Field, Panel, StudioShell, ToolButton } from "@/components/studio/StudioShell";
import { getApp } from "@/lib/apps";
import { useHistory } from "@/lib/history";
import { clamp, uid } from "@/lib/id";

type Clip = {
  id: string;
  name: string;
  src: string;
  kind: "video" | "audio" | "image";
  track: number;
  start: number;
  duration: number;
  inPoint: number;
  outPoint: number;
  volume: number;
  opacity: number;
  effect: "none" | "fade" | "blur" | "grain" | "grade";
  transition: "cut" | "dissolve";
};

type Project = {
  name: string;
  fps: number;
  width: number;
  height: number;
  clips: Clip[];
  selectedId: string | null;
};

const app = getApp("film")!;

const FPS_OPTIONS = [23.976, 24, 25, 29.97, 30, 60];

function emptyProject(): Project {
  return {
    name: "Untitled sequence",
    fps: 24,
    width: 1920,
    height: 1080,
    clips: [],
    selectedId: null,
  };
}

export function FilmApp() {
  const { state: project, setState, undo, redo } = useHistory<Project>(emptyProject());
  const [menu, setMenu] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "razor" | "slip" | "slide" | "ripple">("select");
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [grade, setGrade] = useState({
    exposure: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    tint: 0,
    lift: 0,
    gamma: 0,
    gain: 0,
  });
  const sourceRef = useRef<HTMLVideoElement>(null);
  const programRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => project.clips.find((clip) => clip.id === project.selectedId) ?? null,
    [project.clips, project.selectedId],
  );

  const duration = Math.max(10, ...project.clips.map((clip) => clip.start + clip.duration), 0);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setPlayhead((time) => {
        const next = time + 1 / project.fps;
        return next > duration ? 0 : next;
      });
    }, 1000 / project.fps);
    return () => window.clearInterval(id);
  }, [playing, project.fps, duration]);

  useEffect(() => {
    const active = project.clips.find(
      (clip) => clip.kind !== "audio" && playhead >= clip.start && playhead < clip.start + clip.duration,
    );
    const video = programRef.current;
    if (video && active) {
      if (video.src !== active.src) video.src = active.src;
      const local = active.inPoint + (playhead - active.start);
      if (Math.abs(video.currentTime - local) > 0.12) video.currentTime = local;
      if (playing && video.paused) void video.play();
      if (!playing && !video.paused) video.pause();
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !video) return;
    canvas.width = 960;
    canvas.height = 540;
    const filter = [
      `brightness(${100 + grade.exposure + grade.gain}%)`,
      `contrast(${100 + grade.contrast}%)`,
      `saturate(${100 + grade.saturation}%)`,
      `hue-rotate(${grade.temperature + grade.tint}deg)`,
    ].join(" ");
    ctx.filter = filter;
    if (video.readyState >= 2) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (active?.effect === "grain") {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < data.data.length; i += 16) {
        const n = (Math.random() - 0.5) * 28;
        data.data[i] = clamp((data.data[i] ?? 0) + n, 0, 255);
      }
      ctx.putImageData(data, 0, 0);
    }
    if (active?.effect === "fade") {
      const t = (playhead - active.start) / active.duration;
      ctx.fillStyle = `rgba(0,0,0,${t < 0.15 ? 1 - t / 0.15 : t > 0.85 ? (t - 0.85) / 0.15 : 0})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [playhead, playing, project.clips, grade]);

  const importMedia = async (files: FileList | null) => {
    if (!files) return;
    const additions: Clip[] = [];
    let cursor = project.clips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);
    for (const file of Array.from(files)) {
      const src = URL.createObjectURL(file);
      const kind: Clip["kind"] = file.type.startsWith("audio")
        ? "audio"
        : file.type.startsWith("image")
          ? "image"
          : "video";
      let length = kind === "image" ? 4 : 6;
      if (kind === "video" || kind === "audio") {
        length = await new Promise<number>((resolve) => {
          const el = document.createElement(kind);
          el.src = src;
          el.onloadedmetadata = () => resolve(Number.isFinite(el.duration) ? el.duration : 6);
        });
      }
      additions.push({
        id: uid("clip"),
        name: file.name,
        src,
        kind,
        track: kind === "audio" ? 2 : 0,
        start: cursor,
        duration: length,
        inPoint: 0,
        outPoint: length,
        volume: 1,
        opacity: 1,
        effect: "none",
        transition: "cut",
      });
      cursor += length;
    }
    setState((current) => ({
      ...current,
      clips: [...current.clips, ...additions],
      selectedId: additions[0]?.id ?? current.selectedId,
    }));
  };

  const exportWebm = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stream = canvas.captureStream(project.fps);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(blob);
      anchor.download = `${project.name}.webm`;
      anchor.click();
    };
    setPlayhead(0);
    setPlaying(true);
    recorder.start();
    window.setTimeout(() => {
      recorder.stop();
      setPlaying(false);
    }, Math.min(duration, 12) * 1000);
  };

  const patchClip = (id: string, patch: Partial<Clip>) => {
    setState((current) => ({
      ...current,
      clips: current.clips.map((clip) => (clip.id === id ? { ...clip, ...patch } : clip)),
    }));
  };

  return (
    <StudioShell
      app={app}
      openMenu={menu}
      onOpenMenu={setMenu}
      status={`${project.name} · ${project.fps} fps · ${project.width}×${project.height} · ${playhead.toFixed(2)}s`}
      menus={[
        {
          label: "File",
          items: [
            { label: "New sequence", onSelect: () => setState(emptyProject()) },
            { label: "Import…", onSelect: () => fileRef.current?.click() },
            { label: "Export WebM", onSelect: () => void exportWebm() },
          ],
        },
        {
          label: "Edit",
          items: [
            { label: "Undo", onSelect: undo },
            { label: "Redo", onSelect: redo },
            {
              label: "Ripple delete",
              danger: true,
              onSelect: () =>
                selected &&
                setState((current) => ({
                  ...current,
                  clips: current.clips.filter((clip) => clip.id !== selected.id),
                })),
            },
          ],
        },
        {
          label: "Sequence",
          items: FPS_OPTIONS.map((fps) => ({
            label: `${fps} fps`,
            onSelect: () => setState((current) => ({ ...current, fps })),
          })),
        },
      ]}
      tools={
        <>
          {(
            [
              ["select", "V"],
              ["razor", "C"],
              ["slip", "Y"],
              ["slide", "U"],
              ["ripple", "B"],
            ] as const
          ).map(([id, label]) => (
            <ToolButton key={id} label={label} active={tool === id} onClick={() => setTool(id)} />
          ))}
        </>
      }
      inspector={
        <>
          <Panel title="Color">
            {(
              [
                ["exposure", "Exposure"],
                ["contrast", "Contrast"],
                ["saturation", "Saturation"],
                ["temperature", "Temperature"],
                ["tint", "Tint"],
                ["lift", "Lift"],
                ["gamma", "Gamma"],
                ["gain", "Gain"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  type="range"
                  min={-40}
                  max={40}
                  value={grade[key]}
                  onChange={(e) => setGrade((g) => ({ ...g, [key]: Number(e.target.value) }))}
                />
              </Field>
            ))}
          </Panel>
          {selected ? (
            <Panel title="Clip">
              <p className="text-[12px] text-cream-dim">{selected.name}</p>
              <Field label="In">
                <input
                  type="number"
                  className="w-full rounded border border-line bg-ink px-2 py-1 text-[12px]"
                  value={selected.inPoint}
                  onChange={(e) => patchClip(selected.id, { inPoint: Number(e.target.value) })}
                />
              </Field>
              <Field label="Duration">
                <input
                  type="number"
                  className="w-full rounded border border-line bg-ink px-2 py-1 text-[12px]"
                  value={selected.duration}
                  onChange={(e) => patchClip(selected.id, { duration: Number(e.target.value) })}
                />
              </Field>
              <Field label="Volume">
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.05}
                  value={selected.volume}
                  onChange={(e) => patchClip(selected.id, { volume: Number(e.target.value) })}
                />
              </Field>
              <Field label="Effect">
                <select
                  className="w-full rounded border border-line bg-ink px-2 py-1 text-[12px]"
                  value={selected.effect}
                  onChange={(e) =>
                    patchClip(selected.id, { effect: e.target.value as Clip["effect"] })
                  }
                >
                  <option value="none">None</option>
                  <option value="fade">Fade</option>
                  <option value="blur">Blur</option>
                  <option value="grain">Grain</option>
                  <option value="grade">Grade</option>
                </select>
              </Field>
              <Field label="Transition">
                <select
                  className="w-full rounded border border-line bg-ink px-2 py-1 text-[12px]"
                  value={selected.transition}
                  onChange={(e) =>
                    patchClip(selected.id, { transition: e.target.value as Clip["transition"] })
                  }
                >
                  <option value="cut">Cut</option>
                  <option value="dissolve">Dissolve</option>
                </select>
              </Field>
            </Panel>
          ) : null}
          <Panel title="Mixer">
            <p className="text-[11px] text-mute">
              Loudness ~ {(-18 + (selected?.volume ?? 1) * 6).toFixed(1)} LUFS (approx)
            </p>
          </Panel>
        </>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept="video/*,audio/*,image/*"
        multiple
        className="hidden"
        onChange={(e) => void importMedia(e.target.files)}
      />
      <div className="flex h-full flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-px bg-line">
          <section className="flex flex-col bg-ink-2">
            <div className="px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-mute">Source</div>
            <video ref={sourceRef} className="min-h-0 flex-1 bg-black object-contain" controls />
          </section>
          <section className="flex flex-col bg-ink-2">
            <div className="px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-mute">Program</div>
            <div className="relative min-h-0 flex-1 bg-black">
              <video ref={programRef} className="hidden" />
              <canvas ref={canvasRef} className="h-full w-full object-contain" />
            </div>
          </section>
        </div>
        <div className="flex items-center gap-2 border-y border-line bg-panel px-3 py-2">
          <button
            type="button"
            className="rounded bg-cream px-3 py-1 text-xs text-ink"
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" className="rounded border border-line px-2 py-1 text-xs" onClick={() => setPlayhead(0)}>
            |◀
          </button>
          <button
            type="button"
            className="rounded border border-line px-2 py-1 text-xs"
            onClick={() => setPlayhead((t) => Math.max(0, t - 1 / project.fps))}
          >
            J
          </button>
          <button
            type="button"
            className="rounded border border-line px-2 py-1 text-xs"
            onClick={() => setPlaying((p) => !p)}
          >
            K
          </button>
          <button
            type="button"
            className="rounded border border-line px-2 py-1 text-xs"
            onClick={() => setPlayhead((t) => t + 1 / project.fps)}
          >
            L
          </button>
          <input
            type="range"
            className="flex-1"
            min={0}
            max={duration}
            step={1 / project.fps}
            value={playhead}
            onChange={(e) => setPlayhead(Number(e.target.value))}
          />
        </div>
        <div className="h-44 overflow-auto bg-panel-2 p-3">
          {["V1", "V2", "A1"].map((label, track) => (
            <div key={label} className="mb-2 flex items-center gap-2">
              <span className="w-8 text-[10px] text-mute">{label}</span>
              <div className="relative h-10 flex-1 rounded bg-ink">
                <div
                  className="absolute bottom-0 top-0 w-px bg-accent"
                  style={{ left: `${(playhead / duration) * 100}%` }}
                />
                {project.clips
                  .filter((clip) => clip.track === track)
                  .map((clip) => (
                    <button
                      key={clip.id}
                      type="button"
                      onClick={() => {
                        setState((c) => ({ ...c, selectedId: clip.id }));
                        if (sourceRef.current) sourceRef.current.src = clip.src;
                      }}
                      onPointerDown={(event) => {
                        if (tool !== "select" && tool !== "ripple" && tool !== "slide") return;
                        const startX = event.clientX;
                        const origin = clip.start;
                        const move = (moveEvent: PointerEvent) => {
                          const dx = (moveEvent.clientX - startX) / 40;
                          patchClip(clip.id, { start: Math.max(0, origin + dx) });
                        };
                        const up = () => {
                          window.removeEventListener("pointermove", move);
                          window.removeEventListener("pointerup", up);
                        };
                        window.addEventListener("pointermove", move);
                        window.addEventListener("pointerup", up);
                      }}
                      className={`absolute top-1 h-8 overflow-hidden rounded px-2 text-left text-[10px] ${
                        clip.id === project.selectedId ? "bg-accent text-ink" : "bg-line text-cream"
                      }`}
                      style={{
                        left: `${(clip.start / duration) * 100}%`,
                        width: `${(clip.duration / duration) * 100}%`,
                      }}
                    >
                      {clip.name}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </StudioShell>
  );
}
