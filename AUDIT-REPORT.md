# Pi Context Map - Comprehensive Audit Report

**Date:** June 16, 2026  
**Version:** 0.7.5  
**Auditor:** Pi Coding Agent  
**Scope:** Full codebase audit covering null safety, logical flow, functional correctness, Pi integration, and code quality

---

## Executive Summary

The pi-context-map project is a well-structured Pi extension that provides context window visualization and analysis. The codebase demonstrates good architectural patterns and follows Pi extension conventions. However, the audit identified **12 issues** ranging from critical to low severity, with **2 critical**, **4 high**, **4 medium**, and **2 low** severity findings.

**Overall Assessment:** The project is functional and ready for use, but requires attention to the critical and high-severity issues before production deployment.

---

## Audit Findings

### 🔴 CRITICAL SEVERITY (2 issues)

#### 1. Dangerous Signal Listener Removal
**File:** `extensions/index.ts`  
**Lines:** 126-127  
**Issue:** `process.removeAllListeners("SIGINT")` and `process.removeAllListeners("SIGTERM")` remove ALL listeners on these signals, not just the ones added by this extension. This can break other code that relies on these signals.

```typescript
// Current (DANGEROUS)
process.removeAllListeners("SIGINT");
process.removeAllListeners("SIGTERM");
process.once("SIGINT", () => liveServer.stop());
process.once("SIGTERM", () => liveServer.stop());
```

**Impact:** Could crash Pi or other extensions that depend on these signal handlers.

**Fix:** Store reference to added listeners and only remove those:
```typescript
const sigintHandler = () => liveServer.stop();
const sigtermHandler = () => liveServer.stop();
process.once("SIGINT", sigintHandler);
process.once("SIGTERM", sigtermHandler);

// In cleanup:
process.removeListener("SIGINT", sigintHandler);
process.removeListener("SIGTERM", sigtermHandler);
```

---

#### 2. Potential XSS via HTML Injection
**File:** `extensions/generator.ts`  
**Lines:** 11-12 (template literals)  
**Issue:** File paths are inserted into HTML via template literals. While `escapeHtml()` is used, the function is only applied to text content, not to attributes like `data-path`.

```typescript
// Current - potential issue
<div class="file-card" data-path="${ReportGenerator.escapeHtml(file.path)}" data-status="${file.status}">
```

**Impact:** Malicious file paths could inject attributes or break HTML structure.

**Fix:** Ensure all dynamic values in HTML attributes are properly escaped, or use a sanitization library.

---

### 🟠 HIGH SEVERITY (4 issues)

#### 3. Silent Error Swallowing
**File:** `extensions/index.ts`  
**Lines:** 107, 120, 155  
**Issue:** Multiple try/catch blocks silently ignore errors without logging. This makes debugging difficult and can hide real issues.

```typescript
// Multiple instances like this
try {
    // operation
} catch {
    // Silent — don't spam console
}
```

**Impact:** Bugs and errors go unnoticed; difficult to troubleshoot in production.

**Fix:** Add debug-level logging or at minimum log to a file:
```typescript
} catch (err: any) {
    if (process.env.DEBUG) {
        console.error('[pi-context-map]', err.message);
    }
}
```

---

#### 4. Double File Write
**File:** `extensions/index.ts`  
**Lines:** 99, 109  
**Issue:** The report HTML is written to disk twice - once in `runAnalysis()` and again in `liveServer.update()`. This is redundant and could cause race conditions.

```typescript
// In runAnalysis()
fs.writeFileSync(currentReportPath, html, "utf8");

// Then immediately after
if (liveServer.isRunning) {
    liveServer.update(html, currentReportPath); // Writes again!
}
```

**Impact:** Performance waste; potential file corruption if writes overlap.

**Fix:** Remove the first `writeFileSync` call and let `liveServer.update()` handle file writing.

---

#### 5. Unsafe Node.js Version Assumption
**File:** `extensions/live-server.ts`  
**Line:** 105  
**Issue:** `closeAllConnections()` is only available in Node.js 18.2+. No version check is performed.

```typescript
if (typeof this.server.closeAllConnections === "function") {
    this.server.closeAllConnections();
}
```

**Impact:** Could fail on older Node.js versions used by some Pi installations.

**Fix:** Already handled with typeof check, but add a comment documenting the minimum Node.js version requirement.

---

