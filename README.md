# Atelier

Seven browser studios for image editing, vector illustration, video, photography, PDFs, motion graphics and page layout. Files stay on your machine.

Inspired by the Crafting Apps lineup at [getartcraft.com/apps](https://getartcraft.com/apps). This is an original web workshop with its own name, copy and implementation — not a fork of the native Rust apps.

## The lineup

| App | Route | What it does |
| --- | --- | --- |
| Photo | `/photo` | Layered image editor: brush, type, adjustments, blend modes, export |
| Vector | `/vector` | SVG illustration: pen, booleans, live effects, 12-preset image trace |
| Film | `/film` | Timeline editor: source/program, JKL, grade, transitions, WebM export |
| Light | `/light` | Photo library and non-destructive develop module |
| PDF | `/pdf` | Read, search, reorder, merge, split and stamp PDFs |
| Motion | `/motion` | Keyframed compositor with camera tools and Lottie-style JSON |
| Layout | `/layout` | Spreads, styles, parent pages and print-ready PDF |

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production

```bash
npm run build
npm start
```

## Notes

Everything runs in the browser. Import local files; nothing is uploaded to a server.
