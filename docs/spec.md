# Technical Specification: pi-context-map

## 1. Architecture Overview
`pi-context-map` is a Pi extension that analyzes the session message history to derive a "map" of the active context. It operates as a read-only analysis tool triggered by a user command.

## 2. Data Extraction Logic
When `/context-map` is called, the extension will:
1. **Scan Messages**: Iterate through all messages in the current session history.
2. **Identify File Ops**:
    - Scan `tool_use` blocks for `read`, `write`, `edit`, and `bash` (regex for file paths).
    - Map each file to its most recent occurrence (turn number).
3. **Calculate Weights**:
    - For each file found, retrieve its content length from the corresponding `tool_result` if available.
    - Estimate tokens using a heuristic: $\text{tokens} \approx \text{chars} / 4$.
4. **Assign Status**:
    - **Active**: Turn difference $\le 3$.
    - **Stale**: $3 <$ Turn difference $\le 10$.
    - **Legacy**: Turn difference $> 10$.

## 3. Component Design

### A. `ContextAnalyzer` (Class)
- `analyze(messages: Message[])`: Returns a `ContextMap` object.
- `calculateTokens(text: string)`: Returns estimated token count.
- `getFileMetadata(path: string)`: Tracks the operation type and timestamp.

### B. `ReportGenerator` (Class)
- `generateHTML(map: ContextMap)`: Produces a standalone HTML string.
- `writeReport(html: string)`: Saves the report to `.pi/context-map/report.html` and opens it.

### C. `ExtensionEntry` (Main)
- `pi.registerCommand("context-map", ...)`: The entry point.
- `pi.on("session_before_compact", ...)`: (Optional) Could trigger a map update before compaction.

## 4. Visual Specification (HTML Dashboard)
The report will be a single-file HTML dashboard with:
- **Header**: Session ID, Total Estimated Tokens, and Timestamp.
- **Context Budget**: A CSS-based stacked bar showing:
    - `[ System ] [ History ] [ Files ] [ Tool Outputs ]`
- **File Grid**:
    - Cards for each file.
    - Size proportional to token weight.
    - Color-coded by status (Green $\to$ Yellow $\to$ Red).
    - Icons for operation type (👁️ for read, ✍️ for edit).
- **Stats Table**:
    - File Path | Tokens | Last Turn | Status.

## 5. Implementation Details
- **Language**: TypeScript.
- **Dependencies**: `@earendil-works/pi-coding-agent`, `node:fs`, `node:path`.
- **Complexity**: 
    - Time: $O(N)$ where $N$ is number of messages.
    - Space: $O(F)$ where $F$ is number of unique files in context.

## 6. Error Handling
- **Missing Tool Results**: If a file was read but the result is missing (e.g., due to previous compaction), mark weight as "Unknown" and status as "Stale".
- **Large Repos**: Limit the map to the top 100 largest files to prevent the HTML report from crashing the browser.
