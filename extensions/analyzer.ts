/**
 * ContextAnalyzer
 * Responsible for parsing Pi session messages to identify the active working set of files,
 * their token weights, and their temporal status. Uses the code-aware TokenCounter.
 */
import { TokenCounter } from "./token-counter";

export interface FileOp {
	type: "read" | "write" | "edit" | "delete";
	turn: number;
	timestamp: number;
}

export interface FileContext {
	path: string;
	weight: number; // Estimated tokens
	lastOp: FileOp;
	status: "active" | "stale" | "legacy";
}

export interface ContextSlice {
	tokens: number;
	percent: number;
}

export interface ContextComposition {
	system: ContextSlice;
	tools: ContextSlice;
	history: ContextSlice;
	files: ContextSlice;
	summaries: ContextSlice;
	total: ContextSlice;
	files_detail: FileContext[];
}

export class ContextAnalyzer {
	/**
	 * Analyze session messages to produce a structured ContextComposition.
	 * @param messages The full session conversation history.
	 * @param currentTurn The current turn number.
	 */
	public analyzeByType(
		messages: any[],
		currentTurn: number,
	): ContextComposition {
		const fileRegistry = new Map<string, FileContext>();

		let systemTokens = 0;
		let toolTokens = 0;
		let historyTokens = 0;
		let fileTokens = 0;
		let summaryTokens = 0;

		messages.forEach((msg, index) => {
			const turn = index + 1;

			// 1. Categorize and count
			if (msg.role === "system") {
				systemTokens += TokenCounter.countMessage(msg);
				return;
			}

			if (msg.role === "tool") {
				toolTokens += TokenCounter.countMessage(msg);
				return;
			}

			// Detect compaction summaries (Pi uses customType or specific role)
			if (
				msg.role === "compaction" ||
				msg.type === "compaction" ||
				msg.compactionEntry
			) {
				summaryTokens += TokenCounter.countMessage(msg);
				return;
			}

			if (msg.role === "user" || msg.role === "assistant") {
				historyTokens += TokenCounter.countMessage(msg);
			} else {
				// Default to history
				historyTokens += TokenCounter.countMessage(msg);
			}

			// 2. File tracking (only on assistant tool_use blocks)
			if (msg.role === "assistant" && Array.isArray(msg.content)) {
				for (const block of msg.content) {
					if (block.type === "tool_use") {
						const input = block.input as Record<string, any>;
						const path = this.extractPath(block.name, input);

						if (path) {
							const opType = this.getOpType(block.name);
							const result = this.findToolResult(messages, index, block.id);
							const content = result?.content || "";
							const weight = TokenCounter.count(String(content));
							fileTokens += weight;

							fileRegistry.set(path, {
								path,
								weight,
								lastOp: {
									type: opType,
									turn,
									timestamp: msg.timestamp || Date.now(),
								},
								status: this.calculateStatus(turn, currentTurn),
							});
						}
					}
				}
			}
		});

		const totalTokens =
			systemTokens + toolTokens + historyTokens + fileTokens + summaryTokens;

		const mk = (tokens: number): ContextSlice => ({
			tokens: Math.ceil(tokens),
			percent: totalTokens > 0 ? Math.round((tokens / totalTokens) * 100) : 0,
		});

		const files_detail = Array.from(fileRegistry.values())
			.sort((a, b) => b.weight - a.weight)
			.slice(0, 100);

		return {
			system: mk(systemTokens),
			tools: mk(toolTokens),
			history: mk(historyTokens),
			files: mk(fileTokens),
			summaries: mk(summaryTokens),
			total: mk(totalTokens),
			files_detail,
		};
	}

	/** Backward-compatible wrapper. */
	public analyze(messages: any[], currentTurn: number): ContextComposition {
		return this.analyzeByType(messages, currentTurn);
	}

	private extractPath(toolName: string, input: any): string | null {
		if (toolName === "read" || toolName === "write" || toolName === "edit") {
			return typeof input.path === "string" ? input.path : null;
		}
		if (toolName === "bash") {
			const match = input.command?.match(
				/(?:cat|ls|rm|mv|cp|vi|nano)\s+([^\s;]+)/,
			);
			return match ? match[1] : null;
		}
		return null;
	}

	private getOpType(toolName: string): FileOp["type"] {
		switch (toolName) {
			case "write":
				return "write";
			case "edit":
				return "edit";
			case "bash":
				return "delete";
			default:
				return "read";
		}
	}

	private calculateStatus(
		turn: number,
		currentTurn: number,
	): FileContext["status"] {
		const diff = currentTurn - turn;
		if (diff <= 3) return "active";
		if (diff <= 10) return "stale";
		return "legacy";
	}

	private findToolResult(
		messages: any[],
		toolTurnIndex: number,
		toolId: string,
	): any {
		for (let i = toolTurnIndex + 1; i < messages.length; i++) {
			if (messages[i].role === "tool" && messages[i].tool_call_id === toolId) {
				return messages[i];
			}
			if (messages[i].role === "assistant") break;
		}
		return null;
	}
}
