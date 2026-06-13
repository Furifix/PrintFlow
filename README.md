# PrintFlow

Automate uploading print-on-demand t-shirt designs to Printify and publishing them to Shopify.

## Quick Start

```bash
npm install
npm run dev     # development — Vite on port 3006, Express on port 3005
npm start       # production — Express on port 3005 (serves built frontend)
```

> **First launch:** Open `http://localhost:3006` (dev) or `http://localhost:3005` (prod) and complete the Setup Wizard before using the app.

## How It Works

1. **Setup Wizard** — Enter your Printify API key, select your shop and blueprint, map background images to each color variant, and set default pricing.
2. **Upload** — Drag-and-drop your design PNGs (Design A for light shirts, Design B for dark shirts).
3. **Mockup Review** — Canvas-composited mockups are generated for every configured color. Toggle colors on/off.
4. **Publish Review** — Review and edit title/price/sizes, then save as draft or publish directly to Shopify via Printify.
5. **Library** — Browse your Printify products, filter by status, and duplicate setups.

## Ports

| Mode | Port |
|:---|:---|
| Express API (both modes) | 3005 |
| Vite dev server | 3006 |

## Tech Stack

- **Backend:** Node.js + Express (proxies all Printify API calls)
- **Frontend:** React + Vite + Tailwind CSS
- **Mockups:** HTML5 Canvas API (client-side compositing)
- **Uploads:** Multer (stored in `/uploads/backgrounds/`)
- **Persistence:** Local JSON in `/data/`
