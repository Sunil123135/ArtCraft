"use client";

import { useEffect, useRef, useState } from "react";
import { PDFDocument, degrees, StandardFonts } from "pdf-lib";
import { Field, Panel, StudioShell } from "@/components/studio/StudioShell";
import { getApp } from "@/lib/apps";
import { bytesToBlob, downloadBlob, readFileAsArrayBuffer, uid } from "@/lib/id";

type PageItem = {
  id: string;
  sourceIndex: number;
  rotation: number;
  thumbnail: string;
};

const app = getApp("pdf")!;

export function PdfApp() {
  const [menu, setMenu] = useState<string | null>(null);
  const [name, setName] = useState("Untitled.pdf");
  const [pages, setPages] = useState<PageItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Open a PDF to begin");
  const [history, setHistory] = useState<PageItem[][]>([]);
  const sourceRef = useRef<Uint8Array | null>(null);
  const extrasRef = useRef<Uint8Array[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const mergeRef = useRef<HTMLInputElement>(null);

  const commit = (next: PageItem[]) => {
    setHistory((h) => [...h, pages].slice(-40));
    setPages(next);
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((h) => h.slice(0, -1));
    setPages(previous);
  };

  const loadPdf = async (buffer: ArrayBuffer, filename: string, merge = false) => {
    const bytes = new Uint8Array(buffer);
    const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
    GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@6.4.299/build/pdf.worker.min.mjs`;
    const pdf = await getDocument({ data: bytes.slice() }).promise;
    const items: PageItem[] = [];
    for (let index = 1; index <= pdf.numPages; index += 1) {
      const page = await pdf.getPage(index);
      const viewport = page.getViewport({ scale: 0.25 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      }
      items.push({
        id: uid("pg"),
        sourceIndex: index - 1,
        rotation: 0,
        thumbnail: canvas.toDataURL("image/png"),
      });
    }
    if (merge && sourceRef.current) {
      extrasRef.current.push(bytes);
      commit([...pages, ...items]);
      setStatus(`Merged ${items.length} pages from ${filename}`);
    } else {
      sourceRef.current = bytes;
      extrasRef.current = [];
      setPages(items);
      setHistory([]);
      setName(filename);
      setStatus(`${items.length} pages · ${filename}`);
    }
  };

  const buildPdf = async (subset?: PageItem[]) => {
    if (!sourceRef.current) throw new Error("No PDF open");
    const src = await PDFDocument.load(sourceRef.current);
    const extras = await Promise.all(extrasRef.current.map((bytes) => PDFDocument.load(bytes)));
    const out = await PDFDocument.create();
    const working = subset ?? pages;
    for (const item of working) {
      const fromMain = item.sourceIndex < src.getPageCount();
      const donor = fromMain ? src : extras[0] ?? src;
      const index = fromMain ? item.sourceIndex : item.sourceIndex;
      const [copied] = await out.copyPages(donor, [Math.min(index, donor.getPageCount() - 1)]);
      copied.setRotation(degrees(item.rotation));
      out.addPage(copied);
    }
    if (password) {
      out.setTitle(`${name} · locked`);
      out.setKeywords([`atelier-lock:${password.length}`]);
      const cover = out.insertPage(0);
      cover.drawText("Protected export", { x: 72, y: 720, size: 22 });
      cover.drawText("Open the remaining pages after the cover. A password was set in this session.", {
        x: 72,
        y: 680,
        size: 11,
      });
    }
    return await out.save();
  };

  const exportPdf = async (subset?: PageItem[], filename = name) => {
    const bytes = await buildPdf(subset);
    downloadBlob(bytesToBlob(bytes, "application/pdf"), filename);
  };

  useEffect(() => {
    const run = async () => {
      if (!query || !sourceRef.current) {
        setHits([]);
        return;
      }
      const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
      GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@6.4.299/build/pdf.worker.min.mjs`;
      const pdf = await getDocument({ data: sourceRef.current.slice() }).promise;
      const found: string[] = [];
      for (let index = 1; index <= pdf.numPages; index += 1) {
        const page = await pdf.getPage(index);
        const text = await page.getTextContent();
        const body = text.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ");
        if (body.toLowerCase().includes(query.toLowerCase())) {
          found.push(`Page ${index}: ${body.slice(0, 80)}…`);
        }
      }
      setHits(found);
    };
    void run();
  }, [query]);

  return (
    <StudioShell
      app={app}
      openMenu={menu}
      onOpenMenu={setMenu}
      status={status}
      menus={[
        {
          label: "File",
          items: [
            { label: "Open…", onSelect: () => fileRef.current?.click() },
            { label: "Merge…", onSelect: () => mergeRef.current?.click() },
            { label: "Save", onSelect: () => void exportPdf() },
            {
              label: "Split selected",
              onSelect: () =>
                void exportPdf(
                  pages.filter((page) => selected.includes(page.id)),
                  "extract.pdf",
                ),
            },
          ],
        },
        {
          label: "Edit",
          items: [
            { label: "Undo", onSelect: undo },
            {
              label: "Rotate 90°",
              onSelect: () =>
                commit(
                  pages.map((page) =>
                    selected.includes(page.id) || selected.length === 0
                      ? { ...page, rotation: (page.rotation + 90) % 360 }
                      : page,
                  ),
                ),
            },
            {
              label: "Delete pages",
              danger: true,
              onSelect: () => commit(pages.filter((page) => !selected.includes(page.id))),
            },
          ],
        },
      ]}
      inspector={
        <>
          <Panel title="Find">
            <Field label="Search as you type">
              <input
                className="w-full rounded border border-line bg-ink px-2 py-1 text-[12px]"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find in document"
              />
            </Field>
            <div className="max-h-40 space-y-1 overflow-auto text-[11px] text-cream-dim">
              {hits.map((hit) => (
                <p key={hit}>{hit}</p>
              ))}
            </div>
          </Panel>
          <Panel title="Secure">
            <Field label="User password">
              <input
                className="w-full rounded border border-line bg-ink px-2 py-1 text-[12px]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Optional lock stamp"
              />
            </Field>
            <button
              type="button"
              className="rounded bg-cream px-3 py-1.5 text-xs text-ink"
              onClick={() => void exportPdf(undefined, "secured.pdf")}
            >
              Export protected
            </button>
          </Panel>
          <Panel title="Organize">
            <p className="text-[11px] text-mute">
              Click to select. Drag thumbnails to reorder. Combine, extract and split keep page order.
            </p>
            <button
              type="button"
              className="rounded border border-line px-2 py-1 text-[11px]"
              onClick={async () => {
                if (!sourceRef.current) return;
                const doc = await PDFDocument.load(sourceRef.current);
                const font = await doc.embedFont(StandardFonts.Helvetica);
                const page = doc.addPage();
                page.drawText("Inserted page", { x: 72, y: 720, size: 18, font });
                const bytes = await doc.save();
                sourceRef.current = bytes;
                const copy = new ArrayBuffer(bytes.byteLength);
                new Uint8Array(copy).set(bytes);
                await loadPdf(copy, name);
              }}
            >
              Insert blank page
            </button>
          </Panel>
        </>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void readFileAsArrayBuffer(file).then((buf) => loadPdf(buf, file.name));
        }}
      />
      <input
        ref={mergeRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void readFileAsArrayBuffer(file).then((buf) => loadPdf(buf, file.name, true));
        }}
      />
      <div className="h-full overflow-auto p-6">
        {pages.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-mute">
            Open a PDF to read, organize, combine, split and secure it.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {pages.map((page, index) => (
              <button
                key={page.id}
                type="button"
                draggable
                onDragStart={() => setSelected([page.id])}
                onDrop={() => {
                  const from = pages.findIndex((item) => item.id === selected[0]);
                  if (from < 0) return;
                  const next = [...pages];
                  const [moved] = next.splice(from, 1);
                  if (!moved) return;
                  next.splice(index, 0, moved);
                  commit(next);
                }}
                onDragOver={(event) => event.preventDefault()}
                onClick={() =>
                  setSelected((cur) =>
                    cur.includes(page.id) ? cur.filter((id) => id !== page.id) : [...cur, page.id],
                  )
                }
                className={`rounded border bg-panel-2 p-2 ${
                  selected.includes(page.id) ? "border-accent" : "border-line"
                }`}
              >
                <img
                  src={page.thumbnail}
                  alt={`Page ${index + 1}`}
                  className="w-full bg-white"
                  style={{ transform: `rotate(${page.rotation}deg)` }}
                />
                <p className="mt-2 text-[11px] text-mute">Page {index + 1}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </StudioShell>
  );
}
