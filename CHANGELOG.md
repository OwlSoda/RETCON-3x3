# Changelog

All notable changes to **RETCON 3x3** are documented in this file.

## [v1.2.2] - 2026-11-27

### Fixed
- **Viewport-Independent Crop Alignment**: Switched saved crop pan coordinates from raw modal pixels to tile-relative percentages (`translate(X%, Y%)`) with backward compatibility for legacy saved sessions, switched drag calculation to `clientWidth`, rounded `fillScale` up to prevent hairline bars, and matched `GridTile`'s `<img>` layout box to `CropModal`'s exact 1:1 square geometry so framing stays identical across desktop, mobile, window resizes, and reloads.
- **Broken Image Recovery**: Reset `GridTile` broken-image error state whenever `tile.imageUrl` changes via swaps, bulk import, or image removal.
- **Mobile Touch Overlay Safety**: Prevented invisible tile action overlays from intercepting touches, scoped hover reveal to `@media(hover:hover)`, added tap-to-toggle tile actions, and added an `aria-label` to the mobile Bulk Import button.
- **Crop Modal Gestures & Zoom Bounds**: Replaced the passive React wheel handler with a native `{ passive: false }` listener, unified zoom bounds (`0.4x–6x+`) across slider/wheel/pinch/buttons, clamped pan live during pinch-zoom, disabled transform transition lag while dragging, and cleaned up unmount timers.
- **Export & Bulk Upload Resilience**: Switched bulk local uploads to `Promise.allSettled` so one unreadable file does not abort valid images, closed the Settings drawer on export, and matched the downloaded file extension if a browser falls back from WebP to PNG.

### Added
- **Automated Unit & Playwright E2E Test Suite**: Added 25 unit tests (`npm test`) covering crop math, export utilities, and URL helpers, plus 6 Playwright Chromium E2E tests (`npm run test:e2e`) wired into GitHub Actions CI.

## [v1.2.1] - 2026-11-27

### Added
- **MIT `LICENSE` file** matching README licensing.
- **GitHub Actions CI & Multi-Arch Docker Publishing**:
  - Added CI workflow (`ci.yml`) running unit tests, TypeScript/Vite builds, and Docker build checks on pull requests and pushes to `main`.
  - Added GHCR workflow (`release-docker.yml`) publishing `linux/amd64` and `linux/arm64` images to `ghcr.io/owlsoda/retcon-3x3`.
- **Unit Tests**: Added URL validation tests (`npm test`) using Node's built-in test runner.
- **Hardened Nginx Configuration**: Added dedicated `nginx/default.conf` and `nginx/security-headers.conf` with `server_tokens off`, gzip compression, CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `/health` endpoint, and Docker `HEALTHCHECK`.

### Changed
- **Configurable Dev Server & Metadata**: Added `VITE_ALLOWED_HOSTS` support in `vite.config.ts` for running Vite behind custom domains or reverse proxies, and streamlined `metadata.json`.
- **Docker Compose Updates**: Switched `docker-compose.yml` to pull `ghcr.io/owlsoda/retcon-3x3:latest` with configurable `RETCON_PORT` (default `7826`), and added `docker-compose.build.yml` for local source builds.
- **Client-Side Hardening**: Added `no-referrer` meta/image policies, defense-in-depth URL validation in `handleAssignUrl`, filename character sanitization on export, and prevented `?demo=1` mode from overwriting saved IndexedDB compositions.
- **Dependencies**: Updated `vite`, `postcss-selector-parser`, and `source-map-js` via `npm audit fix` (0 known vulnerabilities).

## [v1.2.0] - 2026-09-29

### Added
- **Gesture-First Crop & Framing Interface**:
  - **Instant Double-Tap / Double-Click Snap**: Tap twice on mobile or double-click on desktop to effortlessly toggle between **Fit** (1.0x uncropped) and **Fill** (exact aspect-ratio fill).
  - **Smart Aspect-Ratio Detection**: Automatically measures image dimensions and calculates mathematically exact scales to eliminate black bars on any wide (16:9) or tall (9:16) photo.
  - **Magnetic Pan & Boundary Clamping**: Prevents images from ever getting dragged off-screen into void space while allowing smooth 1:1 pan with tactile elastic feedback.
  - **1-Tap Directional Framing Snaps**: Contextual quick-framing snaps (Top/Center/Bottom for vertical photos to frame faces, Left/Center/Right for wide photos).
  - **Mobile Bottom-Sheet Viewport**: Expands to full screen on small displays with generous thumb-friendly controls, responsive canvas sizing, and live feedback badges.
- **Local Tailwind CSS Pipeline**:
  - Replaced external runtime CDN scripts with a dedicated Vite + PostCSS build pipeline, enabling 100% offline usage and sub-2s builds.
- **Hardened iOS Safari Export Engine**:
  - Implemented dual dimension and total canvas surface area ($16.7\text{M pixels}$) clamping to protect mobile WebKit devices from out-of-memory crashes.

## [v1.1.0] - 2026-09-05

### Added
- **Focused Crop Modal (`CropModal`)**:
  - Interactive square cropping viewport with smooth touch pan and pinch-to-zoom on mobile devices.
  - Desktop mouse-drag pan and scroll-wheel zoom functionality.
  - Visual Rule-of-Thirds grid overlay with live position coordinate indicators for precision framing.
  - One-click presets: **Fit** (contain image), **Fill** (cover square), and **Reset** (default 1x scale and centered coordinates).
  - Step-based zoom buttons and granular magnification slider with live readout.
- **Redesigned Side Grid Title Control (`GridTitleControl`)**:
  - Moved the grid title input from a bulky centered header into a sleek, minimal side pill badge.
  - Expandable modal/flyout card with instant clear button and keyboard shortcuts (`Enter` / `Esc`).
  - **Overlay On Grid Toggle**: Choose whether the title text is overlaid across the bottom of the grid or used strictly for clean export file naming.
- **Improved Viewport & Layout Scaling**:
  - Dynamic aspect-ratio constraints (`calc(100dvh - 120px)`) preventing the bottom row of tiles from being pushed off-screen or clipped.
- **Repository Setup**:
  - Added comprehensive `.gitignore` and sanitized container configurations.

### Changed
- Streamlined `GridTile` action controls to open the dedicated crop modal directly.
- Persisted title overlay preferences to IndexedDB alongside tile transforms and grid compositions.

---

## [v1.0.0] - Initial Release

- Core 3x3 compositional moodboard grid.
- Local file upload, bulk image URL import, and clipboard image pasting.
- Weserv proxy integration for CORS bypass on external URLs.
- OLED Dark Mode and Gallery Light Mode with real-time accent line styling.
- High-resolution multi-format exports (PNG, JPEG, WebP) with custom naming schemes.
- Drag-and-drop and touch-hold tile reordering.
