# pi-context-map

A Pi extension that transforms your session's context window into a visual, actionable dashboard.

## 🚀 Features

- **Visual Context Budget**: See exactly how your tokens are distributed between system prompts, history, files, and tool results.
- **Working Set Analysis**: Identify which files are "Active", "Stale", or "Legacy".
- **Token Weighting**: Discover which files are consuming the most context window space.
- **Operation History**: Track how files entered the context (Read 👁️, Write 📝, Edit ✍️).
- **Temporal Mapping**: See a timeline of file access to identify candidates for compaction.

## 🛠️ Installation

```bash
pi install npm:pi-context-map
```

## 📖 Usage

Run the following command in any Pi session:

`/context-map`

The extension will analyze your session and generate a standalone HTML report at:
`~/.pi/context-map/report.html`

## 📊 How it Works

The extension scans the session's message history to build a map of the "Working Set":
1. **Scanning**: Every `tool_use` call for `read`, `write`, or `edit` is tracked.
2. **Weighting**: Content length is converted to estimated tokens.
3. **Categorization**:
    - **Active**: Accessed in the last 3 turns.
    - **Stale**: Accessed in the last 10 turns.
    - **Legacy**: Accessed > 10 turns ago.
4. **Visualization**: Data is injected into a high-performance HTML dashboard.

## ⚖️ License

MIT
