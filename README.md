# PrintFlow

> Automate print-on-demand workflows for Printify + Shopify.

PrintFlow is a self-hosted web app that streamlines the full upload-to-publish pipeline for print-on-demand sellers. Upload your designs, generate canvas-composited mockups for every color variant, review and edit product details, then publish directly to Shopify via the Printify API — all from a clean, fast UI.

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
- **Runs as a System Service** — Ships with a `systemd` service file for persistent, always-on operation that survives reboots and hibernation
- **Reverse Proxy Ready** — Works behind Nginx Proxy Manager or any reverse proxy

<img width="3744" height="1903" alt="image" src="https://github.com/user-attachments/assets/7d877a25-17fa-487e-8ecd-367f883c3b3d" />

<img width="1609" height="1375" alt="image" src="https://github.com/user-attachments/assets/b0bf9b6a-c791-4518-a692-5505ffbd31a0" />


---

## Tech Stack

| Layer | Technology |
|:---|:---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Mockups | HTML5 Canvas API (client-side) |
| File Uploads | Multer |
| Persistence | Local JSON files in `/data/` |
| Security | Helmet, express-rate-limit, sanitized API proxying |

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

### 4. Run in development mode

```bash
npm run dev
```

- Frontend (Vite): [http://localhost:3006](http://localhost:3006)
- Backend (Express API): [http://localhost:3005](http://localhost:3005)

### 5. Build for production

```bash
npm run build
node server.js
```

The production server runs on **port 3005** and serves the built frontend from `/dist`.

---

## Running as a System Service (Linux)

PrintFlow ships with a `systemd` service file for persistent operation.

```bash
# Copy service file to systemd
sudo cp printflow.service /etc/systemd/system/printflow.service

# Reload systemd, enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable printflow.service
sudo systemctl start printflow.service

# Check status
systemctl status printflow.service
```

The service will automatically start on boot and restart itself on failure.

> **Note:** By default the server binds to `127.0.0.1:3005` (localhost only). If you're using a reverse proxy in Docker (e.g. Nginx Proxy Manager), add `Environment=BIND_HOST=0.0.0.0` to the `[Service]` section of the service file so it listens on all interfaces.

---

## Reverse Proxy (Nginx Proxy Manager)

| Setting | Value |
|:---|:---|
| Scheme | `http` |
| Forward Hostname / IP | `192.168.x.x` _(your server's LAN IP)_ or `127.0.0.1` _(if NPM is on the same host, not in Docker)_ |
| Forward Port | `3005` |
| Websockets Support | ✅ On |
| Force SSL | ✅ Recommended |

---

## First Launch

Open the app in your browser and complete the **Setup Wizard**:

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
├── server.js             # Express backend (API proxy + file serving)
├── printflow.service     # systemd service file
├── data/                 # Runtime data — gitignored (settings, mockup cache)
├── uploads/              # Uploaded background images — gitignored
└── dist/                 # Production build output — gitignored
```

---

## License

MIT — see [LICENSE](./LICENSE) for details.

---

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.
