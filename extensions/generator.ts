/**
 * ReportGenerator
 * Generates a visual HTML dashboard based on the ContextComposition.
 * Apple-inspired design: clean whitespace, SF Pro typography, single blue accent.
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
		contextWindow: number = 128_000,
		actualTokens?: number | null,
	): string {
		// Use Pi's actual token count when available
		const total =
			actualTokens != null && actualTokens > 0
				? actualTokens
				: composition.total.tokens;
		const usagePercent =
			total > 0 ? Math.round((total / contextWindow) * 100) : 0;

		const fileCards = composition.files_detail
			.map(
				(file) => `
			<div class="file-card" data-path="${ReportGenerator.escapeHtml(file.path)}" data-status="${file.status}">
				<div class="file-card-top">
					<span class="file-path">${ReportGenerator.escapeHtml(file.path)}</span>
					<span class="file-weight">${file.weight.toLocaleString()}</span>
				</div>
				<div class="file-card-bottom">
					<span class="op-tag">${ReportGenerator.getOpIcon(file.lastOp.type)} &middot; Turn ${file.lastOp.turn}</span>
					<span class="status-chip ${file.status}">${file.status}</span>
				</div>
				<div class="file-bar">
					<div class="file-bar-fill" style="width: ${Math.min(100, (file.weight / Math.max(1, total)) * 100 * 3)}%"></div>
				</div>
			</div>`,
			)
			.join("");

		const insightCards = insights
			.map(
				(insight, i) => `
			<div class="insight-card ${insight.severity}${insight.severity === "info" ? " collapsed" : ""}">
				<button class="insight-header" data-target="i${i}" aria-expanded="${insight.severity !== "info"}">
					<svg class="insight-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 3l4 3-4 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
					<span class="insight-severity">${insight.severity}</span>
					<span class="insight-title">${ReportGenerator.escapeHtml(insight.title)}</span>
				</button>
				<div class="insight-body">
					<p>${ReportGenerator.escapeHtml(insight.message)}</p>
					${insight.command ? `<div class="insight-action"><code>${insight.command}</code></div>` : ""}
				</div>
			</div>`,
			)
			.join("");

		return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="context-map-token" content="{{TOKEN}}">
<title>Context Profiler</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap" rel="stylesheet">
<style>
:root {
	--canvas: #ffffff;
	--canvas-alt: #f5f5f7;
	--surface: #ffffff;
	--hairline: #e0e0e0;
	--hairline-soft: rgba(0,0,0,0.06);
	--ink: #1d1d1f;
	--ink-secondary: #6e6e73;
	--ink-tertiary: #86868b;
	--ink-quaternary: #a1a1a6;
	--accent: #0066cc;
	--accent-hover: #0071e3;
	--accent-soft: rgba(0,102,204,0.08);
	--success: #30d158;
	--success-soft: rgba(48,209,88,0.10);
	--warning: #ff9f0a;
	--warning-soft: rgba(255,159,10,0.10);
	--danger: #ff453a;
	--danger-soft: rgba(255,69,58,0.10);
	--seg-system: #5e5ce6;
	--seg-tools: #ff375f;
	--seg-history: #bf5af2;
	--seg-files: #007aff;
	--seg-summaries: #34c759;
}
[data-theme="dark"] {
	--canvas: #0a0a0b;
	--canvas-alt: #141415;
	--surface: #1a1a1c;
	--hairline: #2c2c2e;
	--hairline-soft: rgba(255,255,255,0.06);
	--ink: #f5f5f7;
	--ink-secondary: #a1a1a6;
	--ink-tertiary: #6e6e73;
	--ink-quaternary: #48484a;
	--accent: #2997ff;
	--accent-hover: #40a9ff;
	--accent-soft: rgba(41,151,255,0.12);
	--success: #30d158;
	--success-soft: rgba(48,209,88,0.12);
	--warning: #ff9f0a;
	--warning-soft: rgba(255,159,10,0.12);
	--danger: #ff453a;
	--danger-soft: rgba(255,69,58,0.12);
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
	background: var(--canvas);
	color: var(--ink);
	font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
	font-size: 17px;
	line-height: 1.47;
	letter-spacing: -0.374px;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
}
.container { max-width: 980px; margin: 0 auto; padding: 80px 24px; }

/* Header */
header { margin-bottom: 64px; }
h1 {
	font-size: 40px;
	font-weight: 600;
	line-height: 1.1;
	letter-spacing: 0;
	margin-bottom: 4px;
}
.subtitle { color: var(--ink-secondary); font-size: 17px; font-weight: 400; margin-bottom: 40px; }

