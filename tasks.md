# Implementation Tasks: pi-context-map

## Phase 1: Foundation
- [ ] Initialize `package.json` and TypeScript config.
- [ ] Create project folder structure (`src/`, `docs/`).

## Phase 2: Core Logic (`ContextAnalyzer`)
- [ ] Implement message scanning logic to find file operations.
- [ ] Implement token estimation heuristic.
- [ ] Implement status assignment (Active/Stale/Legacy).
- [ ] Create unit tests for analyzer logic.

## Phase 3: Visualization (`ReportGenerator`)
- [ ] Design the HTML dashboard template.
- [ ] Implement data-to-HTML mapping.
- [ ] Implement file writing to `.pi/context-map/report.html`.

## Phase 4: Pi Integration
- [ ] Register `/context-map` command.
- [ ] Implement command handler that triggers analysis $\to$ report $\to$ notification.
- [ ] Add "Open Report" link in the Pi notification.

## Phase 5: QA & Polishing
- [ ] Test with high-token sessions.
- [ ] Verify accuracy of token weights.
- [ ] Run Pi Lens diagnostics to ensure zero blockers.
- [ ] Polish HTML CSS for "Architect" look.

## Phase 6: Release
- [ ] Update README.md.
- [ ] Publish to npm.
- [ ] Final GitHub release.
