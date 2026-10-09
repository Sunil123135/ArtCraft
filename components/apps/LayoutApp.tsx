"use client";

import { useMemo, useRef, useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Field, Panel, StudioShell, ToolButton } from "@/components/studio/StudioShell";
import { getApp } from "@/lib/apps";
import { useHistory } from "@/lib/history";
import { bytesToBlob, downloadBlob, readFileAsDataUrl, uid } from "@/lib/id";

type Frame = {
  id: string;
  type: "text" | "image" | "shape";
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  style: string;
  swatch: string;
  wrap: boolean;
  src?: string;
  parent: boolean;
};

type Spread = {
  id: string;
  name: string;
  frames: Frame[];
};

type Doc = {
  name: string;
  width: number;
  height: number;
  bleed: number;
  pages: Spread[];
  pageId: string;
  selectedId: string | null;
  styles: { name: string; size: number; font: string }[];
  swatches: string[];
};

const app = getApp("layout")!;

function starter(): Doc {
  const pageId = "p1";
  return {
    name: "Folio",
    width: 612,
    height: 792,
    bleed: 9,
    pageId,
    selectedId: "t1",
    styles: [
      { name: "Display", size: 36, font: "Georgia" },
      { name: "Body", size: 13, font: "Georgia" },
      { name: "Caption", size: 10, font: "Helvetica" },
    ],
    swatches: ["#0b0b0c", "#f3eee4", "#e8a87c", "#7cb8e8", "#8fbc8f"],
    pages: [
      {
        id: pageId,
        name: "Page 1",
        frames: [
          {
            id: "header",
            type: "text",
            x: 48,
            y: 36,
            w: 516,
            h: 24,
            text: "ATELIER  ·  ISSUE 01",
            style: "Caption",
            swatch: "#8b8578",
            wrap: false,
            parent: true,
          },
          {
            id: "t1",
            type: "text",
            x: 48,
            y: 96,
            w: 300,
            h: 200,
            text: "Seven tools.\nOne workshop.",
            style: "Display",
            swatch: "#f3eee4",
            wrap: true,
            parent: false,
          },
          {
            id: "t2",
            type: "text",
            x: 48,
            y: 320,
            w: 300,
            h: 280,
            text: "Spreads and parent pages, threaded stories, styles, swatches and text wrap. Line breaks stay consistent from screen to PDF.",
            style: "Body",
            swatch: "#c8c0b2",
            wrap: true,
            parent: false,
          },
          {
            id: "s1",
            type: "shape",
            x: 380,
            y: 120,
            w: 180,
            h: 240,
            style: "Body",
            swatch: "#e8a87c",
            wrap: true,
            parent: false,
          },
        ],
      },
    ],
  };
}

