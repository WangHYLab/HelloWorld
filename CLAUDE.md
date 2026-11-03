# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

"HELLO/WORLD" is a planetary greeting terminal — a single-page interactive art/interactive experience featuring a geometric SVG Earth with a walking figure. Visitors trigger a jump animation and "你好世界" speech bubble, which records to SQLite and broadcasts in real-time to all connected clients via Server-Sent Events (SSE).

## Commands

```bash
npm install              # Install dependencies (Express 5, better-sqlite3)
npm start                # Start production server on port 3000
npm run dev              # Start with auto-reload (node --watch)
```

Data persists in `data/hello.db` (SQLite with WAL mode). Delete this file to reset the counter.

## Architecture

**Server ([server.js](server.js))**: Express 5 single-file backend. Serves static files from `public/`, handles three API routes:

- `GET /api/stats` — returns `{total, recent, online}`
- `POST /api/hello` — inserts a greeting row, returns updated stats + `lastId`, then broadcasts to all SSE clients
- `GET /api/stream` — SSE endpoint; clients subscribe to `stats`, `greeting`, and `presence` events. Heartbeat every 20s.

`streamClients` Set tracks active SSE connections. On greeting, the new payload is broadcast synchronously via `broadcast()` before responding to the POST.

**Client ([public/app.js](public/app.js))**: Self-contained IIFE. Manages:

- Visitor identity (UUID in localStorage)
- Animated count-up with easing
- Walker positioning along SVG arc path using `requestAnimationFrame`
- Jump animation trigger on click/key
- EventSource subscription for real-time updates
- Incoming greeting detection (different visitorId) → toast notification

**Styling ([public/style.css](public/style.css))**: CSS custom properties define the palette (`--ink`, `--paper`, `--acid`, `--blue`, `--vermilion`). Key visual systems: film grain overlay, orbital rings, walker SVG with limb animations, and a responsive three-column grid layout.

**HTML ([public/index.html](public/index.html))**: Inline SVG for the Earth (640×640 viewBox with polygonal continents), walker figure, and speech bubble. WCAG live regions on `#live-status` and `#speech`.

## Key Design Decisions

- SQLite WAL mode allows concurrent reads during writes without blocking the SSE broadcast.
- `better-sqlite3` is synchronous, so DB calls never introduce promise timing issues in the hot path.
- The SSE heartbeat prevents proxy/firewall timeouts on long-lived connections.
- Walker walks along a hard-coded SVG arc (`M 380 485 A 175 175 0 0 1 260 485`) — the JS mirrors this geometry to position the figure.
- Click coordinates map to shockwave spawn points relative to the globe element's bounding rect.
- No build step; vanilla JS/CSS only. The app runs as a simple Node HTTP server.
