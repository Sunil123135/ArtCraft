"use client";

import { useMemo, useRef, useState } from "react";
import { Field, Panel, StudioShell } from "@/components/studio/StudioShell";
import { getApp } from "@/lib/apps";
import { useHistory } from "@/lib/history";
import { downloadDataUrl, readFileAsDataUrl, uid } from "@/lib/id";

type Photo = {
  id: string;
  name: string;
  src: string;
  rating: number;
  flagged: boolean;
  album: string;
  develop: Develop;
};

type Develop = {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  temp: number;
  tint: number;
  vibrance: number;
  saturation: number;
  clarity: number;
  dehaze: number;
  grain: number;
  vignette: number;
  curve: number;
  mask: "none" | "linear" | "radial" | "brush" | "luminance";
};

const LOOKS = [
  "None",
  "Portrait",
  "Landscape",
  "Chrome",
  "Mono",
  "Film",
  "Warm",
  "Cool",
  "Fade",
  "Punch",
  "Night",
  "Soft",
  "Studio",
  "Paper",
  "Teal",
  "Amber",
  "Fog",
  "Sun",
] as const;

const BANDS = ["Reds", "Oranges", "Yellows", "Greens", "Aquas", "Blues", "Purples", "Magentas"] as const;

const app = getApp("light")!;

const blankDevelop = (): Develop => ({
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temp: 0,
  tint: 0,
  vibrance: 0,
  saturation: 0,
  clarity: 0,
  dehaze: 0,
  grain: 0,
  vignette: 0,
  curve: 0,
  mask: "none",
});

