/**
 * pi-context-map
 * Professional Context Profiler for Pi.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ContextAnalyzer } from "./analyzer";
import { ReportGenerator } from "./generator";
import { InsightEngine } from "./insights";

export default async function piContextMap(pi: ExtensionAPI) {
	const analyzer = new ContextAnalyzer();

	async function runAnalysis() {
		const messages = (pi as any).session?.messages || [];
		const currentTurn = messages.length;
		const composition = analyzer.analyzeByType(messages, currentTurn);
		const insights = InsightEngine.generate(composition);
		const html = ReportGenerator.generateHTML(composition, insights);
		const reportPath = ReportGenerator.writeReport(html);
		return { composition, insights, reportPath };
	}

	pi.registerCommand("context-map", {
		description: "Generate a visual context map with actionable insights.",
		handler: async (_args: any, ctx: any) => {
			ctx.ui.notify("Analyzing session context...", "info");
			try {
				const { reportPath, insights } = await runAnalysis();
				const criticalCount = insights.filter(
					(i) => i.severity === "critical",
				).length;
				const summary =
					criticalCount > 0
						? `Context map generated. ${criticalCount} critical insight(s) found.`
						: `Context map generated successfully.`;
				ctx.ui.notify(
					`${summary} Path: ${reportPath}`,
					criticalCount > 0 ? "warning" : "success",
				);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				ctx.ui.notify(`Failed to generate context map: ${message}`, "error");
			}
		},
	});

	pi.registerTool({
		name: "context-map",
		description:
			"Analyze the current session context composition and return actionable insights.",
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
					insights: insights.map((i) => ({
						severity: i.severity,
						title: i.title,
						message: i.message,
						command: i.command,
					})),
				};
			} catch (error: any) {
				return { error: error.message };
			}
		},
	});

	pi.on("session_before_compact", (event: any, ctx: any) => {
		const tokens = (event as any).preparation?.tokensBefore;
		if (tokens && tokens > 100_000) {
			ctx.ui.notify(
				`High context load detected (${(tokens / 1000).toFixed(1)}k tokens). Try /context-map to see what's consuming space.`,
				"info",
			);
		}
	});
}
