/**
 * pi-context-map
 * Professional Context Profiler for Pi.
 * v0.4.0 - Adds live localhost server with auto-updates.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ContextAnalyzer } from "./analyzer";
import { ReportGenerator } from "./generator";
import { InsightEngine } from "./insights";
import { LiveReportServer } from "./live-server";
import * as path from "node:path";
import * as os from "node:os";

const REPORT_PATH = path.join(os.homedir(), ".pi", "context-map", "report.html");

export default async function piContextMap(pi: ExtensionAPI) {
	const analyzer = new ContextAnalyzer();
	const liveServer = new LiveReportServer();

	async function runAnalysis() {
		const messages = (pi as any).session?.messages || [];
		const currentTurn = messages.length;
		const composition = analyzer.analyzeByType(messages, currentTurn);
		const insights = InsightEngine.generate(composition);
		const html = ReportGenerator.generateHTML(composition, insights);

		// Write to disk (for offline access / persistence)
		try {
			const fs = await import("node:fs");
			const dir = path.dirname(REPORT_PATH);
			if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(REPORT_PATH, html, "utf8");
		} catch (err: any) {
			console.error(`[pi-context-map] Failed to write report to disk: ${err.message}`);
		}

		// Push to live server (if running) so the browser updates instantly
		if (liveServer.isRunning) {
			liveServer.update(html, REPORT_PATH);
		}

		return { composition, insights, reportPath: REPORT_PATH };
	}

	// Start the live server on load
	const serverUrl = await liveServer.start();

	pi.registerCommand("context-map", {
		description: "Generate a visual context map with actionable insights. Use 'stop' to terminate the live server.",
		handler: async (args: any, ctx: any) => {
			// Handle subcommand: /context-map stop
			if (typeof args === "string" && args.trim().toLowerCase() === "stop") {
				liveServer.stop();
				ctx.ui.notify("Live server stopped.", "info");
				return;
			}

			ctx.ui.notify("Analyzing session context...", "info");
			try {
				const { insights, reportPath } = await runAnalysis();
				const criticalCount = insights.filter((i: any) => i.severity === "critical").length;
				const summary = criticalCount > 0
					? `Context map generated. ${criticalCount} critical insight(s) found.`
					: `Context map generated successfully.`;

				let details = `File: ${reportPath}`;
				if (serverUrl) {
					details += ` Live: ${serverUrl}`;
				}
				ctx.ui.notify(`${summary} ${details}`, criticalCount > 0 ? "warning" : "success");
			} catch (error: any) {
				ctx.ui.notify(`Failed to generate context map: ${error.message}`, "error");
			}
		},
	});

	pi.registerTool({
		name: "context-map",
		description:
			"Analyze the current session context composition and return actionable insights. The live localhost report will auto-update.",
		parameters: {
			type: "object",
			properties: {},
		},
		handler: async (_ctx: any, _args: any) => {
			try {
				const { composition, insights } = await runAnalysis();
				const summary =
					`Context: ${composition.total.tokens.toLocaleString()} tokens total. ` +
					`System ${composition.system.percent}%, Tools ${composition.tools.percent}%, ` +
					`History ${composition.history.percent}%, Files ${composition.files.percent}%, ` +
					`Summaries ${composition.summaries.percent}%. ` +
					`${insights.length} insight(s) generated.`;
				return {
					summary,
					composition: {
						system: composition.system.tokens,
						tools: composition.tools.tokens,
						history: composition.history.tokens,
						files: composition.files.tokens,
						summaries: composition.summaries.tokens,
						total: composition.total.tokens,
					},
					insights: insights.map((i: any) => ({
						severity: i.severity,
						title: i.title,
						message: i.message,
						command: i.command,
					})),
					liveUrl: serverUrl,
					reportPath: REPORT_PATH,
				};
			} catch (error: any) {
				return { error: error.message };
			}
		},
	});

	pi.on("session_before_compact", (event: any, ctx: any) => {
		const tokens = event?.preparation?.tokensBefore;
		if (tokens && tokens > 100_000) {
			ctx.ui.notify(
				`High context load detected (${(tokens / 1000).toFixed(1)}k tokens). Try /context-map to see what's consuming space.`,
				"info",
			);
		}
	});

	// Auto-refresh: re-run analysis after each assistant message so the live view stays current
	pi.on("message_end", async (event: any) => {
		if (event?.message?.role === "assistant" && liveServer.isRunning) {
			try {
				await runAnalysis();
			} catch {
				// Silently ignore auto-refresh failures
			}
		}
	});

	// Graceful shutdown: stop the live server when the session ends
	pi.on("session_shutdown", () => {
		liveServer.stop();
	});

	// Log the live URL once on startup
	if (serverUrl) {
		console.log(`[pi-context-map] Live server running at ${serverUrl}`);
		console.log(`[pi-context-map] Run /context-map to generate a report, or /context-map stop to terminate.`);
	}
}