export function LightApp() {
  const { state, setState, undo, redo } = useHistory<{ photos: Photo[]; selectedId: string | null; album: string }>({
    photos: [],
    selectedId: null,
    album: "All photographs",
  });
  const [menu, setMenu] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [before, setBefore] = useState(false);
  const [mixer, setMixer] = useState<Record<(typeof BANDS)[number], number>>(
    Object.fromEntries(BANDS.map((band) => [band, 0])) as Record<(typeof BANDS)[number], number>,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = useMemo(
    () => state.photos.find((photo) => photo.id === state.selectedId) ?? null,
    [state.photos, state.selectedId],
  );

  const albums = ["All photographs", ...new Set(state.photos.map((photo) => photo.album))];
  const visible = state.photos.filter((photo) => {
    const albumOk = state.album === "All photographs" || photo.album === state.album;
    const queryOk = photo.name.toLowerCase().includes(query.toLowerCase());
    return albumOk && queryOk;
  });

  const filterCss = selected && !before
    ? [
        `brightness(${100 + selected.develop.exposure + selected.develop.whites / 4}%)`,
        `contrast(${100 + selected.develop.contrast + selected.develop.curve / 2}%)`,
        `saturate(${100 + selected.develop.saturation + selected.develop.vibrance / 2}%)`,
        `hue-rotate(${selected.develop.temp + selected.develop.tint}deg)`,
      ].join(" ")
    : "none";

  const applyLook = (look: (typeof LOOKS)[number]) => {
    if (!selected) return;
    const presets: Record<string, Partial<Develop>> = {
      Portrait: { shadows: 12, vibrance: 10, temp: 8 },
      Landscape: { clarity: 18, dehaze: 12, saturation: 8 },
      Chrome: { contrast: 18, whites: 10 },
      Mono: { saturation: -100 },
      Film: { grain: 18, vignette: 16, contrast: 6 },
      Warm: { temp: 22, tint: 6 },
      Cool: { temp: -20, tint: -8 },
      Fade: { contrast: -12, blacks: 18 },
      Punch: { contrast: 20, vibrance: 16 },
      Night: { exposure: -12, dehaze: 10, temp: -10 },
      Soft: { clarity: -16, shadows: 14 },
      Studio: { contrast: 10, whites: 8, blacks: -8 },
      Paper: { contrast: -6, grain: 8 },
      Teal: { temp: -16, tint: -10, saturation: 6 },
      Amber: { temp: 24, vibrance: 8 },
      Fog: { dehaze: -16, clarity: -10 },
      Sun: { exposure: 10, temp: 16, highlights: -8 },
    };
    patchDevelop({ ...blankDevelop(), ...presets[look] });
  };

  const patchDevelop = (patch: Partial<Develop>) => {
    if (!selected) return;
    setState((current) => ({
      ...current,
      photos: current.photos.map((photo) =>
        photo.id === selected.id ? { ...photo, develop: { ...photo.develop, ...patch } } : photo,
      ),
    }));
  };

  const exportJpeg = () => {
    if (!selected) return;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.filter = filterCss;
      ctx.drawImage(image, 0, 0);
      downloadDataUrl(canvas.toDataURL("image/jpeg", 0.92), `${selected.name.replace(/\.\w+$/, "")}-developed.jpg`);
    };
    image.src = selected.src;
  };

  return (
    <StudioShell
      app={app}
      openMenu={menu}
      onOpenMenu={setMenu}
      status={`${visible.length} photos · ${state.album}`}
      menus={[
        {
          label: "File",
          items: [
            { label: "Import…", onSelect: () => fileRef.current?.click() },
            { label: "Export JPEG", onSelect: exportJpeg },
          ],
        },
        {
          label: "Edit",
          items: [
            { label: "Undo", onSelect: undo },
            { label: "Redo", onSelect: redo },
            { label: "Reset develop", onSelect: () => patchDevelop(blankDevelop()) },
          ],
        },
        {
          label: "Photo",
          items: [
            {
              label: "Toggle flag",
              onSelect: () =>
                selected &&
                setState((c) => ({
                  ...c,
                  photos: c.photos.map((p) => (p.id === selected.id ? { ...p, flagged: !p.flagged } : p)),
                })),
            },
          ],
        },
      ]}
      inspector={
        <>
          <Panel title="Library">
            <input
              className="w-full rounded border border-line bg-ink px-2 py-1 text-[12px]"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="mt-2 space-y-1">
              {albums.map((album) => (
                <button
                  key={album}
                  type="button"
                  onClick={() => setState((c) => ({ ...c, album }))}
                  className={`block w-full rounded px-2 py-1 text-left text-[12px] ${
                    state.album === album ? "bg-line" : "hover:bg-panel-2"
                  }`}
                >
                  {album}
                </button>
              ))}
            </div>
          </Panel>
          {selected ? (
            <>
              <Panel title="Light">
                {(
                  [
                    ["exposure", "Exposure"],
                    ["contrast", "Contrast"],
                    ["highlights", "Highlights"],
                    ["shadows", "Shadows"],
                    ["whites", "Whites"],
                    ["blacks", "Blacks"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      value={selected.develop[key]}
                      onChange={(e) => patchDevelop({ [key]: Number(e.target.value) })}
                    />
                  </Field>
                ))}
              </Panel>
              <Panel title="Color">
                {(
                  [
                    ["temp", "Temp"],
                    ["tint", "Tint"],
                    ["vibrance", "Vibrance"],
                    ["saturation", "Saturation"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      value={selected.develop[key]}
                      onChange={(e) => patchDevelop({ [key]: Number(e.target.value) })}
                    />
                  </Field>
                ))}
              </Panel>
              <Panel title="Effects">
                {(
                  [
                    ["clarity", "Clarity"],
                    ["dehaze", "Dehaze"],
                    ["grain", "Grain"],
                    ["vignette", "Vignette"],
                    ["curve", "Tone curve"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      value={selected.develop[key]}
                      onChange={(e) => patchDevelop({ [key]: Number(e.target.value) })}
                    />
                  </Field>
                ))}
              </Panel>
              <Panel title="8-band mixer">
                {BANDS.map((band) => (
                  <Field key={band} label={band}>
                    <input
                      type="range"
                      min={-40}
                      max={40}
                      value={mixer[band]}
                      onChange={(e) => setMixer((m) => ({ ...m, [band]: Number(e.target.value) }))}
                    />
                  </Field>
                ))}
              </Panel>
              <Panel title="Looks">
                <div className="grid grid-cols-2 gap-1">
                  {LOOKS.map((look) => (
                    <button
                      key={look}
                      type="button"
                      className="rounded border border-line px-2 py-1 text-[11px]"
                      onClick={() => applyLook(look)}
                    >
                      {look}
                    </button>
                  ))}
                </div>
              </Panel>
              <Panel title="Mask">
                <select
                  className="w-full rounded border border-line bg-ink px-2 py-1 text-[12px]"
                  value={selected.develop.mask}
                  onChange={(e) => patchDevelop({ mask: e.target.value as Develop["mask"] })}
                >
                  <option value="none">None</option>
                  <option value="linear">Linear</option>
                  <option value="radial">Radial</option>
                  <option value="brush">Brush</option>
                  <option value="luminance">Luminance</option>
                </select>
              </Panel>
            </>
          ) : null}
        </>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = e.target.files;
          if (!files) return;
          const photos: Photo[] = [];
          for (const file of Array.from(files)) {
            photos.push({
              id: uid("ph"),
              name: file.name,
              src: await readFileAsDataUrl(file),
              rating: 0,
              flagged: false,
              album: "Import",
              develop: blankDevelop(),
            });
          }
          setState((c) => ({
            ...c,
            photos: [...c.photos, ...photos],
            selectedId: photos[0]?.id ?? c.selectedId,
          }));
        }}
      />
      <div className="flex h-full flex-col">
        <div className="flex min-h-0 flex-1 items-center justify-center bg-black p-6">
          {selected ? (
            <div className="relative">
              <img
                src={selected.src}
                alt={selected.name}
                className="max-h-[62vh] max-w-full object-contain"
                style={{
                  filter: filterCss,
                  boxShadow:
                    selected.develop.vignette > 0
                      ? `inset 0 0 ${selected.develop.vignette * 4}px rgba(0,0,0,0.8)`
                      : undefined,
                }}
              />
              <button
                type="button"
                className="absolute right-3 top-3 rounded bg-black/60 px-2 py-1 text-[11px]"
                onClick={() => setBefore((b) => !b)}
              >
                {before ? "After" : "Before"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-mute">Import a catalog to develop.</p>
          )}
        </div>
        <div className="flex h-36 gap-2 overflow-x-auto border-t border-line bg-panel p-2">
          {visible.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setState((c) => ({ ...c, selectedId: photo.id }))}
              className={`relative h-full w-28 shrink-0 overflow-hidden rounded ${
                photo.id === state.selectedId ? "ring-2 ring-accent" : ""
              }`}
            >
              <img src={photo.src} alt="" className="h-full w-full object-cover" />
              <span className="absolute bottom-1 left-1 text-[10px] text-white">
                {"★".repeat(photo.rating)}
                {photo.flagged ? " ▣" : ""}
              </span>
              <span
                className="absolute right-1 top-1 flex gap-0.5"
                onClick={(event) => event.stopPropagation()}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className="text-[10px]"
                    onClick={() =>
                      setState((c) => ({
                        ...c,
                        photos: c.photos.map((p) =>
                          p.id === photo.id ? { ...p, rating: star } : p,
                        ),
                      }))
                    }
                  >
                    {photo.rating >= star ? "★" : "☆"}
                  </button>
                ))}
              </span>
            </button>
          ))}
        </div>
      </div>
    </StudioShell>
  );
}
