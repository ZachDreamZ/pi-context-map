# Changelog

## [0.4.0] - 2026-06-14
### Live Localhost Server
- **Live SSE Server**: New `LiveReportServer` binds to 127.0.0.1 on a free port and serves the report at `/`.
- **Auto-Updates**: Server-Sent Events endpoint at `/events` pushes the latest HTML whenever the analysis re-runs (e.g., after each assistant message).
- **Token Auth**: Each server instance generates a unique session token; the HTML client picks it up via a `<meta>` tag and includes it in the SSE URL to prevent unauthorized access.
- **Origin Validation**: Only connections from `http://127.0.0.1:<port>` or `http://localhost:<port>` are allowed.
- **Graceful Shutdown**: `/context-map stop` or `session_shutdown` event stops the server cleanly.
- **Auto-Refresh**: The `message_end` event triggers an automatic re-analysis when the live server is running, so the browser view stays in sync.
- **Health & Stop Endpoints**: `/health` for liveness, `POST /stop` for remote termination.

## [0.3.1] - 2026-06-14
### Design & Interactivity Upgrade
- **Linear Design System**: Refactored CSS to use the Linear design tokens (canvas #010102, accent #5e6ad2) for a professional, near-black aesthetic.
- **shadcn/ui Card Patterns**: Insight cards now follow shadcn conventions (hairline borders, gradient backgrounds for severity).
- **Collapsible Insights**: Critical and warning insights are expanded by default; info insights are collapsed. Click to toggle.
- **File Search & Filter**: Added a real-time search input and status filter dropdown above the file grid. Shows match count and empty state.
- **Design Doc**: Added `docs/design.md` documenting the visual language, layout, and accessibility decisions.

## [0.3.0] - 2026-06-14
### Professional Context Profiler
- **Code-Aware Token Counting**: New `TokenCounter` module applies multipliers for code blocks (1.3x) and JSON (1.5x) for more accurate estimation.
- **Context Composition**: Refactored analyzer to break down context into System, Tools, History, Files, and Summaries slices.
- **Actionable Insights Engine**: New `InsightEngine` generates 6 built-in rules (tool bloat, stale files, high usage, file-heavy, summaries, system overhead).
- **Interactive HTML Report**: Stacked composition bar, color-coded insights section, and improved file cards.
- **Tool + Command**: Now registers as both a slash command (`/context-map`) and a tool for programmatic agent access.
- **Async Factory**: Updated to modern async pattern.

## [0.2.0] - 2026-06-14
### Professional Context Profiler
- **Architectural Modernization**: Migrated to source-shipping (`./extensions`) and async factory function pattern.
- **Nexus Synergy**: Optimized for compatibility with the Nexus monorepo (e.g., `pi-ultra-compact`).
- **TUI Integration**: Refined command registration for seamless discovery in the Pi command palette.
- **LSP Clean**: Resolved type mismatches with the latest `pi-coding-agent` API.

## [0.1.4] - 2026-06-13
### Initial Release
- Visual context window mapping and token distribution dashboard.
- Categorization of files as `Active`, `Stale`, or `Legacy`.
- Operation tracking and temporal mapping for compaction candidates.
- Standalone HTML report generation at `~/.pi/context-map/report.html`.
