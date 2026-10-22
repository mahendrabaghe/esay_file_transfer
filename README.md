# QuickDrop — Scan. Share. Done.

Private, instant file sharing between any two devices. Open a drop on the laptop, scan the QR with a phone, and send photos, videos, documents, links, or text. Files appear on the laptop in real time, then clean themselves up.

No app install. No account. No permanent cloud copy.

> **Live app:** deploy the included Render Blueprint with one click.  
> **GitHub Pages cannot host QuickDrop** because it only serves static files; the live app needs the Node/Socket.IO server in this repository.
>
> [Deploy QuickDrop to Render](https://render.com/deploy?repo=https://github.com/mahendrabaghe/esay_file_transfer)

## Highlights

- One click opens a live receiving session with a scannable QR code, session ID, expiry timer, and connection status.
- Phone-first sender for photos, videos, documents, archives, audio, text notes, and links.
- Chunked, resumable uploads with live progress, transfer speed, automatic retry, and cancel.
- Files appear automatically on the receiver over Socket.IO, with image previews, individual downloads, and a download-all ZIP.
- Drag-and-drop upload from the receiving laptop as well.
- Responsive, premium UI with light/dark themes and purpose-built loading, expired, invalid-link, and connection states.
- Temporary by design: uploaded files live on the server only until the drop ends or the retention window passes.

## How it works

1. The laptop calls `POST /api/sessions` and receives two independent bearer tokens: a **receiver token** and a **sender token**.
2. The laptop opens `/receive/<receiver-token>`. Only this URL can view the receiver dashboard.
3. The QR encodes `/s/<sender-token>` using the public app origin. The sender token is never the receiver token, so scanning cannot expose the laptop dashboard.
4. The phone uploads in SHA-256-verified chunks. The server assembles the file, emits `file:new` to the receiver, and returns per-file download and preview links protected by a random file access token.
5. Activity slides the session expiry forward. When the drop is stopped, expires, or restarts, tokens stop working and temporary files are removed.

The session code (`QD-XXXX-XXXX`) is a human-friendly identifier for display and copying; it is not an authentication credential.

## Quick start

Requirements: **Node.js 20.11+** and npm (the project uses npm workspaces).

### Production-style, one service

```bash
npm install
npm run build
npm start
```

Open <http://localhost:3001>. The Express server serves both the API, the Socket.IO endpoint, and the built React app.

For any non-local hostname, use HTTPS so tokens and file bytes travel over TLS and the browser can open secure WebSockets (`wss://`). QuickDrop also needs a secure context for reliable clipboard access, so run it behind TLS in production.

### Development

```bash
npm install
cp server/.env.example server/.env
cp client/.env.example client/.env
npm run dev
```

- Web app with Vite HMR: <http://localhost:5173>
- API and realtime server: <http://localhost:3001>
- Vite proxies `/api` and `/socket.io` to port 3001.

Run only the server tests with:

```bash
npm test
```

## Configuration

### Server (`server/.env` or hosting environment variables)

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` enables production defaults and static client serving. |
| `PORT` | `3001` | HTTP port. |
| `SERVE_CLIENT` | auto | Serve `client/dist` from Express when a build exists (always in production). Set `false` for a split frontend. |
| `CLIENT_ORIGINS` | empty | Comma-separated allowed browser origins. Empty allows any origin; set this when frontend and API are on different origins. |
| `TRUST_PROXY` | `1` in production | Number of trusted reverse-proxy hops. |
| `STORAGE_DIR` | `storage` | Directory for temporary uploads, relative to `server/` unless absolute. |
| `SESSION_TTL_MINUTES` | `30` | Idle lifetime of an active drop (1–1440). |
| `FILE_RETENTION_MINUTES` | `60` | Download lifetime of each delivered file (1–10080). |
| `UPLOAD_TTL_MINUTES` | `60` | Idle lifetime of an incomplete upload. |
| `MAX_FILE_SIZE_MB` | `2048` | Per-file limit (up to 51200). |
| `MAX_SESSION_SIZE_MB` | `5120` | Total bytes allowed per drop. |
| `MAX_FILES_PER_SESSION` | `100` | File count per drop. |
| `MAX_MESSAGES_PER_SESSION` | `200` | Text/link count per drop. |
| `MAX_TEXT_LENGTH` | `10000` | Max characters in one note or link. |
| `CHUNK_SIZE_MB` | `4` | Upload chunk size (1–16). |
| `RATE_LIMIT_SESSION_PER_HOUR` | `30` | Session creations per IP per hour. |
| `RATE_LIMIT_UPLOAD_PER_MINUTE` | `1200` | Upload API calls per IP per minute. |
| `RATE_LIMIT_DISABLED` | unset | Set to `true` to disable rate limiting (development only). |

Limits are enforced on the server as well as shown in the UI. The UI reads the active values from the session response.

### Client build-time environment (`client/.env`)

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_URL` | same origin | Base URL for the API and Socket.IO, e.g. `https://quickdrop-api.onrender.com`. Leave empty when the app and API share an origin. |
| `VITE_PUBLIC_APP_URL` | `window.location.origin` | Public origin placed into the QR and copied invite link. When the app is opened at localhost, QuickDrop automatically uses a detected private LAN address instead. Set this to override that address, or when the web app and API use different origins. |

### Phone on the same network

When you open QuickDrop at `localhost`, the server detects a private LAN address and the QR uses it automatically (for example `http://192.168.1.20:3001`). Both devices must be on the same network, and the firewall must allow inbound connections to the app port. If the wrong adapter is detected—or you use a separately hosted frontend—set the address explicitly:

```bash
# .env in client/
VITE_PUBLIC_APP_URL=http://192.168.1.20:5173
```

Rebuild the client after changing this value, then open the receiver from the laptop and scan the new QR. A deployed QuickDrop works across networks without this setting.

## Deployment

### GitHub Pages is not supported

GitHub Pages is a static file host. It displays this README at the repository URL because QuickDrop has no static root `index.html`, and it cannot run uploads, session storage, downloads, or Socket.IO. Use Render for the full application.

### Render (one service, recommended)

The repository includes [`render.yaml`](render.yaml). The fastest path is the [one-click Blueprint deploy](https://render.com/deploy?repo=https://github.com/mahendrabaghe/esay_file_transfer). Sign in with GitHub, keep the detected `quickdrop` service, and apply the Blueprint. Render builds the client and starts the Node server on the free plan.

To configure it manually, create a Web Service from the repo:

- **Build command:** `npm ci --include=dev && npm run build`
- **Start command:** `npm start`
- **Health check path:** `/api/health`
- **Environment:** `NODE_ENV=production`, `SERVE_CLIENT=true`
- **Node version:** 22 LTS or newer, at least 20.11

Render terminates TLS and forwards secure WebSocket upgrades. Keep `TRUST_PROXY=1` (the production default). Environment limits override the defaults without a rebuild.

Important Render notes:

- The service filesystem is ephemeral. A deploy, restart, or free-tier spin-down removes open sessions and uploaded files. That matches QuickDrop's no-permanent-storage model, but it means a drop does not survive a restart.
- Run a single instance. Session metadata is intentionally in memory and uploads are on local disk. Multiple instances would need shared storage and sticky Socket.IO sessions.
- Free instances spin down when idle. Use an always-on instance if you need drops to stay open reliably.
- Render's request limits still apply to very large uploads. Chunks default to 4 MB; raise `MAX_FILE_SIZE_MB` only within the capacity of your plan.

### Split hosting (static frontend + API)

- Deploy the repo's server with `SERVE_CLIENT=false` and `NODE_ENV=production` to Render.
- Build the client with:
  - `VITE_API_URL=https://quickdrop-api.onrender.com`
  - `VITE_PUBLIC_APP_URL=https://quickdrop.example.com`
- Set `CLIENT_ORIGINS=https://quickdrop.example.com` on the API.
- Rewrite all frontend routes to `index.html` (SPA fallback).
- Use HTTPS on both origins. The app's CSP already allows `ws:`/`wss:` connections; the API origin must be reachable from the browser.

### Self-hosting

Run `npm ci --include=dev && npm run build && npm start` behind a TLS-terminating reverse proxy (Caddy, Nginx, Cloudflare, etc.). Forward WebSocket upgrades for `/socket.io/`, and set `CLIENT_ORIGINS` if the app is served from another origin. Without TLS, browsers will not allow secure clipboard/camera-adjacent features and production WebSocket traffic is not protected.

## Security model

- **Independent cryptographic tokens.** Each drop gets two 256-bit tokens generated with Node's `crypto.randomBytes`. Tokens are looked up by SHA-256 hash; the receiver token never appears in the QR.
- **Active-session checks.** API and Socket.IO connections require a live, unexpired token. Stopping or expiring a session invalidates its tokens immediately and disconnects its sockets.
- **No public file URLs.** Uploaded bytes are never placed in a static directory. Every download and preview needs a random per-file access token that is compared in constant time. Unknown or mismatched file IDs return `404`.
- **Upload integrity.** Files arrive in chunks with a per-chunk SHA-256 header, a client-supplied SHA-256 fingerprint, size/type limits, and an idempotent completion step. Duplicate fingerprints are deduplicated within a session.
- **Input handling.** Filenames are sanitized and allowlisted by extension; text lengths and URL protocols are validated; JSON bodies are capped; paths are resolved inside the storage root.
- **Transport and headers.** Helmet sets CSP, `nosniff`, frame restrictions, and referrer policy. CORS can be restricted with `CLIENT_ORIGINS`. Use HTTPS/WSS in production so tokens and file bytes are encrypted in transit.
- **Rate limiting.** Session creation and upload requests are limited per IP by default.
- **Ephemeral storage.** Sessions, messages, uploads, and files are removed on stop, expiry, server shutdown, or startup. The server keeps no user accounts or database.
- **Temporary at rest.** Files are stored unencrypted on the server's ephemeral disk for the retention window. Do not use an untrusted host for sensitive material; no antivirus scanning is performed.

## Project structure

```text
.
├── client/                 React 19 + Vite + Tailwind UI
│   ├── src/pages/          Home, Receiver, Sender, Not Found
│   ├── src/components/     QR panel, received gallery, drop zone, timers...
│   ├── src/lib/            API client, uploader, live session hook, file rules
│   └── vite.config.js
├── server/
│   ├── src/app.js          Express app, headers, static client, error handling
│   ├── src/config.js       Environment-driven limits
│   ├── src/routes.js       Session, upload, message, file, and ZIP endpoints
│   ├── src/realtime.js     Socket.IO rooms, presence, live events
│   ├── src/store.js        In-memory sessions and temporary disk storage
│   ├── src/security.js     Tokens, sanitization, validation, file allowlist
│   └── test/               Node test runner integration tests
├── render.yaml
└── package.json            npm workspaces and root scripts
```

## API summary

| Method | Route | Auth |
| --- | --- | --- |
| `POST` | `/api/sessions` | None (rate-limited) |
| `GET` | `/api/sessions/:token` | Sender or receiver token |
| `DELETE` | `/api/sessions/:token` | Receiver token only |
| `POST` | `/api/sessions/:token/messages` | Sender token only |
| `POST` | `/api/sessions/:token/uploads` | Sender or receiver token |
| `PUT` | `/api/sessions/:token/uploads/:uploadId/chunks/:index` | Sender or receiver token |
| `POST` | `/api/sessions/:token/uploads/:uploadId/complete` | Sender or receiver token |
| `DELETE` | `/api/sessions/:token/uploads/:uploadId` | Sender or receiver token |
| `GET` | `/api/sessions/:token/archive` | Receiver token only |
| `GET` | `/api/files/:fileId/download?token=...` | Per-file access token |
| `GET` | `/api/files/:fileId/preview?token=...` | Per-file access token (images only) |
| `GET` | `/api/health` | None |
| `GET` | `/api/network` | Loopback callers only |

Socket.IO authenticates with `auth: { token }`; senders and receivers join separate rooms so receivers only see file and message events.

## Verification

The final build was exercised end-to-end in a browser:

- A live session was created from the UI; its QR and copied link used the laptop's LAN address, and that link opened the sender UI successfully over the network address.
- A photo, a text note, and a link were sent from the sender UI and appeared on the receiver.
- A 96 MB ZIP uploaded in 4 MB chunks with visible progress and speed, then completed.
- The receiver previewed the image in the lightbox and downloaded both files individually.
- The download-all ZIP (102.6 MB) was downloaded and passed an archive integrity test.
- A file dropped from the receiving laptop appeared in the same live session.
- A separate instance with a 1-minute idle TTL showed the sender's expired screen, rejected the expired token, and showed the closed-link screen on the receiver route.
- File downloads without a valid file token returned `404`.

Automated tests (`npm test`) cover session isolation, realtime notes/links, resumable chunk uploads, checksum rejection, duplicate completion, sanitized filenames, type/size limits, per-file download auth, ZIP responses, stop/expiry cleanup, and rejection of expired Socket.IO connections.

## Notes and limits

- Single-process design: sessions live in memory and files on the local disk. Scale vertically, not horizontally, unless you add a shared store and sticky sessions.
- No malware scanning, image transcoding, or end-to-end encryption. The server necessarily sees file bytes while relaying them. Use a trusted deployment for sensitive material.
- HEIC/HEIF uploads are accepted as images but browser preview support varies by platform.
- iOS Safari may require a tap to start a download; the UI surfaces individual and download-all options for that reason.
- Files are removed automatically, but no system can guarantee deletion from backups, swap, or infrastructure logs. Run on a host you control if that matters.
#   a a d  
 