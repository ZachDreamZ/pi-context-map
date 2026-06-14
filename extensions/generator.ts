/**
 * ReportGenerator
 * Generates a visual HTML dashboard based on the ContextMap.
 */

import type { ContextComposition } from "./analyzer";
import type { Insight } from "./insights";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export class ReportGenerator {
	public static generateHTML(
		composition: ContextComposition,
		insights: Insight[],
	): string {
		const fileCards = composition.files_detail
			.map(
				(file) => `
			<div class="file-card ${file.status}" data-path="${ReportGenerator.escapeHtml(file.path)}" data-status="${file.status}">
				<div class="file-header">
					<span class="file-path">${ReportGenerator.escapeHtml(file.path)}</span>
					<span class="file-weight">${file.weight.toLocaleString()} tokens</span>
				</div>
				<div class="file-footer">
					<span class="op-badge">${ReportGenerator.getOpIcon(file.lastOp.type)} ${file.lastOp.type}</span>
					<span class="turn-badge">Turn ${file.lastOp.turn}</span>
					<span class="status-text">${file.status.toUpperCase()}</span>
				</div>
				<div class="weight-bar">
					<div class="weight-fill" style="width: ${Math.min(100, (file.weight / 1000) * 100)}%"></div>
				</div>
			</div>
		`,
			)
			.join("");

		const insightCards = insights
			.map((insight, i) => {
				// Critical and warning are expanded by default; info is collapsed
				const isCollapsed = insight.severity === "info" ? " collapsed" : "";
				return `
			<div class="insight-card ${insight.severity}${isCollapsed}">
				<button class="insight-header" data-toggle="insight-${i}" aria-expanded="${isCollapsed ? "false" : "true"}">
					<svg class="insight-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4,6 8,10 12,6"/></svg>
					<span class="insight-severity">${insight.severity.toUpperCase()}</span>
					<span class="insight-title">${ReportGenerator.escapeHtml(insight.title)}</span>
				</button>
				<div class="insight-body">
					${ReportGenerator.escapeHtml(insight.message)}
					${insight.command ? `<div class="insight-command">Suggested: <code>${insight.command}</code></div>` : ""}
				</div>
			</div>
		`;
			})
			.join("");

		return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pi Context Profiler</title>
    <style>
        /* ============================================
           pi-context-map Report — Design Tokens
           Based on Linear design system + shadcn/ui card patterns
           ============================================ */
        :root {
            /* Surfaces */
            --canvas: #010102;
            --surface-1: #0f1011;
            --surface-2: #141516;
            --surface-3: #18191a;
            --hairline: #23252a;
            --hairline-strong: #34343a;

            /* Text */
            --ink: #f7f8f8;
            --ink-muted: #d0d6e0;
            --ink-subtle: #8a8f98;
            --ink-tertiary: #62666d;

            /* Accent */
            --accent: #5e6ad2;
            --accent-hover: #828fff;
            --accent-soft: rgba(94, 106, 210, 0.12);

            /* Semantic */
            --success: #27a644;
            --warning: #eab308;
            --danger: #ef4444;
            --warning-soft: rgba(234, 179, 8, 0.10);
            --danger-soft: rgba(239, 68, 68, 0.10);

            /* Composition segments */
            --seg-system: #6366f1;
            --seg-tools: #ec4899;
            --seg-history: #a855f7;
            --seg-files: #38bdf8;
            --seg-summaries: #14b8a6;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            background: var(--canvas);
            color: var(--ink);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
            font-size: 14px;
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
        }

        .container { max-width: 1200px; margin: 0 auto; padding: 48px 32px; }

        /* ===== Header ===== */
        header { margin-bottom: 48px; }
        h1 {
            font-size: 32px;
            font-weight: 600;
            letter-spacing: -0.8px;
            margin-bottom: 8px;
            color: var(--ink);
        }
        .subtitle { color: var(--ink-subtle); font-size: 14px; margin-bottom: 32px; }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 16px;
        }
        .stat-card {
            background: var(--surface-1);
            border: 1px solid var(--hairline);
            border-radius: 6px;
            padding: 20px;
            text-align: left;
        }
        .stat-value {
            font-size: 24px;
            font-weight: 600;
            color: var(--ink);
            display: block;
            font-variant-numeric: tabular-nums;
        }
        .stat-label {
            color: var(--ink-subtle);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 4px;
            display: block;
        }

        /* ===== Composition Bar ===== */
        .composition-container {
            background: var(--surface-1);
            border: 1px solid var(--hairline);
            border-radius: 6px;
            padding: 20px;
            margin-top: 24px;
        }
        .composition-bar {
            height: 32px;
            background: var(--surface-3);
            border-radius: 4px;
            display: flex;
            overflow: hidden;
            margin-bottom: 12px;
        }
        .composition-segment {
            height: 100%;
            transition: opacity 0.2s ease;
            cursor: default;
        }
        .composition-segment:hover { opacity: 0.85; }
        .seg-system { background: var(--seg-system); }
        .seg-tools { background: var(--seg-tools); }
        .seg-history { background: var(--seg-history); }
        .seg-files { background: var(--seg-files); }
        .seg-summaries { background: var(--seg-summaries); }

        .composition-legend {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 8px;
            font-size: 12px;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--ink-muted);
            font-variant-numeric: tabular-nums;
        }
        .dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }

        /* ===== Sections ===== */
        h2 {
            font-size: 20px;
            font-weight: 600;
            color: var(--ink);
            margin: 48px 0 16px;
            letter-spacing: -0.3px;
        }
        h3 {
            font-size: 12px;
            font-weight: 500;
            color: var(--ink-subtle);
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-bottom: 12px;
        }

        /* ===== Insights (shadcn-style cards) ===== */
        .insight-card {
            background: var(--surface-1);
            border: 1px solid var(--hairline);
            border-left: 3px solid var(--accent);
            border-radius: 6px;
            margin-bottom: 8px;
            overflow: hidden;
        }
        .insight-card.critical { border-left-color: var(--danger); background: linear-gradient(90deg, var(--danger-soft) 0%, var(--surface-1) 100%); }
        .insight-card.warning { border-left-color: var(--warning); background: linear-gradient(90deg, var(--warning-soft) 0%, var(--surface-1) 100%); }
        .insight-card.info { border-left-color: var(--accent); }

        .insight-header {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 16px;
            cursor: pointer;
            user-select: none;
            background: none;
            border: none;
            width: 100%;
            text-align: left;
            color: inherit;
            font: inherit;
        }
        .insight-header:hover { background: var(--surface-2); }
        .insight-chevron {
            width: 16px;
            height: 16px;
            transition: transform 0.2s ease;
            color: var(--ink-subtle);
            flex-shrink: 0;
        }
        .insight-card.collapsed .insight-chevron { transform: rotate(-90deg); }
        .insight-severity {
            font-size: 10px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 3px;
            background: var(--surface-3);
            color: var(--ink-muted);
            letter-spacing: 0.5px;
            flex-shrink: 0;
        }
        .insight-card.critical .insight-severity { color: var(--danger); }
        .insight-card.warning .insight-severity { color: var(--warning); }
        .insight-card.info .insight-severity { color: var(--accent); }
        .insight-title { font-weight: 600; color: var(--ink); font-size: 14px; }
        .insight-body {
            padding: 0 16px 14px 44px;
            color: var(--ink-muted);
            font-size: 13px;
            line-height: 1.6;
        }
        .insight-card.collapsed .insight-body { display: none; }
        .insight-command {
            margin-top: 8px;
            font-size: 12px;
            color: var(--ink-subtle);
        }
        .insight-command code {
            background: var(--surface-3);
            color: var(--accent-hover);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
            font-size: 12px;
        }

        /* ===== File Controls ===== */
        .file-controls {
            display: flex;
            gap: 12px;
            margin-bottom: 16px;
            flex-wrap: wrap;
        }
        .file-search, .file-filter {
            background: var(--surface-1);
            border: 1px solid var(--hairline);
            border-radius: 6px;
            padding: 8px 12px;
            color: var(--ink);
            font: inherit;
            font-size: 13px;
            outline: none;
            transition: border-color 0.15s ease;
        }
        .file-search:focus, .file-filter:focus { border-color: var(--accent); }
        .file-search { flex: 1; min-width: 200px; }
        .file-search::placeholder { color: var(--ink-tertiary); }
        .file-filter { cursor: pointer; }
        .file-count { color: var(--ink-subtle); font-size: 12px; padding: 8px 0; align-self: center; }

        /* ===== File Grid ===== */
        .file-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 12px;
        }
        .file-card {
            background: var(--surface-1);
            border: 1px solid var(--hairline);
            border-radius: 6px;
            padding: 14px 16px;
            transition: border-color 0.15s ease;
        }
        .file-card:hover { border-color: var(--hairline-strong); }
        .file-card.hidden { display: none; }
        .file-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 8px;
            margin-bottom: 10px;
        }
        .file-path {
            font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
            font-size: 12px;
            color: var(--ink);
            word-break: break-all;
            line-height: 1.4;
        }
        .file-weight {
            font-size: 11px;
            color: var(--ink-subtle);
            white-space: nowrap;
            font-variant-numeric: tabular-nums;
            flex-shrink: 0;
        }
        .file-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            color: var(--ink-subtle);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .op-badge {
            background: var(--surface-3);
            padding: 2px 6px;
            border-radius: 3px;
            color: var(--ink-muted);
        }
        .status-text { font-weight: 700; }
        .file-card.active { border-left: 3px solid var(--success); }
        .file-card.active .status-text { color: var(--success); }
        .file-card.stale { border-left: 3px solid var(--warning); }
        .file-card.stale .status-text { color: var(--warning); }
        .file-card.legacy { border-left: 3px solid var(--danger); }
        .file-card.legacy .status-text { color: var(--danger); }

        .weight-bar {
            height: 3px;
            background: var(--surface-3);
            border-radius: 2px;
            margin-top: 10px;
            overflow: hidden;
        }
        .weight-fill {
            height: 100%;
            background: var(--accent);
            transition: width 0.3s ease;
        }

        .empty-state {
            text-align: center;
            padding: 48px 16px;
            color: var(--ink-subtle);
            font-size: 13px;
        }
    </style>
        body {
            background: var(--bg);
            color: var(--text);
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 2rem;
            line-height: 1.5;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        header { margin-bottom: 3rem; border-bottom: 1px solid var(--border); padding-bottom: 2rem; }
        h1 { font-size: 2rem; margin: 0; color: var(--primary); }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            margin-top: 2rem;
        }
        .stat-card {
            background: var(--card-bg);
            padding: 1.5rem;
            border-radius: 12px;
            border: 1px solid var(--border);
            text-align: center;
        }
        .stat-value { font-size: 1.5rem; font-weight: bold; display: block; }
        .stat-label { color: var(--text-dim); font-size: 0.875rem; text-transform: uppercase; }
        
        .composition-container {
            margin: 2rem 0;
            background: var(--card-bg);
            padding: 1.5rem;
            border-radius: 12px;
            border: 1px solid var(--border);
        }
        .composition-bar {
            height: 32px;
            background: #020617;
            border-radius: 8px;
            display: flex;
            overflow: hidden;
            margin-bottom: 1rem;
        }
        .composition-segment { height: 100%; transition: width 0.3s ease; }
        .seg-system { background: #6366f1; }
        .seg-tools { background: #ec4899; }
        .seg-history { background: #a855f7; }
        .seg-files { background: var(--primary); }
        .seg-summaries { background: #14b8a6; }

        .composition-legend {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 0.75rem;
            font-size: 0.8rem;
            color: var(--text-dim);
        }
        .legend-item { display: flex; align-items: center; gap: 0.5rem; }
        .dot { width: 10px; height: 10px; border-radius: 50%; }

        .insights-section { margin: 2rem 0; }
        .insight-card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-left: 4px solid var(--primary);
            border-radius: 8px;
            padding: 1rem 1.25rem;
            margin-bottom: 0.75rem;
        }
        .insight-card.info { border-left-color: var(--primary); }
        .insight-card.warning { border-left-color: var(--stale); }
        .insight-card.critical { border-left-color: var(--legacy); }
        .insight-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
        .insight-severity {
            font-size: 0.7rem;
            font-weight: bold;
            padding: 2px 8px;
            border-radius: 4px;
            background: rgba(255,255,255,0.1);
        }
        .insight-title { font-weight: 600; }
        .insight-body { color: var(--text); font-size: 0.9rem; }
        .insight-command { margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-dim); }
        .insight-command code {
            background: rgba(0,0,0,0.3);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Fira Code', monospace;
        }

        .file-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 1rem;
        }
        .file-card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 1rem;
            transition: transform 0.2s ease, border-color 0.2s ease;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .file-card:hover { transform: translateY(-4px); border-color: var(--primary); }
        .file-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 1rem;
        }
        .file-path {
            font-family: 'Fira Code', monospace;
            font-size: 0.875rem;
            word-break: break-all;
            margin-right: 1rem;
            color: var(--text);
        }
        .file-weight { font-size: 0.75rem; color: var(--text-dim); white-space: nowrap; }
        .file-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 1rem;
            font-size: 0.75rem;
        }
        .op-badge {
            background: #0f172a;
            padding: 2px 6px;
            border-radius: 4px;
            color: var(--text-dim);
        }
        .turn-badge { color: var(--text-dim); }
        .status-text { font-weight: bold; text-transform: uppercase; }

        /* Status Colors */
        .active { border-left: 4px solid var(--active); }
        .active .status-text { color: var(--active); }
        .stale { border-left: 4px solid var(--stale); }
        .stale .status-text { color: var(--stale); }
        .legacy { border-left: 4px solid var(--legacy); }
        .legacy .status-text { color: var(--legacy); }

        .weight-bar {
            height: 4px;
            background: #020617;
            border-radius: 2px;
            margin-top: 1rem;
            overflow: hidden;
        }
        .weight-fill {
            height: 100%;
            background: var(--primary);
            transition: width 0.3s ease;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Pi Context Profiler</h1>
            <p style="color: var(--text-dim)">Professional session context window analysis with actionable insights.</p>

            <div class="stats-grid">
                <div class="stat-card">
                    <span class="stat-value">${composition.total.tokens.toLocaleString()}</span>
                    <span class="stat-label">Total Tokens</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${composition.files_detail.length}</span>
                    <span class="stat-label">Files in Context</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${composition.tools.tokens.toLocaleString()}</span>
                    <span class="stat-label">Tool Tokens</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${Math.round((composition.total.tokens / 128000) * 100)}%</span>
                    <span class="stat-label">Of 128k Window</span>
                </div>
            </div>

            <div class="composition-container">
                <h3 style="margin-top: 0; color: var(--text-dim); font-size: 0.9rem; text-transform: uppercase;">Context Composition</h3>
                <div class="composition-bar">
                    <div class="composition-segment seg-system" style="width: ${composition.system.percent}%" title="System: ${composition.system.percent}%"></div>
                    <div class="composition-segment seg-tools" style="width: ${composition.tools.percent}%" title="Tools: ${composition.tools.percent}%"></div>
                    <div class="composition-segment seg-history" style="width: ${composition.history.percent}%" title="History: ${composition.history.percent}%"></div>
                    <div class="composition-segment seg-files" style="width: ${composition.files.percent}%" title="Files: ${composition.files.percent}%"></div>
                    <div class="composition-segment seg-summaries" style="width: ${composition.summaries.percent}%" title="Summaries: ${composition.summaries.percent}%"></div>
                </div>
                <div class="composition-legend">
                    <div class="legend-item"><span class="dot seg-system"></span> System (${composition.system.percent}%)</div>
                    <div class="legend-item"><span class="dot seg-tools"></span> Tools (${composition.tools.percent}%)</div>
                    <div class="legend-item"><span class="dot seg-history"></span> History (${composition.history.percent}%)</div>
                    <div class="legend-item"><span class="dot seg-files"></span> Files (${composition.files.percent}%)</div>
                    <div class="legend-item"><span class="dot seg-summaries"></span> Summaries (${composition.summaries.percent}%)</div>
                </div>
            </div>
        </header>

        <section class="insights-section">
            <h2>Actionable Insights</h2>
            ${insightCards}
        </section>

        <section>
            <h2>Files in Context</h2>
            <div class="file-controls">
                <input type="text" class="file-search" id="fileSearch" placeholder="Search files by path..." aria-label="Search files" />
                <select class="file-filter" id="fileFilter" aria-label="Filter by status">
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="stale">Stale</option>
                    <option value="legacy">Legacy</option>
                </select>
                <span class="file-count" id="fileCount"></span>
            </div>
            <div class="file-grid" id="fileGrid">
                ${fileCards}
            </div>
            <div class="empty-state" id="emptyState" style="display: none;">No files match your search.</div>
        </section>
    </div>

    <script>
        (function() {
            // ===== Live update via Server-Sent Events =====
            // Token is injected into the script via a meta tag (set by the server).
            // Connect to /events?token=...; when the server pushes a new html payload, replace the document.
            try {
                var tokenMeta = document.querySelector('meta[name="context-map-token"]');
                var token = tokenMeta ? tokenMeta.getAttribute('content') : '';
                var evtSource = new EventSource('/events?token=' + encodeURIComponent(token));
                evtSource.onmessage = function(e) {
                    try {
                        var payload = JSON.parse(e.data);
                        if (payload.html) {
                            // Replace the document body with the new HTML
                            var parser = new DOMParser();
                            var newDoc = parser.parseFromString(payload.html, 'text/html');
                            document.documentElement.replaceChild(
                                document.importNode(newDoc.documentElement, true),
                                document.documentElement
                            );
                        }
                    } catch (err) {
                        console.warn('Failed to apply live update:', err);
                    }
                };
                evtSource.onerror = function() {
                    // Silently close on error; user can refresh the page to reconnect
                    evtSource.close();
                };
            } catch (err) {
                // EventSource not available; fall back to manual refresh
            }

            // ===== Insight collapse/expand =====
            document.querySelectorAll('.insight-header[data-toggle]').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var card = btn.closest('.insight-card');
                    var isCollapsed = card.classList.toggle('collapsed');
                    btn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
                });
            });

            // ===== File search & filter =====
            var search = document.getElementById('fileSearch');
            var filter = document.getElementById('fileFilter');
            var grid = document.getElementById('fileGrid');
            var count = document.getElementById('fileCount');
            var empty = document.getElementById('emptyState');
            var cards = grid ? Array.prototype.slice.call(grid.querySelectorAll('.file-card')) : [];
            var total = cards.length;

            function applyFilters() {
                var query = (search.value || '').toLowerCase();
                var status = filter.value;
                var visible = 0;
                cards.forEach(function(card) {
                    var path = (card.getAttribute('data-path') || '').toLowerCase();
                    var cardStatus = card.getAttribute('data-status') || '';
                    var matchQuery = !query || path.indexOf(query) !== -1;
                    var matchStatus = status === 'all' || cardStatus === status;
                    if (matchQuery && matchStatus) {
                        card.classList.remove('hidden');
                        visible++;
                    } else {
                        card.classList.add('hidden');
                    }
                });
                count.textContent = visible === total ? total + ' files' : visible + ' of ' + total + ' files';
                empty.style.display = visible === 0 ? 'block' : 'none';
            }

            if (search) search.addEventListener('input', applyFilters);
            if (filter) filter.addEventListener('change', applyFilters);
            applyFilters();
        })();
    </script>
</body>
</html>
`;
	}

	public static writeReport(html: string): string {
		const reportDir = join(homedir(), ".pi", "context-map");
		mkdirSync(reportDir, { recursive: true });
		const reportPath = join(reportDir, "report.html");
		writeFileSync(reportPath, html, "utf8");
		return reportPath;
	}

	private static getOpIcon(type: string): string {
		switch (type) {
			case "read":
				return "READ";
			case "write":
				return "WRITE";
			case "edit":
				return "EDIT";
			case "delete":
				return "DELETE";
			default:
				return "FILE";
		}
	}

	private static escapeHtml(text: string): string {
		const map = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#039;",
		};
		return text.replace(/[&<>"']/g, (m) => map[m as keyof typeof map]);
	}
}
