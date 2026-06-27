# PrintFlow


<img width="3744" height="1903" alt="image" src="https://github.com/user-attachments/assets/7d877a25-17fa-487e-8ecd-367f883c3b3d" />

> Automate print-on-demand workflows for Printify + Shopify.

PrintFlow is a Windows desktop application that streamlines the full upload-to-publish pipeline for print-on-demand sellers. Upload your designs, generate canvas-composited mockups for every color variant, review and edit product details, then publish directly to Shopify via the Printify API — all from a clean, fast UI.

![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![Built with React](https://img.shields.io/badge/built%20with-React-61dafb)

---

## Features

- **Setup Wizard** — Connect your Printify API key, select your shop, blueprint and print provider, map background images to each color variant, and configure default pricing in a guided flow
- **Dual Design Support** — Upload Design A (light shirts) and Design B (dark shirts) separately; the app automatically assigns the correct design per color
- **Canvas Mockup Generation** — Client-side HTML5 Canvas compositing overlays your design onto every configured background image with pixel-perfect placement control
- **Mockup Review** — Preview all generated mockups per color, toggle colors on/off, and fine-tune placement
- **Publish Review** — Edit title, price, compare-at price, and sizes before publishing. Save as draft or publish directly to Shopify via Printify
- **Library** — Browse all your Printify products, filter by status, and re-publish or duplicate setups
- **Dark Mode** — Full dark/light theme toggle, not dependent on browser preference
- **Custom Background Color** — Set a custom website background color from the Settings page
- **Windows Desktop App** — Easily package the application into a standalone Windows installer


<img width="1609" height="1375" alt="image" src="https://github.com/user-attachments/assets/b0bf9b6a-c791-4518-a692-5505ffbd31a0" />


---

## Tech Stack

| Layer | Technology |
|:---|:---|
| Desktop Framework | Electron |
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Mockups | HTML5 Canvas API (client-side) |
| File Uploads | Multer |
| Persistence | Local JSON files |

---

## Requirements

- **Node.js** v18 or higher
- A [Printify](https://printify.com) account with an API key
- _(Optional)_ A [Shopify](https://shopify.com) store with a custom app Admin API token (`write_products` scope) for automatic mockup image replacement

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/Furifix/printflow.git
cd printflow
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Create a `.env` file in the root directory:

```env
ENCRYPTION_KEY=your_random_64_char_hex_string
```

Generate a key with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Run the desktop app locally

```bash
npm run electron:start
```

### 5. Build the Windows installer

```bash
npm run electron:build
```

The resulting executable installer will be available in the `/dist` directory (e.g., `PrintFlow Setup 1.0.0.exe`).

---

## First Launch

Open the application and complete the **Setup Wizard**:

1. Enter your Printify API key and select your shop
2. Choose a blueprint (product type) and print provider
3. Map a background mockup image to each color variant
4. Set default pricing and sizes
5. _(Optional)_ Connect Shopify for automatic mockup image replacement after publishing

All configuration is saved locally in `data/settings.json` — **never committed to git**.

---

## Security Notes

- All Printify API calls are proxied through the Express backend — your API key is never exposed to the browser
- The `data/` directory (which contains your API keys and settings) and `uploads/` directory are excluded from version control via `.gitignore`
- Never commit your `.env` file or `data/settings.json`

---

## Project Structure

```
printflow/
├── src/
│   ├── components/       # Reusable React components
│   ├── context/          # React context providers
│   ├── pages/            # Page-level components (Upload, Settings, Library…)
│   └── utils/            # API helpers, canvas utilities, i18n
├── main.js               # Electron main process
├── server.js             # Express backend (API proxy + file serving)
└── dist/                 # Production build and packaged output — gitignored
```

---

## License

MIT — see [LICENSE](./LICENSE) for details.

---

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.
