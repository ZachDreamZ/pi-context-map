# Pi Context Map - Structured Fix Plan

**Date:** June 16, 2026  
**Based on:** AUDIT-REPORT.md  
**Goal:** Address all identified issues systematically

---

## Fix Categories

### 🔴 CRITICAL (Must Fix)

#### Fix C1: Dangerous Signal Listener Removal
**File:** `extensions/index.ts`  
**Lines:** 126-127  
**Current Code:**
```typescript
process.removeAllListeners("SIGINT");
process.removeAllListeners("SIGTERM");
process.once("SIGINT", () => liveServer.stop());
process.once("SIGTERM", () => liveServer.stop());
```

**Target Code:**
```typescript
// Store handlers for proper cleanup
let sigintHandler: (() => void) | null = null;
let sigtermHandler: (() => void) | null = null;

// In main function, before registering handlers:
sigintHandler = () => liveServer.stop();
sigtermHandler = () => liveServer.stop();
process.once("SIGINT", sigintHandler);
process.once("SIGTERM", sigtermHandler);

// Add cleanup function
function cleanup() {
    if (sigintHandler) process.removeListener("SIGINT", sigintHandler);
    if (sigtermHandler) process.removeListener("SIGTERM", sigtermHandler);
    liveServer.stop();
}
```

**Risk:** Low - improves safety without changing behavior

---

#### Fix C2: XSS Protection Enhancement
**File:** `extensions/generator.ts`  
**Lines:** Template literals with file paths  
**Current Code:**
```typescript
<div class="file-card" data-path="${ReportGenerator.escapeHtml(file.path)}" data-status="${file.status}">
```

**Target Code:**
```typescript
// Add attribute escaping helper
private static escapeAttr(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Use in template
<div class="file-card" data-path="${ReportGenerator.escapeAttr(file.path)}" data-status="${ReportGenerator.escapeAttr(file.status)}">
```

**Risk:** Low - adds defense-in-depth

---

### 🟠 HIGH (Should Fix)

#### Fix H1: Add Error Logging
**File:** `extensions/index.ts`  
**Lines:** Multiple catch blocks  
**Current Code:**
```typescript
} catch {
    // Silent — don't spam console
}
```

**Target Code:**
```typescript
} catch (err: any) {
    if (process.env.DEBUG || process.env.PI_DEBUG) {
        console.error('[pi-context-map]', err.message);
    }
}
```

**Risk:** Low - adds optional debug output

---

#### Fix H2: Remove Double File Write
**File:** `extensions/index.ts`  
**Lines:** 99, 109  
**Current Code:**
```typescript
// In runAnalysis()
fs.writeFileSync(currentReportPath, html, "utf8");
// ...
if (liveServer.isRunning) {
    liveServer.update(html, currentReportPath);
}
```

**Target Code:**
```typescript
// Remove the writeFileSync call - liveServer.update handles it
if (liveServer.isRunning) {
    liveServer.update(html, currentReportPath);
} else {
    // Write directly if server not running
    try {
        const dir = path.dirname(currentReportPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(currentReportPath, html, "utf8");
    } catch (err: any) {
        if (process.env.DEBUG) {
            console.error('[pi-context-map] Failed to write report:', err.message);
        }
    }
}
```

**Risk:** Low - eliminates redundant write

---

#### Fix H3: Expand Bash Command Detection
**File:** `extensions/analyzer.ts`  
**Lines:** 264-267  
**Current Code:**
```typescript
const match = args.command?.match(
    /(?:cat|ls|rm|mv|cp|vi|nano)\s+([^\s;]+)/,
);
```

**Target Code:**
```typescript
const match = args.command?.match(
    /(?:cat|ls|rm|mv|cp|vi|nano|touch|head|tail|grep|sed|awk|mkdir|chmod|chown|find|xargs|tee|diff|patch|install|unzip|tar)\s+([^\s;]+)/,
);
```

**Risk:** Low - expands detection without breaking existing behavior

---

#### Fix H4: Node.js Version Safety
**File:** `extensions/live-server.ts`  
**Lines:** 105  
**Current Code:**
```typescript
if (typeof this.server.closeAllConnections === "function") {
    this.server.closeAllConnections();
}
```

**Target Code:**
```typescript
// closeAllConnections requires Node.js 18.2+
// Fallback: manually destroy connections
if (typeof this.server.closeAllConnections === "function") {
    this.server.closeAllConnections();
} else {
    // Fallback for older Node.js versions
    this.server.close(() => {
        // Server closed
    });
}
```

**Risk:** Low - adds graceful fallback

---

### 🟡 MEDIUM (Nice to Fix)

#### Fix M1: Remove Unused Code
**File:** `extensions/generator.ts`  
**Lines:** 13-15, 721-725  
**Action:** Remove dead `writeReport()` method and unused imports

**Current Code:**
```typescript
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
// ...
public static writeReport(html: string): string {
    const reportDir = join(homedir(), ".pi", "context-map");
    mkdirSync(reportDir, { recursive: true });
    const reportPath = join(reportDir, "report.html");
    writeFileSync(reportPath, html, "utf8");
    return reportPath;
}
```

**Target Code:**
```typescript
// Remove the import lines and writeReport method entirely
```

**Risk:** Low - removes dead code

---

