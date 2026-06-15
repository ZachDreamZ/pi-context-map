/**
 * InsightEngine
 * Generates actionable recommendations based on the ContextComposition.
 */
import type { ContextComposition } from "./analyzer";

export type InsightSeverity = "info" | "warning" | "critical";

export interface Insight {
	id: string;
	severity: InsightSeverity;
	title: string;
	message: string;
	command?: string; // Suggested slash command
}

export class InsightEngine {
	/**
	 * Generate a list of insights based on the composition.
	 */
	public static generate(
		composition: ContextComposition,
		contextWindow?: number,
	): Insight[] {
		const insights: Insight[] = [];
		const { system, tools, files, summaries, total } = composition;
		const windowSize = contextWindow || 128_000;

		// Rule 1: Tool bloat
		if (tools.percent > 40) {
			insights.push({
				id: "tool-bloat",
				severity: "warning",
				title: "Tool results dominate context",
				message: `Tool results account for ${tools.percent}% of your context (${tools.tokens.toLocaleString()} tokens). Consider compacting or trimming verbose tool outputs.`,
				command: "/ultra-compact",
			});
		}

		// Rule 2: Stale files
		const staleFiles = composition.files_detail.filter(
			(f) => f.status === "legacy",
		);
		if (staleFiles.length > 0) {
			const totalStaleTokens = staleFiles.reduce((sum, f) => sum + f.weight, 0);
			insights.push({
				id: "stale-files",
				severity: staleFiles.length > 5 ? "warning" : "info",
				title: `${staleFiles.length} stale file(s) in context`,
				message: `Files accessed more than 10 turns ago are still in context (~${totalStaleTokens.toLocaleString()} tokens). They are unlikely to be needed.`,
			});
		}

		// Rule 3: High overall usage
		const usagePercent = Math.round((total.tokens / windowSize) * 100);
		if (usagePercent > 80) {
			insights.push({
				id: "high-usage",
				severity: "critical",
				title: "Context window nearly full",
				message: `You are at ${usagePercent}% of a typical 128k context window. Compaction or summarization is strongly recommended.`,
				command: "/ultra-compact",
			});
		} else if (usagePercent > 60) {
			insights.push({
				id: "moderate-usage",
				severity: "warning",
				title: "Context usage is high",
				message: `You are at ${usagePercent}% of a typical 128k context window. Plan to compact before adding more files.`,
			});
		}

		// Rule 4: File-heavy context
		if (files.percent > 30) {
			insights.push({
				id: "file-heavy",
				severity: "info",
				title: "Many files loaded",
				message: `Files account for ${files.percent}% of context (${files.tokens.toLocaleString()} tokens). Consider using smart-read to load only the relevant symbols.`,
				command: "/smart-read",
			});
		}

		// Rule 5: Compaction summaries present
		if (summaries.tokens > 0) {
			insights.push({
				id: "summaries-present",
				severity: "info",
				title: "Compaction summaries detected",
				message: `${summaries.tokens.toLocaleString()} tokens are from prior compaction summaries. Original detail has been compressed.`,
			});
		}

		// Rule 6: System prompt overhead
		if (system.percent > 25) {
			insights.push({
				id: "system-overhead",
				severity: "info",
				title: "Large system prompt",
				message: `System prompt uses ${system.percent}% of context. This is normal for agents with extensive tool definitions.`,
			});
		}

		// If everything looks good, add a positive insight
		if (insights.length === 0) {
			insights.push({
				id: "healthy-context",
				severity: "info",
				title: "Context looks healthy",
				message: `Your context composition is balanced and under ${usagePercent}% of a typical window.`,
			});
		}

		return insights;
	}
}