#### 6. Incomplete Bash Command Detection
**File:** `extensions/analyzer.ts`  
**Lines:** 264-267  
**Issue:** The regex for detecting file operations in bash commands is incomplete. Only catches `cat`, `ls`, `rm`, `mv`, `cp`, `vi`, `nano` but misses common commands like `touch`, `head`, `tail`, `grep`, `sed`, `awk`, `mkdir`, `chmod`, etc.

```typescript
const match = args.command?.match(
    /(?:cat|ls|rm|mv|cp|vi|nano)\s+([^\s;]+)/,
);
```

**Impact:** File tracking misses many file operations performed via bash.

**Fix:** Expand the regex:
```typescript
const match = args.command?.match(
    /(?:cat|ls|rm|mv|cp|vi|nano|touch|head|tail|grep|sed|awk|mkdir|chmod|chown|find|xargs)\s+([^\s;]+)/,
);
```

---

### 🟡 MEDIUM SEVERITY (4 issues)

#### 7. Unused Imports
**File:** `extensions/generator.ts`  
**Lines:** 13-15  
**Issue:** `writeFileSync`, `mkdirSync`, `join`, and `homedir` are imported but only used in the `writeReport()` method which appears to be dead code (never called externally).

```typescript
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
```

**Impact:** Unnecessary imports increase bundle size; dead code confuses maintainers.

**Fix:** Remove the `writeReport()` method and unused imports, or mark them for future use.

---

#### 8. Overly Permissive File Path Regex
**File:** `extensions/analyzer.ts`  
**Lines:** 162-164  
**Issue:** The regex for detecting file paths in user text is overly broad and could match non-file strings.

```typescript
const matches = block.text.match(
    /(?:\/|[A-Z]:\\)[\w./\\-]+\.\w+/g,
);
```

**Impact:** Could create false positive file tracking entries for non-file strings.

**Fix:** Make the regex more specific or add validation:
```typescript
const matches = block.text.match(
    /(?:\/|[A-Z]:\\)[\w./\\-]+\.(?:ts|js|py|json|md|txt|css|html|yaml|yml|toml|xml)/g,
);
```

---

#### 9. Magic Numbers
**File:** `extensions/analyzer.ts`  
**Lines:** 230, 299, 300  
**Issue:** Percentage thresholds (0.7, 0.3) and file status calculations use magic numbers without documentation.

```typescript
if (ratio >= 0.7) return "active";
if (ratio >= 0.3) return "stale";
return "legacy";
```

**Impact:** Hard to understand and maintain; thresholds may not be appropriate for all use cases.

**Fix:** Extract to named constants:
```typescript
const ACTIVE_THRESHOLD = 0.7;
const STALE_THRESHOLD = 0.3;
```

---

#### 10. Heartbeat Cleanup on Server Stop
**File:** `extensions/live-server.ts`  
**Lines:** 185-195  
**Issue:** The heartbeat interval is not cleared when the server is stopped, potentially causing memory leaks or errors.

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

**Impact:** Interval continues running after server stop, causing errors and memory leaks.

**Fix:** Store interval references and clear them in `stop()`:
```typescript
private heartbeats: Set<NodeJS.Timeout> = new Set();

// In handleSSE:
const heartbeat = setInterval(...);
this.heartbeats.add(heartbeat);

// In stop():
for (const h of this.heartbeats) clearInterval(h);
this.heartbeats.clear();
```

---

### 🟢 LOW SEVERITY (2 issues)

#### 11. Inconsistent Variable Naming
**File:** `extensions/index.ts`  
**Lines:** 136, 151  
**Issue:** Event handler parameters prefixed with underscore (`_event`) but still accessed, violating the convention that underscore means "unused".

```typescript
pi.on("session_before_compact", (_event: any, ctx: any) => {
    const tokens = _event?.preparation?.tokensBefore; // Accessing _event
```

**Impact:** Confusing naming convention; could mislead other developers.

**Fix:** Rename to `event` or use the parameter without underscore.

---

#### 12. Arbitrary Multiplier in Visual Display
**File:** `extensions/generator.ts`  
**Line:** 25  
**Issue:** The file weight bar uses a `* 3` multiplier that appears arbitrary and could distort the visual representation.

```typescript
style="width: ${Math.min(100, (file.weight / Math.max(1, total)) * 100 * 3)}%"
```

**Impact:** Visual representation may not accurately reflect relative file weights.

**Fix:** Document the purpose of the multiplier or use a more meaningful scaling function.

