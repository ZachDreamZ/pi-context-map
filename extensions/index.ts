/**
 * pi-context-map
 * Professional Context Profiler for Pi.
 * v0.7.0 — Fixed token accuracy (uses Pi's actual count), compactionSummary detection,
 *          auto-open browser, position-based file status, error cleanup.
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
import { exec } from "node:child_process";

function makeReportPath(sessionName?: string): string {
	const dir = path.join(os.homedir(), ".pi", "context-map");
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	const now = new Date();
	const date = now.toISOString().split("T")[0];
	const time = now.toTimeString().split(" ")[0].replace(/:/g, "-");
	const safe = (sessionName || "session").replace(/[^\w.-]/g, "_").slice(0, 40);
	const filename = `${date}_${time}_${safe}.html`;
	return path.join(dir, filename);
}

function openBrowser(url: string): void {
	const platform = process.platform;
	try {
		if (platform === "win32") {
			// Use cmd /c start with separate title arg to handle URLs with special chars
			exec(`cmd /c start "" "${url}"`, (err) => {
				if (err) {
					// Fallback: try explorer directly
					exec(`explorer "${url}"`);
				}
			});
		} else if (platform === "darwin") {
			exec(`open "${url}"`);
		} else {
			exec(`xdg-open "${url}"`);
		}
	} catch {
		// Silent — browser open is best-effort
	}
}

export default async function piContextMap(pi: ExtensionAPI): Promise<void> {
	const analyzer = new ContextAnalyzer();
	const liveServer = new LiveReportServer();

	let sessionMessages: AgentMessage[] = [];
	let currentTurn = 0;
	let contextWindow = 128_000;
	let actualTokens: number | null = null;
	let actualPercent: number | null = null;
	let systemPrompt = "";
	let currentReportPath = makeReportPath();
	let isFirstRun = true;

	// Capture messages, context window, system prompt, and actual token count from Pi
	pi.on("context", (event: any, ctx: any) => {
		if (event?.messages && Array.isArray(event.messages)) {
			sessionMessages = event.messages;
		}
		try {
			const usage = ctx?.getContextUsage?.();
			if (usage) {
				if (usage.contextWindow && usage.contextWindow > 0) {
					contextWindow = usage.contextWindow;
				}
				// Use Pi's actual token count — this is the real value
				if (usage.tokens != null && usage.tokens > 0) {
					actualTokens = usage.tokens;
				}
				if (usage.percent != null && usage.percent > 0) {
					actualPercent = usage.percent;
				}
			}
		} catch {
			// Keep fallback
		}
		// Get system prompt from Pi
		try {
			const sp = ctx?.getSystemPrompt?.();
			if (sp && typeof sp === "string") {
				systemPrompt = sp;
			}
		} catch {
			// Keep empty
		}
	});

	pi.on("turn_start", () => {
		currentTurn++;
	});

	// Update report path when session changes
	pi.on("session_start", () => {
		currentReportPath = makeReportPath();
		isFirstRun = true;
	});

	// Persist messages on compaction so they survive reload
	pi.on("session_compact", (event: any) => {
		if (event?.compactionEntry) {
			try {
				pi.appendEntry("context-map-snapshot", {
					messages: sessionMessages.slice(-50),
					turn: currentTurn,
					timestamp: Date.now(),
				});
			} catch {
				// Ignore persistence errors
			}
		}
	});

	async function runAnalysis(): Promise<{
		composition: ReturnType<typeof analyzer.analyzeByType>;
		insights: ReturnType<typeof InsightEngine.generate>;
		reportPath: string;
	}> {
		const messages = sessionMessages.length > 0 ? sessionMessages : [];
		const composition = analyzer.analyzeByType(
			messages,
			currentTurn,
			systemPrompt,
		);

		// Override with Pi's actual token count when available
		if (actualTokens != null && actualTokens > 0) {
			composition.actualTokens = actualTokens;
			composition.actualPercent = actualPercent;
			// Recalculate percentages relative to actual total
			const total = actualTokens;
			if (total > 0) {
				composition.system.percent = Math.round(
					(composition.system.tokens / total) * 100,
				);
				composition.tools.percent = Math.round(
					(composition.tools.tokens / total) * 100,
				);
				composition.history.percent = Math.round(
					(composition.history.tokens / total) * 100,
				);
				composition.files.percent = Math.round(
					(composition.files.tokens / total) * 100,
				);
				composition.summaries.percent = Math.round(
					(composition.summaries.tokens / total) * 100,
				);
				// Use Pi's actual total for the usage calculation
				composition.total.tokens = total;
			}
		}

		const insights = InsightEngine.generate(composition, contextWindow);
		const html = ReportGenerator.generateHTML(
			composition,
			insights,
			contextWindow,
			actualTokens,
		);

		try {
			const dir = path.dirname(currentReportPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(currentReportPath, html, "utf8");
		} catch (err: any) {
			// Silent — don't spam console
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
				const { composition, insights } = await runAnalysis();
				const criticalCount = insights.filter(
					(i) => i.severity === "critical",
				).length;
				const summary =
					criticalCount > 0
						? `Context map generated. ${criticalCount} critical insight(s) found.`
						: "Context map generated successfully.";

				// Use Pi's actual percentage when available
				const usageDisplay =
					actualPercent != null
						? `${actualPercent.toFixed(1)}%`
						: `${composition.total.percent}%`;

				let details = `Usage: ${usageDisplay} of ${(contextWindow / 1000).toFixed(0)}k`;
				if (serverUrl) {
					details += ` | ${serverUrl}`;
				}
				ctx.ui.notify(
					`${summary} ${details}`,
					criticalCount > 0 ? "warning" : "success",
				);

				// Auto-open browser on first run
				if (isFirstRun && serverUrl) {
					openBrowser(serverUrl);
					isFirstRun = false;
				}
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
			"Analyze the current session context composition and return actionable insights.",
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
					actualPercent != null
						? actualPercent
						: composition.total.tokens > 0
							? Math.round((composition.total.tokens / contextWindow) * 100)
							: 0;
				const summary =
					`Context: ${composition.total.tokens.toLocaleString()} tokens (${usagePercent.toFixed(1)}% of ${(contextWindow / 1000).toFixed(0)}k). ` +
					`System ${composition.system.percent}%, Tools ${composition.tools.percent}%, ` +
					`History ${composition.history.percent}%, Files ${composition.files.percent}%, ` +
					`Summaries ${composition.summaries.percent}%. ` +
					`Messages: ${sessionMessages.length}. ` +
					`${insights.length} insight(s).`;
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

	let lastAnalysisTime = 0;
	const ANALYSIS_THROTTLE_MS = 5000; // Don't run analysis more than once per 5 seconds

	pi.on("message_end", async (_event: any) => {
		if (_event?.message?.role === "assistant" && liveServer.isRunning) {
			const now = Date.now();
			if (now - lastAnalysisTime < ANALYSIS_THROTTLE_MS) return;
			lastAnalysisTime = now;
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

	process.on("SIGINT", () => {
		liveServer.stop();
	});
	process.on("SIGTERM", () => {
		liveServer.stop();
	});
}