/* Stat tiles */
.stats {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 1px;
	background: var(--hairline);
	border: 1px solid var(--hairline);
	border-radius: 18px;
	overflow: hidden;
	margin-bottom: 24px;
}
.stat {
	background: var(--surface);
	padding: 24px 20px;
	text-align: center;
}
.stat:not(:last-child) { border-right: 1px solid var(--hairline); }
.stat-value {
	font-size: 28px;
	font-weight: 600;
	letter-spacing: -0.374px;
	display: block;
	font-variant-numeric: tabular-nums;
}
.stat-label {
	font-size: 12px;
	font-weight: 400;
	color: var(--ink-tertiary);
	text-transform: uppercase;
	letter-spacing: 0.5px;
	margin-top: 4px;
	display: block;
}

/* Composition card */
.composition-card {
	background: var(--canvas-alt);
	border-radius: 18px;
	padding: 32px;
}
.composition-card h3 {
	font-size: 12px;
	font-weight: 600;
	color: var(--ink-tertiary);
	text-transform: uppercase;
	letter-spacing: 0.8px;
	margin-bottom: 20px;
}
.bar {
	height: 8px;
	background: rgba(0,0,0,0.06);
	border-radius: 4px;
	display: flex;
	overflow: hidden;
	margin-bottom: 16px;
}
.bar-seg { height: 100%; transition: width 0.4s ease; }
.bar-seg.seg-system { background: var(--seg-system); }
.bar-seg.seg-tools { background: var(--seg-tools); }
.bar-seg.seg-history { background: var(--seg-history); }
.bar-seg.seg-files { background: var(--seg-files); }
.bar-seg.seg-summaries { background: var(--seg-summaries); }

.legend {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
	gap: 8px 16px;
}
.legend-item {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 13px;
	color: var(--ink-secondary);
	font-variant-numeric: tabular-nums;
}
.legend-dot { width: 8px; height: 8px; border-radius: 4px; flex-shrink: 0; }
.legend-dot.sys { background: var(--seg-system); }
.legend-dot.tools { background: var(--seg-tools); }
.legend-dot.hist { background: var(--seg-history); }
.legend-dot.files { background: var(--seg-files); }
.legend-dot.summ { background: var(--seg-summaries); }

/* Section titles */
h2 {
	font-size: 28px;
	font-weight: 600;
	letter-spacing: 0.196px;
	margin: 64px 0 24px;
}
h2:first-of-type { margin-top: 48px; }

/* Insight cards */
.insight-card {
	background: var(--surface);
	border: 1px solid var(--hairline);
	border-left: 3px solid var(--accent);
	border-radius: 14px;
	margin-bottom: 8px;
	overflow: hidden;
	transition: box-shadow 0.2s;
}
.insight-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
.insight-card.critical { border-left-color: var(--danger); background: linear-gradient(90deg, var(--danger-soft) 0%, var(--surface) 100%); }
.insight-card.warning { border-left-color: var(--warning); background: linear-gradient(90deg, var(--warning-soft) 0%, var(--surface) 100%); }
.insight-card.success { border-left-color: var(--success); background: linear-gradient(90deg, var(--success-soft) 0%, var(--surface) 100%); }

