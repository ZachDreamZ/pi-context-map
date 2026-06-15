/**
 * pi-context-map
 * Professional Context Profiler for Pi.
 * v0.4.1 — Fixes session.messages crash, tool registration signature, adds tests.
 */

import type {
	ExtensionAPI,
	ExtensionCommandContext,
	AgentMessage,
} from "pi-coding-agent";
import { ContextAnalyzer } from "./analyzer";
import { ReportGenerator } from "./generator";
import { InsightEngine } from "./insights";
import { LiveReportServer } from "./live-server";
import * as path from "node:path";
import * as os from "node:os";

const REPORT_PATH = path.join(
	os.homedir(),
	".pi",
	"context-map",
	"report.html",
);

export default async function piContextMap(pi: ExtensionAPI): Promise<void> {
	const analyzer = new ContextAnalyzer();
	const liveServer = new LiveReportServer();

	// Accumulate messages from events — this is the correct way to access
	// session messages in Pi. (pi as any).session?.messages does NOT exist.
	let sessionMessages: AgentMessage[] = [];
	let currentTurn = 0;

	// Capture messages before each LLM call
	pi.on("context", (event: any) => {
		if (event?.messages && Array.isArray(event.messages)) {
			sessionMessages = event.messages;
		}
	});

	// Track turns
	pi.on("turn_start", () => {
		currentTurn++;
	});

	async function runAnalysis(): Promise<{
		composition: ReturnType<typeof analyzer.analyzeByType>;
		insights: ReturnType<typeof InsightEngine.generate>;
		reportPath: string;
	}> {
		const messages = sessionMessages.length > 0 ? sessionMessages : [];
		const composition = analyzer.analyzeByType(messages, currentTurn);
		const insights = InsightEngine.generate(composition);
		const html = ReportGenerator.generateHTML(composition, insights);

		// Write to disk
		try {
			const fs = await import("node:fs");
			const dir = path.dirname(REPORT_PATH);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(REPORT_PATH, html, "utf8");
		} catch (err: any) {
			console.error(`[pi-context-map] Failed to write report: ${err.message}`);
		}

		// Push to live server if running
		if (liveServer.isRunning) {
			liveServer.update(html, REPORT_PATH);
		}

		return { composition, insights, reportPath: REPORT_PATH };
	}

	// Start live server
	const serverUrl = await liveServer.start();

	// Register /context-map command
	pi.registerCommand("context-map", {
		description:
			"Generate a visual context map with actionable insights. Use 'stop' to terminate the live server.",
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			if (args.trim().toLowerCase() === "stop") {
				liveServer.stop();
				ctx.ui.notify("Live server stopped.", "info");
				return;
			}

			ctx.ui.notify("Analyzing session context...", "info");
			try {
				const { insights, reportPath } = await runAnalysis();
				const criticalCount = insights.filter(
					(i) => i.severity === "critical",
				).length;
				const summary =
					criticalCount > 0
						? `Context map generated. ${criticalCount} critical insight(s) found.`
						: "Context map generated successfully.";
				let details = `File: ${reportPath}`;
				if (serverUrl) {
					details += ` | Live: ${serverUrl}`;
				}
				ctx.ui.notify(
					`${summary} ${details}`,
					criticalCount > 0 ? "warning" : "success",
				);
			} catch (error: any) {
				ctx.ui.notify(
					`Failed to generate context map: ${error.message}`,
					"error",
				);
			}
		},
	});

	// Register the tool for agent use
	pi.registerTool({
		name: "context-map",
		label: "Context Map",
		description:
			"Analyze the current session context composition and return actionable insights. The live localhost report will auto-update.",
		parameters: {
			type: "object",
			properties: {},
		},
		async execute(
			_params: any,
			_signal: AbortSignal | undefined,
			_onUpdate: ((u: any) => void) | undefined,
			_ctx: any,
		) {
			try {
				const { composition, insights } = await runAnalysis();
				const usagePercent =
					composition.total.tokens > 0
						? Math.round((composition.total.tokens / 128_000) * 100)
						: 0;
				const summary =
					`Context: ${composition.total.tokens.toLocaleString()} tokens total. ` +
					`System ${composition.system.percent}%, Tools ${composition.tools.percent}%, ` +
					`History ${composition.history.percent}%, Files ${composition.files.percent}%, ` +
					`Summaries ${composition.summaries.percent}%. ` +
					`Usage: ${usagePercent}% of typical 128k window. ` +
					`${insights.length} insight(s) generated.`;
				return {
					type: "text" as const,
					content: [
						summary,
						"",
						...insights.map(
							(i) => `[${i.severity.toUpperCase()}] ${i.title}: ${i.message}`,
						),
						serverUrl ? `Live report: ${serverUrl}` : "",
					]
						.filter(Boolean)
						.join("\n"),
				};
			} catch (error: any) {
				return {
					type: "text" as const,
					content: `Error: ${error.message}`,
					isError: true,
				};
			}
		},
	});

	// Auto-warning on high context before compaction
	pi.on("session_before_compact", (_event: any, ctx: any) => {
		const tokens = _event?.preparation?.tokensBefore;
		if (tokens && tokens > 100_000) {
			ctx.ui.notify(
				`High context load detected (${(tokens / 1000).toFixed(1)}k tokens). Try /context-map to see what's consuming space.`,
				"info",
			);
		}
	});

	// Auto-refresh after each assistant message if server is running
	pi.on("message_end", async (_event: any) => {
		if (_event?.message?.role === "assistant" && liveServer.isRunning) {
			try {
				await runAnalysis();
			} catch {
				// Silently ignore auto-refresh failures
			}
		}
	});

	// Graceful shutdown
	pi.on("session_shutdown", () => {
		liveServer.stop();
	});

	if (serverUrl) {
		console.log(`[pi-context-map] Live server running at ${serverUrl}`);
		console.log(
			`[pi-context-map] Run /context-map to generate a report, or /context-map stop to terminate.`,
		);
	}
}