export function LayoutApp() {
  const { state: doc, setState, undo, redo } = useHistory<Doc>(starter());
  const [menu, setMenu] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "text" | "image" | "shape" | "guide">("select");
  const [showGrid, setShowGrid] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: string; x: number; y: number; ox: number; oy: number } | null>(null);

  const page = useMemo(
    () => doc.pages.find((item) => item.id === doc.pageId) ?? doc.pages[0],
    [doc.pages, doc.pageId],
  );
  const selected = page?.frames.find((frame) => frame.id === doc.selectedId) ?? null;

  const patchFrame = (id: string, patch: Partial<Frame>) => {
    setState((current) => ({
      ...current,
      pages: current.pages.map((spread) =>
        spread.id === current.pageId
          ? {
              ...spread,
              frames: spread.frames.map((frame) => (frame.id === id ? { ...frame, ...patch } : frame)),
            }
          : spread,
      ),
    }));
  };

  const addFrame = (type: Frame["type"], x = 80, y = 80) => {
    const frame: Frame = {
      id: uid(type),
      type,
      x,
      y,
      w: type === "text" ? 240 : 180,
      h: type === "text" ? 140 : 180,
      text: type === "text" ? "New story." : undefined,
      style: "Body",
      swatch: type === "shape" ? "#e8a87c" : "#f3eee4",
      wrap: true,
      parent: false,
    };
    setState((current) => ({
      ...current,
      selectedId: frame.id,
      pages: current.pages.map((spread) =>
        spread.id === current.pageId ? { ...spread, frames: [...spread.frames, frame] } : spread,
      ),
    }));
  };

  const exportPdf = async () => {
    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.TimesRoman);
    const caption = await pdf.embedFont(StandardFonts.Helvetica);
    for (const spread of doc.pages) {
      const pageNode = pdf.addPage([doc.width, doc.height]);
      if (doc.bleed) {
        pageNode.drawRectangle({
          x: 6,
          y: 6,
          width: doc.width - 12,
          height: doc.height - 12,
          borderColor: rgb(0.7, 0.7, 0.7),
          borderWidth: 0.4,
        });
      }
      for (const frame of spread.frames) {
        const y = doc.height - frame.y - frame.h;
        if (frame.type === "shape") {
          const hex = frame.swatch.replace("#", "");
          const r = parseInt(hex.slice(0, 2), 16) / 255;
          const g = parseInt(hex.slice(2, 4), 16) / 255;
          const b = parseInt(hex.slice(4, 6), 16) / 255;
          pageNode.drawRectangle({
            x: frame.x,
            y,
            width: frame.w,
            height: frame.h,
            color: rgb(r || 0.8, g || 0.6, b || 0.4),
          });
        } else if (frame.type === "text") {
          const style = doc.styles.find((item) => item.name === frame.style) ?? doc.styles[1];
          pageNode.drawText(frame.text ?? "", {
            x: frame.x,
            y: y + frame.h - (style?.size ?? 13),
            size: style?.size ?? 13,
            font: frame.style === "Caption" ? caption : regular,
            maxWidth: frame.w,
            color: rgb(0.95, 0.93, 0.89),
          });
        } else if (frame.type === "image" && frame.src) {
          const png = frame.src.startsWith("data:image/png")
            ? await pdf.embedPng(frame.src)
            : await pdf.embedJpg(frame.src);
          pageNode.drawImage(png, { x: frame.x, y, width: frame.w, height: frame.h });
        }
      }
    }
    const bytes = await pdf.save();
    downloadBlob(bytesToBlob(bytes, "application/pdf"), `${doc.name}.pdf`);
  };

  return (
    <StudioShell
      app={app}
      openMenu={menu}
      onOpenMenu={setMenu}
      status={`${doc.name} · ${page?.name ?? "Spread"} · ${doc.width}×${doc.height} · bleed ${doc.bleed}pt`}
      menus={[
        {
          label: "File",
          items: [
            { label: "New document", onSelect: () => setState(starter()) },
            { label: "Place image…", onSelect: () => fileRef.current?.click() },
            { label: "Export PDF", onSelect: () => void exportPdf() },
          ],
        },
        { label: "Edit", items: [{ label: "Undo", onSelect: undo }, { label: "Redo", onSelect: redo }] },
        {
          label: "Layout",
          items: [
            {
              label: "Add page",
              onSelect: () =>
                setState((c) => {
                  const id = uid("page");
                  return {
                    ...c,
                    pageId: id,
                    pages: [
                      ...c.pages,
                      {
                        id,
                        name: `Page ${c.pages.length + 1}`,
                        frames: c.pages[0]?.frames.filter((f) => f.parent) ?? [],
                      },
                    ],
                  };
                }),
            },
            { label: "Toggle baseline grid", onSelect: () => setShowGrid((g) => !g) },
          ],
        },
      ]}
      tools={
        <>
          {(
            [
              ["select", "Se"],
              ["text", "Ty"],
              ["image", "Im"],
              ["shape", "Sh"],
              ["guide", "Gu"],
            ] as const
          ).map(([id, label]) => (
            <ToolButton key={id} label={label} active={tool === id} onClick={() => setTool(id)} />
          ))}
        </>
      }
      inspector={
        <>
          <Panel title="Pages">
            {doc.pages.map((spread) => (
              <button
                key={spread.id}
                type="button"
                onClick={() => setState((c) => ({ ...c, pageId: spread.id }))}
                className={`mb-1 block w-full rounded px-2 py-1.5 text-left text-[12px] ${
                  spread.id === doc.pageId ? "bg-line" : "hover:bg-panel-2"
                }`}
              >
                {spread.name}
              </button>
            ))}
          </Panel>
          {selected ? (
            <Panel title="Frame">
              <Field label="Style">
                <select
                  className="w-full rounded border border-line bg-ink px-2 py-1 text-[12px]"
                  value={selected.style}
                  onChange={(e) => patchFrame(selected.id, { style: e.target.value })}
                >
                  {doc.styles.map((style) => (
                    <option key={style.name}>{style.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Swatch">
                <div className="flex gap-1">
                  {doc.swatches.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      className="h-6 w-6 rounded border border-line"
                      style={{ background: swatch }}
                      onClick={() => patchFrame(selected.id, { swatch })}
                    />
                  ))}
                </div>
              </Field>
              {selected.type === "text" ? (
                <Field label="Story">
                  <textarea
                    className="h-28 w-full rounded border border-line bg-ink px-2 py-1 text-[12px]"
                    value={selected.text ?? ""}
                    onChange={(e) => patchFrame(selected.id, { text: e.target.value })}
                  />
                </Field>
              ) : null}
              <label className="flex items-center gap-2 text-[12px] text-cream-dim">
                <input
                  type="checkbox"
                  checked={selected.wrap}
                  onChange={(e) => patchFrame(selected.id, { wrap: e.target.checked })}
                />
                Text wrap
              </label>
              <label className="flex items-center gap-2 text-[12px] text-cream-dim">
                <input
                  type="checkbox"
                  checked={selected.parent}
                  onChange={(e) => patchFrame(selected.id, { parent: e.target.checked })}
                />
                Parent page item
              </label>
            </Panel>
          ) : null}
          <Panel title="Styles">
            {doc.styles.map((style) => (
              <p key={style.name} className="text-[12px] text-cream-dim">
                {style.name} · {style.font} · {style.size}pt
              </p>
            ))}
          </Panel>
        </>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const src = await readFileAsDataUrl(file);
          addFrame("image");
          const id = doc.selectedId;
          if (id) patchFrame(id, { src, type: "image" });
        }}
      />
      <div className="flex h-full items-center justify-center overflow-auto bg-[#111113] p-8">
        <div
          className="relative shadow-2xl"
          style={{
            width: doc.width,
            height: doc.height,
            background: "#1a1816",
            boxShadow: "0 0 0 9px #2a2622",
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            if (tool === "text" || tool === "shape" || tool === "image") {
              addFrame(tool, 72, 72);
            }
          }}
        >
          {showGrid
            ? Array.from({ length: 24 }, (_, i) => (
                <div
                  key={i}
                  className="pointer-events-none absolute right-8 left-8 border-t border-white/5"
                  style={{ top: 64 + i * 28 }}
                />
              ))
            : null}
          <div className="pointer-events-none absolute inset-8 border border-dashed border-white/15" />
          {page?.frames.map((frame) => {
            const style = doc.styles.find((item) => item.name === frame.style);
            return (
              <div
                key={frame.id}
                className={`absolute overflow-hidden ${
                  frame.id === doc.selectedId ? "outline outline-1 outline-accent" : ""
                }`}
                style={{
                  left: frame.x,
                  top: frame.y,
                  width: frame.w,
                  height: frame.h,
                  color: frame.swatch,
                  background: frame.type === "shape" ? frame.swatch : "transparent",
                  fontFamily: style?.font,
                  fontSize: style?.size,
                  lineHeight: showGrid ? "28px" : "1.4",
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setState((c) => ({ ...c, selectedId: frame.id }));
                  drag.current = { id: frame.id, x: event.clientX, y: event.clientY, ox: frame.x, oy: frame.y };
                }}
                onPointerMove={(event) => {
                  if (!drag.current || drag.current.id !== frame.id || tool !== "select") return;
                  patchFrame(frame.id, {
                    x: drag.current.ox + (event.clientX - drag.current.x),
                    y: drag.current.oy + (event.clientY - drag.current.y),
                  });
                }}
                onPointerUp={() => {
                  drag.current = null;
                }}
              >
                {frame.type === "text" ? frame.text : null}
                {frame.type === "image" && frame.src ? (
                  <img src={frame.src} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </StudioShell>
  );
}
