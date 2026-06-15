/**
 * ContextAnalyzer
 * Parses Pi session messages to identify the active working set of files,
 * their token weights, and their temporal status.
 */
import { TokenCounter } from "./token-counter";

export interface FileOp {
	type: "read" | "write" | "edit" | "delete";
	turn: number;
	timestamp: number;
}

export interface FileContext {
	path: string;
	weight: number;
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

		for (let index = 0; index < messages.length; index++) {
			const msg = messages[index];
			const turn = index + 1;
			const role = msg.role || "";
			const msgType = msg.type || "";

			// 1. Compaction summaries
			if (
				role === "compaction" ||
				msgType === "compaction" ||
				msg.customType === "compaction" ||
				msg.compactionEntry
			) {
				summaryTokens += TokenCounter.countMessage(msg);
				continue;
			}

			// 2. System messages
			if (role === "system" || msgType === "system") {
				systemTokens += TokenCounter.countMessage(msg);
				continue;
			}

			// 3. Tool results (Pi uses "toolResult")
			if (role === "toolResult" || role === "tool") {
				toolTokens += TokenCounter.countMessage(msg);
				continue;
			}

			// 4. User messages — track file attachments
			if (role === "user") {
				historyTokens += TokenCounter.countMessage(msg);
				if (Array.isArray(msg.content)) {
					for (const block of msg.content) {
						if (block.type === "image" || block.type === "image_url") {
							const p = block.source?.url || block.image_url?.url || "[image]";
							const w = TokenCounter.count(JSON.stringify(block));
							fileTokens += w;
							if (!fileRegistry.has(p)) {
								fileRegistry.set(p, {
									path: p,
									weight: w,
									lastOp: {
										type: "read",
										turn,
										timestamp: msg.timestamp || Date.now(),
									},
									status: this.calculateStatus(turn, currentTurn),
								});
							}
						}
						if (block.type === "text" && typeof block.text === "string") {
							const matches = block.text.match(
								/(?:\/|[A-Z]:\\)[\w./\\-]+\.\w+/g,
							);
							if (matches) {
								for (const m of matches) {
									if (!fileRegistry.has(m)) {
										fileRegistry.set(m, {
											path: m,
											weight: TokenCounter.count(m),
											lastOp: {
												type: "read",
												turn,
												timestamp: msg.timestamp || Date.now(),
											},
											status: this.calculateStatus(turn, currentTurn),
										});
									}
								}
							}
						}
					}
				}
				continue;
			}

			// 5. Assistant messages — track tool_use blocks
			if (role === "assistant") {
				historyTokens += TokenCounter.countMessage(msg);
				if (Array.isArray(msg.content)) {
					for (const block of msg.content) {
						if (block.type === "tool_use") {
							const input = block.input as Record<string, any>;
							const p = this.extractPath(block.name, input);
							if (p) {
								const opType = this.getOpType(block.name);
								const result = this.findToolResult(messages, index, block.id);
								const content = result?.content || "";
								const w = TokenCounter.count(String(content));
								fileTokens += w;
								fileRegistry.set(p, {
									path: p,
									weight: w,
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
				continue;
			}

			// 6. Everything else
			historyTokens += TokenCounter.countMessage(msg);
		}

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
			if (
				messages[i].role === "toolResult" &&
				messages[i].tool_call_id === toolId
			) {
				return messages[i];
			}
			if (messages[i].role === "assistant") break;
		}
		return null;
	}
}
