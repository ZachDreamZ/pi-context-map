# Changelog

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