.insight-header {
	display: flex;
	align-items: center;
	gap: 10px;
	width: 100%;
	padding: 14px 16px;
	background: none;
	border: none;
	cursor: pointer;
	font: inherit;
	text-align: left;
	color: inherit;
	-webkit-tap-highlight-color: transparent;
}
.insight-header:hover { background: var(--hairline-soft); }
.insight-chevron {
	flex-shrink: 0;
	color: var(--ink-quaternary);
	transition: transform 0.2s ease;
}
.collapsed .insight-chevron { transform: rotate(-90deg); }

.insight-severity {
	font-size: 11px;
	font-weight: 600;
	padding: 3px 8px;
	border-radius: 6px;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	background: var(--accent-soft);
	color: var(--accent);
	flex-shrink: 0;
}
.insight-card.critical .insight-severity { background: var(--danger-soft); color: var(--danger); }
.insight-card.warning .insight-severity { background: var(--warning-soft); color: var(--warning); }

.insight-title { font-size: 14px; font-weight: 600; color: var(--ink); }
.insight-body {
	padding: 0 16px 14px 48px;
	font-size: 14px;
	color: var(--ink-secondary);
	line-height: 1.6;
}
.collapsed .insight-body { display: none; }
.insight-body p { margin-bottom: 8px; }
.insight-action code {
	display: inline-block;
	background: var(--canvas-alt);
	color: var(--accent);
	font-family: "SF Mono", ui-monospace, "Cascadia Code", monospace;
	font-size: 12px;
	padding: 4px 10px;
	border-radius: 8px;
	border: 1px solid var(--hairline);
}

/* File controls */
.file-controls {
	display: flex;
	gap: 12px;
	margin-bottom: 20px;
	align-items: center;
	flex-wrap: wrap;
}
.file-search {
	flex: 1;
	min-width: 220px;
	height: 44px;
	padding: 0 20px;
	border: 1px solid rgba(0,0,0,0.08);
	border-radius: 22px;
	background: var(--surface);
	font: inherit;
	font-size: 14px;
	color: var(--ink);
	outline: none;
	transition: border-color 0.2s;
}
.file-search:focus { border-color: var(--accent); }
.file-search::placeholder { color: var(--ink-quaternary); }
.file-filter {
	height: 44px;
	padding: 0 16px;
	border: 1px solid rgba(0,0,0,0.08);
	border-radius: 22px;
	background: var(--surface);
	font: inherit;
	font-size: 13px;
	color: var(--ink-secondary);
	outline: none;
	cursor: pointer;
	transition: border-color 0.2s;
}
.file-filter:focus { border-color: var(--accent); }
.file-count { font-size: 13px; color: var(--ink-tertiary); margin-left: auto; }

