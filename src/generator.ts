/**
 * ReportGenerator
 * Generates a visual HTML dashboard based on the ContextMap.
 */

import type { ContextMap } from "./analyzer";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export class ReportGenerator {
	public static generateHTML(map: ContextMap): string {
		const fileCards = map.files
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

		const budgetPercent = (map.fileTokens / map.totalTokens) * 100;

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
        
        .budget-container {
            margin: 2rem 0;
            background: var(--card-bg);
            padding: 1rem;
            border-radius: 12px;
            border: 1px solid var(--border);
        }
        .budget-bar {
            height: 24px;
            background: #020617;
            border-radius: 12px;
            display: flex;
            overflow: hidden;
            margin-bottom: 0.5rem;
        }
        .budget-segment { height: 100%; transition: width 0.3s ease; }
        .seg-system { background: #6366f1; }
        .seg-history { background: #a855f7; }
        .seg-files { background: var(--primary); }
        .seg-tools { background: #ec4899; }
        
        .budget-legend {
            display: flex;
            gap: 1rem;
            justify-content: center;
            font-size: 0.75rem;
            color: var(--text-dim);
        }
        .legend-item { display: flex; align-items: center; gap: 0.5rem; }
        .dot { width: 8px; height: 8px; border-radius: 50%; }

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
            <h1>Pi Context Map</h1>
            <p style="color: var(--text-dim)">Session context window visualization and token distribution.</p>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <span class="stat-value">${map.totalTokens.toLocaleString()}</span>
                    <span class="stat-label">Total Tokens</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${map.files.length}</span>
                    <span class="stat-label">Files in Context</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${map.fileTokens.toLocaleString()}</span>
                    <span class="stat-label">File Tokens</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${Math.round(budgetPercent)}%</span>
                    <span class="stat-label">File Load</span>
                </div>
            </div>

            <div class="budget-container">
                <div class="budget-bar">
                    <div class="budget-segment seg-system" style="width: ${(map.systemTokens / map.totalTokens) * 100 || 0}%"></div>
                    <div class="budget-segment seg-history" style="width: ${(map.historyTokens / map.totalTokens) * 100 || 0}%"></div>
                    <div class="budget-segment seg-files" style="width: ${(map.fileTokens / map.totalTokens) * 100 || 0}%"></div>
                    <div class="budget-segment seg-tools" style="width: ${(map.toolTokens / map.totalTokens) * 100 || 0}%"></div>
                </div>
                <div class="budget-legend">
                    <div class="legend-item"><span class="dot seg-system"></span> System</div>
                    <div class="legend-item"><span class="dot seg-history"></span> History</div>
                    <div class="legend-item"><span class="dot seg-files"></span> Files</div>
                    <div class="legend-item"><span class="dot seg-tools"></span> Tools</div>
                </div>
            </div>
        </header>

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
			case "read":
				return "👁️";
			case "write":
				return "📝";
			case "edit":
				return "✍️";
			case "delete":
				return "🗑️";
			default:
				return "📄";
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
