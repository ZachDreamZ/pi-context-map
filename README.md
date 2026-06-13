# pi-context-map

A visual context window mapping extension for [Pi](https://pi.dev/) that transforms your abstract token window into a concrete, actionable dashboard.

[![Pi Package](https://img.shields.io/badge/Pi-Package-blue)](https://pi.dev/packages)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/pi-context-map.svg)](https://www.npmjs.com/package/pi-context-map)

## Features

- **Visual Context Budget**: Real-time breakdown of tokens used by System, History, Files, and Tool Results.
- **Working Set Analysis**: Categorizes files as `Active`, `Stale`, or `Legacy` based on access recency.
- **Token Weighting**: Identifies "token hogs" by calculating the approximate size of each file in the window.
- **Operation Tracking**: Marks files with their last operation (Read 👁️, Write 📝, Edit ✍️).
- **Temporal Mapping**: Visually maps when files entered the context to identify compaction candidates.

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

The extension categorizes files to help you manage context bloat:

| Status | Criteria | Action |
|--------|----------|--------|
| **Active** | Accessed in last 3 turns | Keep in context |
| **Stale** | Accessed 4-10 turns ago | Monitor for removal |
| **Legacy** | Accessed > 10 turns ago | Prime candidate for compaction |

## How It Works

1. **Scanning**: The analyzer iterates through the session history, identifying all `tool_use` calls involving file operations.
2. **Weighting**: It extracts the content length of tool results and applies a token heuristic (approx. 4 chars/token).
3. **Categorization**: It calculates the temporal distance between the current turn and the last file access.
4. **Visualization**: It generates a standalone HTML dashboard featuring a token budget bar and a file-weight grid.

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
