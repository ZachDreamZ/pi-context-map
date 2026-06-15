/**
 * ContextAnalyzer
 * Parses Pi session messages to identify the active working set of files,
 * their token weights, and their temporal status.
 *
 * Pi message format (from @mariozechner/pi-ai + pi-coding-agent):
 *   UserMessage:             { role: "user", content: string | (TextContent | ImageContent)[] }
 *   AssistantMessage:        { role: "assistant", content: (TextContent | ThinkingContent | ToolCall)[] }
 *   ToolResultMessage:       { role: "toolResult", toolCallId, toolName, content }
 *   CompactionSummaryMessage:{ role: "compactionSummary", summary: string, tokensBefore: number }
 *   BranchSummaryMessage:    { role: "branchSummary", summary: string }
 *   BashExecutionMessage:    { role: "bashExecution", command, output }
 *   CustomMessage:           { role: "custom", customType, content }
 *
 * ToolCall:           { type: "toolCall", id, name, arguments }
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
	/** Pi's actual token count from ctx.getContextUsage() — may differ from heuristic total */
	actualTokens?: number | null;
	actualPercent?: number | null;
}

export class ContextAnalyzer {
	public analyzeByType(
		messages: any[],
		currentTurn: number,
		systemPrompt?: string,
	): ContextComposition {
		const fileRegistry = new Map<string, FileContext>();

		let systemTokens = 0;
		let toolTokens = 0;
		let historyTokens = 0;
		let fileTokens = 0;
		let summaryTokens = 0;

		// Count system prompt tokens if provided
		if (systemPrompt && systemPrompt.length > 0) {
			systemTokens += TokenCounter.count(systemPrompt);
		}

		// Track message indices for status calculation
		const totalMessages = messages.length;

		for (let index = 0; index < messages.length; index++) {
			const msg = messages[index];
			const turn = index + 1;

			// Normalize role — Pi may use different role strings
			const role = msg.role || "";

			// 1. Compaction summaries (Pi uses role="compactionSummary" with summary field)
			if (
				role === "compactionSummary" ||
				role === "compaction" ||
				msg.type === "compaction" ||
				msg.customType === "compaction" ||
				msg.compactionEntry
			) {
				// Use the summary field if available, otherwise fall back to content
				const summaryText =
					typeof msg.summary === "string"
						? msg.summary
						: typeof msg.content === "string"
							? msg.content
							: JSON.stringify(msg.content || msg);
				summaryTokens += TokenCounter.count(summaryText);
				continue;
			}

			// 2. Branch summaries
			if (role === "branchSummary") {
				const summaryText =
					typeof msg.summary === "string" ? msg.summary : JSON.stringify(msg);
				summaryTokens += TokenCounter.count(summaryText);
				continue;
			}

			// 3. Bash executions
			if (role === "bashExecution") {
				toolTokens += TokenCounter.countMessage(msg);
				continue;
			}

			// 4. Custom messages (extensions)
			if (role === "custom") {
				// Categorize based on customType
				const customType = msg.customType || "";
				if (
					customType.includes("compaction") ||
					customType.includes("summary")
				) {
					summaryTokens += TokenCounter.countMessage(msg);
				} else {
					historyTokens += TokenCounter.countMessage(msg);
				}
				continue;
			}

			// 5. Tool results (Pi uses role="toolResult")
			if (role === "toolResult") {
				toolTokens += TokenCounter.countMessage(msg);
				// Track file content from tool results
				const toolName = msg.toolName || "";
				if (
					toolName === "read" ||
					toolName === "write" ||
					toolName === "edit"
				) {
					const content = msg.content;
					const path = this.extractPathFromToolResult(content);
					if (path) {
						const w = TokenCounter.countMessage(msg);
						fileTokens += w;
						if (!fileRegistry.has(path)) {
							fileRegistry.set(path, {
								path,
								weight: w,
								lastOp: {
									type: this.getOpType(toolName),
									turn,
									timestamp: msg.timestamp || Date.now(),
								},
								status: this.calculateStatus(index, totalMessages),
							});
						}
					}
				}
				continue;
			}

			// 6. User messages
			if (role === "user") {
				historyTokens += TokenCounter.countMessage(msg);
				// Track file attachments (images, file paths in text)
				if (Array.isArray(msg.content)) {
					for (const block of msg.content) {
						if (block.type === "image") {
							const p = "[image]";
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
									status: this.calculateStatus(index, totalMessages),
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
											status: this.calculateStatus(index, totalMessages),
										});
									}
								}
							}
						}
					}
				}
				continue;
			}

			// 7. Assistant messages — track toolCall blocks
			if (role === "assistant") {
				historyTokens += TokenCounter.countMessage(msg);
				if (Array.isArray(msg.content)) {
					for (const block of msg.content) {
						// Pi uses type="toolCall" with id, name, arguments
						if (block.type === "toolCall") {
							const p = this.extractPath(block.name, block.arguments);
							if (p) {
								const opType = this.getOpType(block.name);
								const result = this.findToolResult(messages, index, block.id);
								const content = result?.content || "";
								const w = TokenCounter.count(String(JSON.stringify(content)));
								fileTokens += w;
								fileRegistry.set(p, {
									path: p,
									weight: w,
									lastOp: {
										type: opType,
										turn,
										timestamp: msg.timestamp || Date.now(),
									},
									status: this.calculateStatus(index, totalMessages),
								});
							}
						}
					}
				}
				continue;
			}

			// 8. Everything else
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

	private extractPath(toolName: string, args: any): string | null {
		if (!args || typeof args !== "object") return null;
		if (toolName === "read" || toolName === "write" || toolName === "edit") {
			return typeof args.path === "string" ? args.path : null;
		}
		if (toolName === "bash") {
			const match = args.command?.match(
				/(?:cat|ls|rm|mv|cp|vi|nano)\s+([^\s;]+)/,
			);
			return match ? match[1] : null;
		}
		return null;
	}

	private extractPathFromToolResult(content: any): string | null {
		if (typeof content === "string") return null;
		if (Array.isArray(content)) {
			for (const block of content) {
				if (block.type === "text" && typeof block.text === "string") {
					const match = block.text.match(/(?:\/|[A-Z]:\\)[\w./\\-]+\.\w+/);
					if (match) return match[0];
				}
			}
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

	/**
	 * Calculate file status based on position in message array.
	 * Files near the end are "active", middle are "stale", beginning are "legacy".
	 * This is more reliable than turn-based calculation since the context event
	 * replaces all messages at once.
	 */
	private calculateStatus(
		messageIndex: number,
		totalMessages: number,
	): FileContext["status"] {
		if (totalMessages === 0) return "legacy";
		const ratio = messageIndex / totalMessages;
		if (ratio >= 0.7) return "active";
		if (ratio >= 0.3) return "stale";
		return "legacy";
	}

	private findToolResult(
		messages: any[],
		toolTurnIndex: number,
		toolId: string,
	): any {
		for (let i = toolTurnIndex + 1; i < messages.length; i++) {
			const m = messages[i];
			// Pi uses role="toolResult" and toolCallId (not tool_call_id)
			if (m.role === "toolResult" && m.toolCallId === toolId) {
				return m;
			}
			if (m.role === "assistant") break;
		}
		return null;
	}
}