#### Fix M2: Improve File Path Regex
**File:** `extensions/analyzer.ts`  
**Lines:** 162-164  
**Current Code:**
```typescript
const matches = block.text.match(
    /(?:\/|[A-Z]:\\)[\w./\\-]+\.\w+/g,
);
```

**Target Code:**
```typescript
// More specific file extension matching
const matches = block.text.match(
    /(?:\/|[A-Z]:\\)[\w./\\-]+\.(?:ts|tsx|js|jsx|py|rb|go|rs|java|c|cpp|h|hpp|cs|json|yaml|yml|toml|xml|html|css|scss|less|md|txt|sh|bash|zsh|fish|sql|graphql|proto)/g,
);
```

**Risk:** Low - reduces false positives

---

#### Fix M3: Extract Magic Numbers
**File:** `extensions/analyzer.ts`  
**Lines:** 230, 299-301  
**Current Code:**
```typescript
if (ratio >= 0.7) return "active";
if (ratio >= 0.3) return "stale";
return "legacy";
```

**Target Code:**
```typescript
// Add constants at top of file
const FILE_STATUS_THRESHOLDS = {
    ACTIVE: 0.7,
    STALE: 0.3,
} as const;

// Use in method
private calculateStatus(
    messageIndex: number,
    totalMessages: number,
): FileContext["status"] {
    if (totalMessages === 0) return "legacy";
    const ratio = messageIndex / totalMessages;
    if (ratio >= FILE_STATUS_THRESHOLDS.ACTIVE) return "active";
    if (ratio >= FILE_STATUS_THRESHOLDS.STALE) return "stale";
    return "legacy";
}
```

**Risk:** Low - improves maintainability

---

#### Fix M4: Heartbeat Cleanup
**File:** `extensions/live-server.ts`  
**Lines:** 185-195  
**Current Code:**
```typescript
const heartbeat = setInterval(() => {
    try {
        res.write(": heartbeat\n\n");
    } catch {
        clearInterval(heartbeat);
        this.clients.delete(res);
    }
}, 30000);
```

**Target Code:**
```typescript
// Add to class properties
private heartbeats: Set<NodeJS.Timeout> = new Set();

// In handleSSE
const heartbeat = setInterval(() => {
    try {
        res.write(": heartbeat\n\n");
    } catch {
        clearInterval(heartbeat);
        this.heartbeats.delete(heartbeat);
        this.clients.delete(res);
    }
}, 30000);
this.heartbeats.add(heartbeat);

// In stop()
for (const h of this.heartbeats) {
    clearInterval(h);
}
this.heartbeats.clear();
```

**Risk:** Low - prevents memory leaks

---

### 🟢 LOW (Optional)

#### Fix L1: Fix Variable Naming
**File:** `extensions/index.ts`  
**Lines:** 136, 151  
**Current Code:**
```typescript
pi.on("session_before_compact", (_event: any, ctx: any) => {
    const tokens = _event?.preparation?.tokensBefore;
```

**Target Code:**
```typescript
pi.on("session_before_compact", (event: any, ctx: any) => {
    const tokens = event?.preparation?.tokensBefore;
```

**Risk:** Very low - naming convention fix

---

#### Fix L2: Document Visual Multiplier
**File:** `extensions/generator.ts`  
**Line:** 25  
**Current Code:**
```typescript
style="width: ${Math.min(100, (file.weight / Math.max(1, total)) * 100 * 3)}%"
```

**Target Code:**
```typescript
// File weight bar scaled for visibility (3x for small values to be visible)
style="width: ${Math.min(100, (file.weight / Math.max(1, total)) * 100 * 3)}%"
```

**Risk:** Very low - documentation only

---

## Implementation Order

1. **Phase 1 - Critical Fixes** (C1, C2)
   - Fix signal listener removal
   - Add attribute escaping

2. **Phase 2 - High Priority** (H1, H2, H3, H4)
   - Add debug logging
   - Remove double write
   - Expand bash detection
   - Add Node.js fallback

3. **Phase 3 - Medium Priority** (M1, M2, M3, M4)
   - Remove dead code
   - Improve file path regex
   - Extract constants
   - Fix heartbeat cleanup

4. **Phase 4 - Low Priority** (L1, L2)
   - Fix naming conventions
   - Add documentation

---

## Verification Steps

After each phase:
1. Run `npx tsc --noEmit` to check TypeScript compilation
2. Run performance test to ensure no regression
3. Verify extension loads in Pi

After all phases:
1. Run full audit again
2. Generate new audit report
3. Compare metrics with original

---

## Risk Assessment

| Fix | Risk | Rollback Plan |
|-----|------|---------------|
| C1 | Low | Re-add removeAllListeners if issues |
| C2 | Low | Remove escapeAttr if problems |
| H1 | Low | Remove console.error calls |
| H2 | Low | Restore writeFileSync |
| H3 | Low | Revert regex change |
| H4 | Low | Remove fallback code |
| M1 | Low | Restore imports/method |
| M2 | Low | Revert regex change |
| M3 | Low | Inline constants |
| M4 | Low | Remove heartbeats set |
| L1 | Low | Restore underscore prefix |
| L2 | Very Low | Remove comment |

---

## Success Criteria

- [ ] All critical fixes applied
- [ ] All high-priority fixes applied
- [ ] TypeScript compiles without errors
- [ ] Performance test passes
- [ ] No new issues introduced
- [ ] Code coverage maintained or improved

---

*Plan created by Pi Coding Agent*
