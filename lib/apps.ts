export type CraftStatus = "Early alpha" | "In development";

export type CraftApp = {
  slug: string;
  number: string;
  category: string;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  status: CraftStatus;
  platforms: string[];
  href: string;
  features: string[];
  accent: string;
};

export const CRAFT_APPS: CraftApp[] = [
  {
    slug: "photo",
    number: "01",
    category: "Image editor",
    name: "Photo",
    shortName: "Photo",
    tagline: "The image editor you already know how to use.",
    description:
      "Layers, masks, adjustment layers, layer styles, type, vectors and brushes in a browser studio. Offline-first, on your own files.",
    status: "Early alpha",
    platforms: ["Web", "macOS", "Windows", "Linux"],
    href: "/photo",
    accent: "#e8a87c",
    features: [
      "Familiar menus, shortcuts, panels and tools",
      "GPU-friendly canvas compositor with live preview",
      "Layered documents with raster, type and adjustment layers",
      "Non-destructive brightness, contrast, hue, saturation and invert",
      "Live filters: blur, sharpen, grain, vignette, posterize",
      "Layer styles: drop shadow, stroke and glow",
      "Marquee selection, brush, eraser, fill, gradient, crop and type",
      "Blend modes, opacity, reorder, lock and visibility",
      "On-canvas subject-style selection refine and mask paint",
      "Export PNG, JPEG and WebP",
    ],
  },
  {
    slug: "vector",
    number: "02",
    category: "Vector illustration",
    name: "Vector",
    shortName: "Vector",
    tagline: "Vector illustration, rebuilt for the browser.",
    description:
      "Pen, panels and shortcuts working illustrators expect — plus booleans, live effects, image tracing and open formats.",
    status: "In development",
    platforms: ["Web", "macOS", "Windows", "Linux"],
    href: "/vector",
    accent: "#7cb8e8",
    features: [
      "Pen, direct selection, shapes, type and artboards",
      "Shape booleans: unite, subtract, intersect and exclude",
      "Snapping, guides and an appearance panel",
      "Live editable effects: glow, shadow, repeat and envelope",
      "Image tracing with twelve presets",
      "Unlimited undo",
      "Native JSON documents plus SVG import and export",
      "PNG, JPEG and WebP output, including multi-size export",
    ],
  },
  {
    slug: "film",
    number: "03",
    category: "Video editing",
    name: "Film",
    shortName: "Film",
    tagline: "Professional video editing, rebuilt from scratch.",
    description:
      "Source and program monitors, a real timeline and every common trim, plus color, effects and a mixer — all in the tab.",
    status: "In development",
    platforms: ["Web", "macOS", "Windows", "Linux"],
    href: "/film",
    accent: "#e87c8a",
    features: [
      "Source and program monitors with three-point editing",
      "Timeline with video and audio tracks",
      "Ripple, roll, slip and slide-style trim handles",
      "J / K / L dynamic playback",
      "Frame-rate projects including 23.976, 24, 25, 29.97 and 30",
      "Color wheels, curves, HSL and LUT-style looks",
      "Video effects, transitions and keyframed opacity",
      "Mixer with clip gain and a loudness readout",
      "WebM export from the program monitor",
    ],
  },
  {
    slug: "light",
    number: "04",
    category: "Photo library",
    name: "Light",
    shortName: "Light",
    tagline: "Your photos. Your pixels. Your machine.",
    description:
      "A fast photo library and non-destructive developer. No account, no cloud, no telemetry.",
    status: "In development",
    platforms: ["Web", "macOS", "Windows", "Linux"],
    href: "/light",
    accent: "#c9b27a",
    features: [
      "Non-destructive develop pipeline — originals stay untouched",
      "Light, color, effects, tone curve and an 8-band mixer",
      "3-way color grading wheels and built-in looks",
      "Brush, linear and radial masks plus luminance ranges",
      "Albums, ratings, flags, search and a virtualized grid",
      "Before / after and snapshot compares",
      "Import JPEG, PNG, WebP and TIFF; export developed JPEGs",
    ],
  },
  {
    slug: "pdf",
    number: "05",
    category: "PDF workbench",
    name: "PDF",
    shortName: "PDF",
    tagline: "The open-source PDF workbench.",
    description:
      "Read, organize, combine, split and secure PDFs in a fast local workbench. No account, no cloud.",
    status: "Early alpha",
    platforms: ["Web", "macOS", "Windows", "Linux"],
    href: "/pdf",
    accent: "#8fbc8f",
    features: [
      "Faithful page rendering with zoom and continuous scroll",
      "Search as you type and text selection",
      "Rotate, delete, insert and reorder pages with undo",
      "Combine, extract and split while keeping page order",
      "Autosave-style working copy in the session",
      "Password-protect exports with AES-style encryption",
    ],
  },
  {
    slug: "motion",
    number: "06",
    category: "Motion graphics",
    name: "Motion",
    shortName: "Motion",
    tagline: "Motion graphics and visual effects, in the browser.",
    description:
      "Compositions, layers, keyframes, effects, cameras and a render queue — a compositor you can drive by hand or by script.",
    status: "In development",
    platforms: ["Web", "macOS", "Windows", "Linux"],
    href: "/motion",
    accent: "#b48fe0",
    features: [
      "Linear, bezier, hold and eased keyframes",
      "Solids, shapes, text, footage, nulls and adjustment layers",
      "Parenting, blend modes and track-matte style masks",
      "Blur, color, glow, distortion and generator effects",
      "3D-style camera orbit, pan and dolly on a scene",
      "Wiggle and loop expressions on transform properties",
      "WebM, PNG sequence and Lottie-style JSON export",
    ],
  },
  {
    slug: "layout",
    number: "07",
    category: "Page layout",
    name: "Layout",
    shortName: "Layout",
    tagline: "Page layout and publishing, rebuilt for the web.",
    description:
      "Spreads and parent pages, threaded stories, styles, swatches and text wrap in a layout app with print-ready PDF export.",
    status: "In development",
    platforms: ["Web", "macOS", "Windows", "Linux"],
    href: "/layout",
    accent: "#7cc4c4",
    features: [
      "Spreads, parent pages, frames and threaded stories",
      "Paragraph and character styles plus swatches",
      "Text wrap, baseline grid and margin guides",
      "Image frames with fit and fill",
      "Print-ready PDF with bleed and crop marks",
      "Multi-page documents with instant undo",
    ],
  },
];

export const PRINCIPLES = [
  {
    number: "01",
    title: "Open by default",
    body: "The studio is yours to read, fork and build on. Documents use open formats whenever a native file is saved.",
  },
  {
    number: "02",
    title: "Runs where you are",
    body: "Every bench compiles to a real web app. No install wall, no Electron wrapper between you and the work.",
  },
  {
    number: "03",
    title: "Familiar from day one",
    body: "Layouts, tools and shortcuts that working professionals already know, so there is nothing to relearn.",
  },
  {
    number: "04",
    title: "Your files, your machine",
    body: "Everything runs locally on your own files. Nothing is uploaded unless you export and choose to share it.",
  },
  {
    number: "05",
    title: "Agent-ready",
    body: "A command palette and JSON document model make every tool scriptable — built for automation and AI agents.",
  },
  {
    number: "06",
    title: "Also in your browser",
    body: "Photo, Vector, Light, PDF, Motion and Layout are first-class web apps. Film previews and exports without a desktop install.",
  },
];

export function getApp(slug: string): CraftApp | undefined {
  return CRAFT_APPS.find((app) => app.slug === slug);
}
