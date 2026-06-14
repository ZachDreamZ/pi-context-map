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
			<div class="file-card ${file.status}">
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
			.map(
				(insight) => `
			<div class="insight-card ${insight.severity}">
				<div class="insight-header">
					<span class="insight-severity">${insight.severity.toUpperCase()}</span>
					<span class="insight-title">${ReportGenerator.escapeHtml(insight.title)}</span>
				</div>
				<div class="insight-body">${ReportGenerator.escapeHtml(insight.message)}</div>
				${insight.command ? `<div class="insight-command">Suggested: <code>${insight.command}</code></div>` : ""}
			</div>
		`,
			)
			.join("");

		return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pi Context Map</title>
    <style>
        :root {
            --bg: #0f172a;
            --card-bg: #1e293b;
            --text: #f1f5f9;
            --text-dim: #94a3b8;
            --primary: #38bdf8;
            --active: #22c55e;
            --stale: #eab308;
            --legacy: #ef4444;
            --border: #334155;
        }
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

        <div class="file-grid">
            ${fileCards}
        </div>
    </div>
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
			case "read": return "READ";
			case "write": return "WRITE";
			case "edit": return "EDIT";
			case "delete": return "DELETE";
			default: return "FILE";
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
