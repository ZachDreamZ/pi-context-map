# Proposal: pi-context-map

## 1. Problem Statement
As Pi sessions grow in complexity, the "Context Window" becomes a black box. Users and agents often lose track of:
- Which files are currently consuming the most tokens.
- When a file was last "refreshed" (read) by the agent.
- The distribution of tokens between history, system prompts, and tool outputs.

This leads to "context bloat," where the agent becomes sluggish or forgets critical instructions because the window is filled with stale file content.

## 2. Goal
Create a Pi extension that provides a **real-time, visual map of the current session's context**. It should transform the abstract concept of a "token window" into a concrete, actionable dashboard.

## 3. Core Features
### A. `/context-map` Command
A command that generates a visual report of the current context.

### B. Context Analysis
- **File Inventory**: List all files currently in context.
- **Weight Tracking**: Approximate token count per file.
- **Status Mapping**:
    - `Active`: Read/Modified in the last 3 turns.
    - `Stale`: Read 4-10 turns ago.
    - `Legacy`: Read >10 turns ago (candidate for compaction).
- **Operation History**: Mark if a file was Read 🟢, Written 🟠, or Edited 🟡.

### C. Visual Output
The extension will generate an `index.html` report (stored in `.pi/context-map/report.html`) featuring:
- **Token Budget Bar**: Visual breakdown of context usage.
- **File Treemap/List**: Files sized by their token weight.
- **Temporal Timeline**: A simple timeline showing when files entered the context.

## 4. Success Criteria
- The user can run `/context-map` and immediately see which file is the "token hog."
- The user can identify "stale" files that can be removed to free up space.
- Zero performance degradation during normal session operation.
- Full compatibility with `pi-ultra-compact` (since both manage context).

## 5. Non-Goals
- This is a *visualization* tool, not an *automatic* context cleaner (though it provides the data needed for a user to trigger compaction).
- It will not modify the actual LLM context window, only report on it.