/* File grid */
.file-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	gap: 12px;
}
.file-card {
	background: var(--surface);
	border: 1px solid var(--hairline);
	border-radius: 14px;
	padding: 16px;
	transition: border-color 0.2s, box-shadow 0.2s;
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.file-card:hover {
	border-color: var(--accent);
	box-shadow: 0 2px 12px rgba(0,102,204,0.08);
}
.file-card.hidden { display: none; }
.file-card-top {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 8px;
}
.file-path {
	font-family: "SF Mono", ui-monospace, "Cascadia Code", monospace;
	font-size: 12px;
	color: var(--ink);
	word-break: break-all;
	line-height: 1.5;
}
.file-weight {
	font-size: 11px;
	color: var(--ink-tertiary);
	white-space: nowrap;
	font-variant-numeric: tabular-nums;
	flex-shrink: 0;
}
.file-card-bottom {
	display: flex;
	justify-content: space-between;
	align-items: center;
}
.op-tag {
	font-size: 11px;
	color: var(--ink-tertiary);
}
.status-chip {
	font-size: 10px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	padding: 2px 8px;
	border-radius: 6px;
}
.status-chip.active { background: var(--success-soft); color: #248a3d; }
.status-chip.stale { background: var(--warning-soft); color: #b87503; }
.status-chip.legacy { background: var(--danger-soft); color: #cc3a30; }

.file-bar {
	height: 3px;
	background: rgba(0,0,0,0.06);
	border-radius: 2px;
	overflow: hidden;
}
.file-bar-fill {
	height: 100%;
	background: var(--accent);
	border-radius: 2px;
	transition: width 0.3s ease;
}

.empty-state {
	text-align: center;
	padding: 60px 20px;
	color: var(--ink-tertiary);
	font-size: 15px;
	grid-column: 1 / -1;
}

/* Live status badge */
.live-badge {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 4px 12px;
	border-radius: 20px;
	font-size: 11px;
	font-weight: 500;
	background: var(--success-soft);
	color: #248a3d;
	margin-bottom: 20px;
}
.live-badge .dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: var(--success);
	animation: pulse 2s infinite;
}
@keyframes pulse {
	0%, 100% { opacity: 1; }
	50% { opacity: 0.4; }
}

/* Usage ring */
.usage-container {
	display: flex;
	gap: 24px;
	align-items: center;
	margin-bottom: 24px;
}
.usage-ring {
	width: 80px;
	height: 80px;
	border-radius: 50%;
	position: relative;
	flex-shrink: 0;
}
.usage-ring svg { transform: rotate(-90deg); }
.usage-ring .bg { fill: none; stroke: rgba(0,0,0,0.06); stroke-width: 6; }
.usage-ring .fg {
	fill: none;
	stroke: var(--accent);
	stroke-width: 6;
	stroke-linecap: round;
	transition: stroke-dashoffset 0.6s ease;
}
.usage-ring.critical .fg { stroke: var(--danger); }
.usage-ring.warning .fg { stroke: var(--warning); }
.usage-label {
	font-size: 18px;
	font-weight: 600;
	letter-spacing: -0.2px;
}
.usage-label small {
	font-size: 13px;
	font-weight: 400;
	color: var(--ink-secondary);
	display: block;
	margin-top: 2px;
}

/* Responsive */
@media (max-width: 700px) {
	.container { padding: 40px 16px; }
	h1 { font-size: 32px; }
	.stats { grid-template-columns: repeat(2, 1fr); }
	.stat:nth-child(2) { border-right: none; }
	.stat:nth-child(3), .stat:nth-child(4) { border-top: 1px solid var(--hairline); }
	.stat-value { font-size: 22px; }
	.file-grid { grid-template-columns: 1fr; }
	.legend { grid-template-columns: repeat(2, 1fr); }
	.composition-card { padding: 20px; }
	.usage-container { flex-direction: column; align-items: flex-start; }
}
</style>
</head>
<body>
<div class="container">

<header>
			<button id="themeToggle" style="position:fixed;top:24px;right:24px;z-index:100;display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:1px solid var(--hairline);border-radius:20px;background:var(--surface);color:var(--ink-secondary);font:inherit;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.08);" aria-label="Toggle theme">
				<svg id="themeIconSun" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none;"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
				<svg id="themeIconMoon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
				<span id="themeLabel">Dark</span>
			</button>
			<div class="live-badge"><span class="dot"></span>Live</div>
			<h1>Context Profiler</h1>
	<p class="subtitle">Session context window breakdown with actionable recommendations</p>

	<div class="stats">
		<div class="stat">
			<span class="stat-value">${total.toLocaleString()}</span>
			<span class="stat-label">Total Tokens</span>
		</div>
		<div class="stat">
			<span class="stat-value">${composition.files_detail.length}</span>
			<span class="stat-label">Files</span>
		</div>
		<div class="stat">
			<span class="stat-value">${insights.filter((i) => i.severity === "warning" || i.severity === "critical").length}</span>
			<span class="stat-label">Alerts</span>
		</div>
		<div class="stat">
			<span class="stat-value">${(contextWindow / 1000).toFixed(0)}k</span>
			<span class="stat-label">Context Window</span>
		</div>
	</div>

	<div class="usage-container">
		<div class="usage-ring${usagePercent > 80 ? " critical" : usagePercent > 60 ? " warning" : ""}">
			<svg width="80" height="80" viewBox="0 0 80 80">
				<circle class="bg" cx="40" cy="40" r="34"/>
				<circle class="fg" cx="40" cy="40" r="34"
					stroke-dasharray="${2 * Math.PI * 34}"
					stroke-dashoffset="${2 * Math.PI * 34 * (1 - usagePercent / 100)}"/>
			</svg>
		</div>
		<div class="usage-label">
			${usagePercent}% of ${(contextWindow / 1000).toFixed(0)}k window
			<small>${usagePercent > 80 ? "Compaction recommended" : usagePercent > 60 ? "Monitor usage" : "Healthy"}</small>
		</div>
	</div>

	<div class="composition-card">
		<h3>Context Composition</h3>
		<div class="bar">
			${ReportGenerator.seg("seg-system", composition.system.percent)}
			${ReportGenerator.seg("seg-tools", composition.tools.percent)}
			${ReportGenerator.seg("seg-history", composition.history.percent)}
			${ReportGenerator.seg("seg-files", composition.files.percent)}
			${ReportGenerator.seg("seg-summaries", composition.summaries.percent)}
		</div>
		<div class="legend">
			<div class="legend-item"><span class="legend-dot sys"></span> System &mdash; ${composition.system.tokens.toLocaleString()} (${composition.system.percent}%)</div>
			<div class="legend-item"><span class="legend-dot tools"></span> Tools &mdash; ${composition.tools.tokens.toLocaleString()} (${composition.tools.percent}%)</div>
			<div class="legend-item"><span class="legend-dot hist"></span> History &mdash; ${composition.history.tokens.toLocaleString()} (${composition.history.percent}%)</div>
			<div class="legend-item"><span class="legend-dot files"></span> Files &mdash; ${composition.files.tokens.toLocaleString()} (${composition.files.percent}%)</div>
			<div class="legend-item"><span class="legend-dot summ"></span> Summaries &mdash; ${composition.summaries.tokens.toLocaleString()} (${composition.summaries.percent}%)</div>
		</div>
	</div>
</header>

<section>
	<h2>Insights</h2>
	${insightCards || `<p style="color:var(--ink-tertiary);font-size:15px;">No insights available yet &mdash; the context composition is balanced.</p>`}
</section>

<section>
	<h2>Files <span style="font-size:14px;font-weight:400;color:var(--ink-tertiary);letter-spacing:0;">(${composition.files_detail.length})</span></h2>
	<div class="file-controls">
		<input type="text" class="file-search" id="fileSearch" placeholder="Search files" aria-label="Search files">
		<select class="file-filter" id="fileFilter" aria-label="Filter by status">
			<option value="all">All</option>
			<option value="active">Active</option>
			<option value="stale">Stale</option>
			<option value="legacy">Legacy</option>
		</select>
		<span class="file-count" id="fileCount"></span>
	</div>
	<div class="file-grid" id="fileGrid">
		${fileCards || '<div class="empty-state">No files tracked in the current session context.</div>'}
	</div>
	<div class="empty-state" id="emptyState" style="display:none">No files match your current filters.</div>
</section>

</div>

<script>
(function() {
	var search = document.getElementById('fileSearch');
	var filter = document.getElementById('fileFilter');
	var grid = document.getElementById('fileGrid');
	var count = document.getElementById('fileCount');
	var empty = document.getElementById('emptyState');
	var cards = grid ? Array.from(grid.querySelectorAll('.file-card')) : [];
	var total = cards.length;

	function update() {
		var q = (search.value || '').toLowerCase();
		var s = filter.value;
		var v = 0;
		for (var i = 0; i < cards.length; i++) {
			var c = cards[i];
			var p = (c.getAttribute('data-path') || '').toLowerCase();
			var st = c.getAttribute('data-status') || '';
			var mq = !q || p.indexOf(q) !== -1;
			var ms = s === 'all' || st === s;
			if (mq && ms) { c.classList.remove('hidden'); v++; }
			else { c.classList.add('hidden'); }
		}
		count.textContent = v === total ? total + ' files' : v + ' of ' + total;
		empty.style.display = v === 0 ? '' : 'none';
	}
	if (search) search.addEventListener('input', update);
	if (filter) filter.addEventListener('change', update);
	update();

	// Theme toggle
	function applyTheme(t) {
		document.documentElement.setAttribute('data-theme', t);
		localStorage.setItem('context-map-theme', t);
		// Query fresh each time (DOM may have been replaced by SSE)
		var lbl = document.getElementById('themeLabel');
		var sun = document.getElementById('themeIconSun');
		var moon = document.getElementById('themeIconMoon');
		if (lbl) lbl.textContent = t === 'dark' ? 'Light' : 'Dark';
		if (sun) sun.style.display = t === 'dark' ? '' : 'none';
		if (moon) moon.style.display = t === 'dark' ? 'none' : '';
	}
	var saved = localStorage.getItem('context-map-theme');
	applyTheme(saved || 'light');
	// Use event delegation on document so clicks survive body replacement
	document.addEventListener('click', function(e) {
		var btn = e.target.closest('#themeToggle');
		if (!btn) return;
		var cur = document.documentElement.getAttribute('data-theme');
		applyTheme(cur === 'dark' ? 'light' : 'dark');
	});

	// Insight toggles (event delegation — survives SSE body replacement)
	document.addEventListener('click', function(e) {
		var btn = e.target.closest('.insight-header');
		if (!btn) return;
		var card = btn.closest('.insight-card');
		if (!card) return;
		var was = card.classList.toggle('collapsed');
		btn.setAttribute('aria-expanded', was ? 'false' : 'true');
	});

	// Live SSE
	try {
		var token = (document.querySelector('meta[name="context-map-token"]') || {}).getAttribute('content') || '';
		var es = new EventSource('/events?token=' + encodeURIComponent(token));
		es.onmessage = function(e) {
			try {
				var p = JSON.parse(e.data);
				if (p.html) {
					// Preserve current theme before replacing body
					var currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
					// Only replace the body content to preserve <style> and <script>
					var d = new DOMParser().parseFromString(p.html, 'text/html');
					var newBody = d.querySelector('body');
					var newTitle = d.querySelector('title');
					if (newBody) {
						document.body.innerHTML = newBody.innerHTML;
					}
					if (newTitle) {
						document.title = newTitle.textContent || document.title;
					}
					// Restore theme after body replacement
					applyTheme(currentTheme);
					// Re-bind file search/filter (direct listeners, not delegated)
					var ns = document.getElementById('fileSearch');
					var nf = document.getElementById('fileFilter');
					if (ns) ns.addEventListener('input', update);
					if (nf) nf.addEventListener('change', update);
					// Re-query cards after body replacement
					cards = Array.from(document.getElementById('fileGrid').querySelectorAll('.file-card'));
					total = cards.length;
					update();
				}
			} catch(_) {}
		};
		es.onerror = function() { es.close(); };
	} catch(_) {}
})();
</script>

</body>
</html>`;
	}

	public static writeReport(html: string): string {
		const reportDir = join(homedir(), ".pi", "context-map");
		mkdirSync(reportDir, { recursive: true });
		const reportPath = join(reportDir, "report.html");
		writeFileSync(reportPath, html, "utf8");
		return reportPath;
	}

	private static seg(cls: string, pct: number): string {
		return pct > 0
			? `<div class="bar-seg ${cls}" style="width:${pct}%"></div>`
			: "";
	}

	private static getOpIcon(type: string): string {
		switch (type) {
			case "read":
				return "Read";
			case "write":
				return "Write";
			case "edit":
				return "Edit";
			case "delete":
				return "Delete";
			default:
				return "Access";
		}
	}

	private static escapeHtml(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}
}
