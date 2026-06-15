/**
 * pi-context-map
 * Professional Context Profiler for Pi.
 * v0.5.1 — Dynamic context window, dark mode, session-unique reports.
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
import * as fs from "node:fs";
import * as os from "node:os";

function makeReportPath(sessionName?: string): string {
	const dir = path.join(os.homedir(), ".pi", "context-map");
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	const now = new Date();
	const date = now.toISOString().split("T")[0];
	const time = now.toTimeString().split(" ")[0].replace(/:/g, "-");
	const safe = (sessionName || "session")
		.replace(/[^\w.-]/g, "_")
		.slice(0, 40);
	const filename = `${date}_${time}_${safe}.html`;
	return path.join(dir, filename);
}

export default async function piContextMap(pi: ExtensionAPI): Promise<void> {
	const analyzer = new ContextAnalyzer();
	const liveServer = new LiveReportServer();

	let sessionMessages: AgentMessage[] = [];
	let currentTurn = 0;
	let contextWindow = 128_000;
	let currentReportPath = makeReportPath();

	// Capture messages and context window from Pi system
	pi.on("context", (event: any, ctx: any) => {
		if (event?.messages && Array.isArray(event.messages)) {
			sessionMessages = event.messages;
		}
		try {
			const usage = ctx?.getContextUsage?.();
			if (usage?.contextWindow && usage.contextWindow > 0) {
				contextWindow = usage.contextWindow;
			}
		} catch {
			// Keep fallback
		}
	});

	pi.on("turn_start", () => {
		currentTurn++;
	});

	// Update report path when session changes
	pi.on("session_start", () => {
		currentReportPath = makeReportPath();
	});

	async function runAnalysis(): Promise<{
		composition: ReturnType<typeof analyzer.analyzeByType>;
		insights: ReturnType<typeof InsightEngine.generate>;
		reportPath: string;
	}> {
		const messages = sessionMessages.length > 0 ? sessionMessages : [];
		const composition = analyzer.analyzeByType(messages, currentTurn);
		const insights = InsightEngine.generate(composition);
		const html = ReportGenerator.generateHTML(
			composition,
			insights,
			contextWindow,
		);

		try {
			const dir = path.dirname(currentReportPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(currentReportPath, html, "utf8");
		} catch (err: any) {
			console.error(`[pi-context-map] Failed to write report: ${err.message}`);
		}

		if (liveServer.isRunning) {
			liveServer.update(html, currentReportPath);
		}

		return { composition, insights, reportPath: currentReportPath };
	}

	const serverUrl = await liveServer.start();

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
				const { composition, insights, reportPath } = await runAnalysis();
				const usagePercent =
					composition.total.tokens > 0
						? Math.round((composition.total.tokens / contextWindow) * 100)
						: 0;
				const summary =
					`Context: ${composition.total.tokens.toLocaleString()} tokens total. ` +
					`System ${composition.system.percent}%, Tools ${composition.tools.percent}%, ` +
					`History ${composition.history.percent}%, Files ${composition.files.percent}%, ` +
					`Summaries ${composition.summaries.percent}%. ` +
					`Usage: ${usagePercent}% of ${(contextWindow / 1000).toFixed(0)}k window. ` +
					`${insights.length} insight(s) generated.`;
				return {
					type: "text" as const,
					content: [
						summary,
						"",
						...insights.map(
							(i) => `[${i.severity.toUpperCase()}] ${i.title}: ${i.message}`,
						),
						`Report: ${reportPath}`,
						serverUrl ? `Live: ${serverUrl}` : "",
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

	pi.on("session_before_compact", (_event: any, ctx: any) => {
		const tokens = _event?.preparation?.tokensBefore;
		if (tokens && tokens > 100_000) {
			ctx.ui.notify(
				`High context load (${(tokens / 1000).toFixed(1)}k tokens). Try /context-map to see what's consuming space.`,
				"info",
			);
		}
	});

	pi.on("message_end", async (_event: any) => {
		if (_event?.message?.role === "assistant" && liveServer.isRunning) {
			try {
				await runAnalysis();
			} catch {
				// Ignore auto-refresh failures
			}
		}
	});

	pi.on("session_shutdown", () => {
		liveServer.stop();
	});

	process.on("exit", () => liveServer.stop());
	process.on("SIGINT", () => {
		liveServer.stop();
		process.exit(0);
	});
	process.on("SIGTERM", () => {
		liveServer.stop();
		process.exit(0);
	});
}
