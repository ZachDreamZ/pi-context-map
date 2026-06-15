# pi-context-map

A visual context window mapping extension for [Pi](https://pi.dev/) that transforms your abstract token window into a concrete, actionable dashboard.

[![Pi Package](https://img.shields.io/badge/Pi-Package-blue)](https://pi.dev/packages)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/pi-context-map.svg)](https://www.npmjs.com/package/pi-context-map)

## Features

- **Visual Context Budget**: Real-time breakdown of tokens used by System, Tools, History, Files, and Summaries.
- **Accurate Token Count**: Uses Pi's actual token count from `ctx.getContextUsage()`, not heuristic estimation — matches the terminal display.
- **Working Set Analysis**: Categorizes files as `Active`, `Stale`, or `Legacy` based on position in the conversation.
- **Token Weighting**: Identifies "token hogs" by calculating the approximate size of each file in the window.
- **Operation Tracking**: Marks files with their last operation (Read, Write, Edit).
- **Compaction Detection**: Tracks compaction summaries and branch summaries as a separate slice.
- **Auto-Open Browser**: Report automatically opens in your default browser on first invocation.
- **Dark Mode**: Toggle between light and dark themes. Preference persists across sessions via localStorage.
- **Live Server**: SSE-powered localhost server with auto-refresh after each assistant message.

## Installation

```bash
pi install npm:pi-context-map
```

## Quick Start

Run the mapping command to generate your session dashboard:

```bash
/context-map
```

The extension will analyze the session and create an interactive HTML report at:
`~/.pi/context-map/report.html`

## Context Statuses

Files are categorized by their position in the conversation (more reliable than turn-based calculation):

| Status | Position in Messages | Action |
|--------|---------------------|--------|
| **Active** | Last 30% of messages | Keep in context |
| **Stale** | Middle 40% of messages | Monitor for removal |
| **Legacy** | First 30% of messages | Prime candidate for compaction |

## How It Works

1. **Scanning**: The analyzer iterates through session messages, detecting `toolCall` blocks, `toolResult` messages, `compactionSummary` entries, and image attachments.
2. **Weighting**: It calculates token counts for each message type using a code-aware heuristic (multipliers for code blocks, strings, etc.).
3. **Accuracy**: When available, Pi's actual token count from `ctx.getContextUsage()` overrides the heuristic for the usage percentage.
4. **Categorization**: Files are classified by their position in the message array (last 30% = active, middle 40% = stale, first 30% = legacy).
5. **Visualization**: Generates a self-contained HTML dashboard with stacked composition bar, file cards with search/filter, dark mode toggle, and interactive insights.

## Live Localhost Server

When the extension loads, it automatically starts a local HTTP server on `127.0.0.1` (a random free port). The server:

- Serves the current report at `http://127.0.0.1:<port>/`.
- Pushes live updates via Server-Sent Events at `/events?token=<sessionToken>`.
- Authenticates the SSE connection with a per-session token (injected into the HTML as a `<meta>` tag).
- Auto-refreshes after each assistant message, so the browser view stays in sync.

**Commands:**

- `/context-map` — Generate a fresh report and broadcast it to the browser.
- `/context-map stop` — Stop the live server.

**Endpoints:**

- `GET /` or `/report.html` — The current report HTML.
- `GET /events?token=...` — Server-Sent Events stream of updates.
- `GET /health` — Returns `{ "status": "ok", "port": <number> }`.
- `POST /stop` — Gracefully stops the server.

## Design

The report uses the **Linear design system** (canvas `#010102`, accent `#5e6ad2`) with **shadcn/ui card patterns**. See `docs/design.md` for the full specification. The output is a single self-contained HTML file with no external dependencies.

## Compatibility

- ✅ Works with any Pi session regardless of model.
- ✅ Compatible with `pi-ultra-compact` (use together for a "Scan $\to$ Compress" workflow).
- ✅ Compatible with `gentle-engram` and `gentle-pi`.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Pi](https://pi.dev/) - The AI coding agent
