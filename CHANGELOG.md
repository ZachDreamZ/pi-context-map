# Changelog

## [0.6.2] - 2026-06-15
### Bug Fixes
- **Fixed Pi message format**: Now uses `type: "toolCall"` (not `"tool_use"`) and `toolCallId` (not `tool_call_id`) to match Pi's actual `@mariozechner/pi-ai` types.
- **System prompt detection**: Now accepts `systemPrompt` parameter from Pi's `ctx.getSystemPrompt()`. System slice no longer shows 0%.
- **Tool results detection**: Changed to `role === "toolResult"` to match Pi's actual message format.
- **File tracking from tool results**: Now extracts file paths from `toolResult` messages (read/write/edit tool results).

### Features
- **Message persistence**: Messages are saved via `appendEntry` on compaction to survive session reloads.
- **Enhanced diagnostics**: `/context-map` command now shows message count, system tokens, and tool tokens in the notification.

## [0.6.1] - 2026-06-15
### Bug Fixes
- **Fixed libuv assertion on Windows**: Removed `process.on('exit')` handler and `process.exit(0)` calls that left server handles open. Server now closes synchronously via `closeAllConnections()`.
- **Synchronous stop()**: `isRunning` returns `false` immediately after `stop()` instead of after async callback.

## [0.6.0] - 2026-06-15
### Bug Fixes
- **Fixed composition analysis**: Changed `role === "tool"` to `role === "toolResult"` to match Pi's actual message format. Tools and files now show correct percentages instead of 0%.
- **File attachment detection**: Now detects images (type: "image") and file paths in user messages, not just assistant tool_use blocks.
- **Compaction summary detection**: Improved detection of Pi compaction entries via `customType` field.

### Features
- **Session-unique reports**: Each report is saved with date, time, and session name (e.g., `2026-06-15_14-30-00_my-session.html`). Old reports are preserved for history.
- **Auto-report path on session start**: New session gets a fresh report path automatically.

## [0.5.1] - 2026-06-15
### Bug Fixes
- **Fixed toggle symbol**: Dark mode now correctly shows sun icon + "Light" label. Light mode shows moon icon + "Dark" label. Uses fresh DOM queries to survive SSE body replacement.
- **Toggle moved to corner**: Button is now fixed in the top-right corner of the page, not inline with the live badge.
- **Event delegation**: Theme toggle click handler uses event delegation so it survives SSE body replacement without re-binding.

## [0.5.0] - 2026-06-15
### Features
- **Dark mode toggle**: Light/dark theme switcher in the report header. Preference saved to localStorage and restored on next load. Theme persists across SSE live updates.
- **Dynamic context window**: Replaced hardcoded 128k with actual context window size from Pi system via `ctx.getContextUsage()`. Now accurately reflects your model's real context limit (200k, 128k, etc.).

## [0.4.4] - 2026-06-15
### Bug Fixes
- **Fixed SSE rendering**: Changed `document.replaceChild(document.documentElement)` to `document.body.innerHTML` replacement. CSS and JavaScript no longer render as visible text on the page.
- **Singleton server**: `start()` now kills any pre-existing server instance before starting a new one. Only one localhost server runs at a time — no duplicate ports.

## [0.4.3] - 2026-06-15
### Apple-Inspired HTML Redesign
- **Complete visual overhaul**: Report now uses Apple design language — white canvas, Inter font (SF Pro substitute), Action Blue (#0066cc) accent, 18px card radius, pill-shaped inputs.
- **Usage ring**: SVG donut chart shows context window usage at a glance. Changes color when critical (>80%) or warning (>60%).
- **Stat tiles**: 4-column hairline-separated grid (Total Tokens, Files, Alerts, Window %).
- **Live badge**: Green pill indicator with pulsing dot shows when the live server is active.
- **Cleaner file cards**: 14px radius, thin border, hover turns accent blue. Status chips with semantic colors.
- **Rounded search/filter**: Pill-shaped search input (44px height) and filter dropdown.
- **Responsive layout**: Adapts to mobile with 2-column stats and single-column files.
- **Inter font**: Loaded from Google Fonts for professional typography on all platforms.

## [0.4.2] - 2026-06-15
### Silent Boot & Cleanup
- **Removed boot messages**: All console.log startup lines removed from `live-server.ts` and `index.ts`. Extension loads silently.

## [0.4.1] - 2026-06-15
### Critical Fix & Test Suite
- **Fixed CRASH**: `(pi as any).session?.messages` → now uses event-based message accumulation. `/context-map` no longer crashes with "Cannot read properties of undefined (reading 'messages')".
- **Fixed Tool Signature**: `registerTool` now uses correct `execute(params, signal, onUpdate, ctx)` signature.
- **Fixed Import Path**: Uses `pi-coding-agent` (unscoped) instead of `@earendil-works/pi-coding-agent`.
- **Test Suite**: 34 tests across 5 suites (analyzer, token-counter, insights, generator, live-server).
- **Type Declarations**: Proper `pi-coding-agent.d.ts` with `ToolDefinition`, `ExtensionCommandContext`, `ExtensionContext`.
- **Build Clean**: TypeScript strict mode passes with zero errors.

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