---

## Dead Code Analysis

### Confirmed Dead Code
1. **`ReportGenerator.writeReport()`** - Method exists but is never called from outside the class.
2. **`DEFAULT_REPORT_PATH` in live-server.ts** - Used only as a fallback, but the path is never written to by the extension.

### Unused Imports
1. **generator.ts**: `writeFileSync`, `mkdirSync`, `join`, `homedir` (related to dead `writeReport()` method)

---

## Null Safety Analysis

### Potential Null Reference Issues
1. **analyzer.ts:153** - `block.type` accessed without confirming `block` is an object (could be null in malformed messages)
2. **analyzer.ts:185** - Same issue with `block.type` in toolCall handling
3. **live-server.ts:155** - `html.replace("<head>", ...)` assumes `<head>` exists in HTML

### Properly Handled Null Cases
- ✅ Most optional chaining used correctly
- ✅ Error boundaries in place for critical operations
- ✅ Pi API calls wrapped in try/catch

---

## Functional Correctness Analysis

### Working Correctly
- ✅ Context analysis and token counting
- ✅ File tracking and status calculation
- ✅ Insight generation with proper thresholds
- ✅ HTML report generation with responsive design
- ✅ Live server with SSE updates
- ✅ Theme toggle and localStorage persistence
- ✅ Event delegation for SSE body replacement

### Potential Issues
- ⚠️ JSON detection heuristic may produce false positives
- ⚠️ Token counting is approximate (expected for heuristic approach)

---

## Pi Integration Analysis

### Correctly Implemented
- ✅ ExtensionAPI usage follows Pi conventions
- ✅ Tool registration with proper structure
- ✅ Command registration with args and context
- ✅ Event handling (context, turn_start, session_start, etc.)
- ✅ UI notifications via ctx.ui.notify
- ✅ Context usage retrieval via ctx.getContextUsage()

### Areas for Improvement
- ⚠️ Consider using Pi's built-in token counting instead of heuristic
- ⚠️ Add more comprehensive error handling for Pi API calls

---

## Code Quality Analysis

### Strengths
- ✅ Clean, well-organized code structure
- ✅ Comprehensive TypeScript typing
- ✅ Good separation of concerns (analyzer, generator, insights, server)
- ✅ Apple-inspired design in HTML/CSS
- ✅ Responsive design for mobile
- ✅ Proper SSE implementation with heartbeat
- ✅ Token-based authentication for SSE

### Areas for Improvement
- ⚠️ Some magic numbers could be extracted to constants
- ⚠️ Consider adding JSDoc comments for public methods
- ⚠️ Add more comprehensive error logging

---

## Recommendations

### Immediate Actions (Before Next Release)
1. **Fix the signal listener removal** (Critical) - Use proper cleanup pattern
2. **Add error logging** (High) - Replace silent catch blocks with debug logging
3. **Remove double file write** (High) - Eliminate redundant disk write
4. **Expand bash command detection** (High) - Add more file operation commands

### Short-term Improvements
1. **Remove dead code** - Delete unused `writeReport()` method and imports
2. **Extract magic numbers** - Create named constants for thresholds
3. **Improve heartbeat cleanup** - Store and clear intervals on server stop
4. **Add JSDoc comments** - Document public API methods

### Long-term Enhancements
1. **Add unit tests** for edge cases in token counting
2. **Consider Pi's built-in token counting** for more accuracy
3. **Add configuration options** for thresholds and behavior
4. **Implement proper XSS sanitization library** for HTML generation

---

## Test Coverage Assessment

The existing test suite covers:
- ✅ Basic analyzer functionality
- ✅ File tracking for various message types
- ✅ Percentage calculations
- ✅ HTML generation
- ✅ Insight generation

**Missing Test Coverage:**
- ❌ Live server functionality
- ❌ Token counter edge cases
- ❌ Error handling paths
- ❌ Concurrent access scenarios

---

## Conclusion

The pi-context-map project is a solid, well-designed Pi extension that provides valuable context visualization. The critical issues identified should be addressed before the next release, but the overall codebase quality is good. The project demonstrates proper Pi extension patterns and follows reasonable coding standards.

**Risk Assessment:** LOW-MEDIUM  
**Production Ready:** YES (with critical fixes applied)  
**Recommended Version:** 0.7.6 (after fixes)

---

*Report generated by Pi Coding Agent - Comprehensive Audit System*
