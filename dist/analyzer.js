"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextAnalyzer = void 0;
/**
 * ContextAnalyzer
 * Parses Pi session messages to identify the active working set of files,
 * their token weights, and their temporal status.
 *
 * Pi message format (from @mariozechner/pi-ai):
 *   UserMessage:       { role: "user", content: string | (TextContent | ImageContent)[] }
 *   AssistantMessage:  { role: "assistant", content: (TextContent | ThinkingContent | ToolCall)[] }
 *   ToolResultMessage: { role: "toolResult", toolCallId, toolName, content: (TextContent | ImageContent)[] }
 *
 * ToolCall:           { type: "toolCall", id, name, arguments }
 * ToolCall.id maps to ToolResultMessage.toolCallId
 */
const token_counter_1 = require("./token-counter");
class ContextAnalyzer {
    analyzeByType(messages, currentTurn, systemPrompt) {
        const fileRegistry = new Map();
        let systemTokens = 0;
        let toolTokens = 0;
        let historyTokens = 0;
        let fileTokens = 0;
        let summaryTokens = 0;
        // Count system prompt tokens if provided
        if (systemPrompt && systemPrompt.length > 0) {
            systemTokens += token_counter_1.TokenCounter.count(systemPrompt);
        }
        for (let index = 0; index < messages.length; index++) {
            const msg = messages[index];
            const turn = index + 1;
            const role = msg.role || "";
            // 1. Compaction summaries (Pi compaction entries)
            if (role === "compaction" ||
                msg.type === "compaction" ||
                msg.customType === "compaction" ||
                msg.compactionEntry) {
                summaryTokens += token_counter_1.TokenCounter.countMessage(msg);
                continue;
            }
            // 2. Tool results (Pi uses role="toolResult")
            if (role === "toolResult") {
                toolTokens += token_counter_1.TokenCounter.countMessage(msg);
                // Track file content from tool results
                const toolName = msg.toolName || "";
                if (toolName === "read" ||
                    toolName === "write" ||
                    toolName === "edit") {
                    const content = msg.content;
                    const path = this.extractPathFromToolResult(content);
                    if (path) {
                        const w = token_counter_1.TokenCounter.countMessage(msg);
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
                                status: this.calculateStatus(turn, currentTurn),
                            });
                        }
                    }
                }
                continue;
            }
            // 3. User messages
            if (role === "user") {
                historyTokens += token_counter_1.TokenCounter.countMessage(msg);
                // Track file attachments (images, file paths in text)
                if (Array.isArray(msg.content)) {
                    for (const block of msg.content) {
                        if (block.type === "image") {
                            const p = "[image]";
                            const w = token_counter_1.TokenCounter.count(JSON.stringify(block));
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
                            const matches = block.text.match(/(?:\/|[A-Z]:\\)[\w./\\-]+\.\w+/g);
                            if (matches) {
                                for (const m of matches) {
                                    if (!fileRegistry.has(m)) {
                                        fileRegistry.set(m, {
                                            path: m,
                                            weight: token_counter_1.TokenCounter.count(m),
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
            // 4. Assistant messages — track toolCall blocks
            if (role === "assistant") {
                historyTokens += token_counter_1.TokenCounter.countMessage(msg);
                if (Array.isArray(msg.content)) {
                    for (const block of msg.content) {
                        // Pi uses type="toolCall" with id, name, arguments
                        if (block.type === "toolCall") {
                            const p = this.extractPath(block.name, block.arguments);
                            if (p) {
                                const opType = this.getOpType(block.name);
                                const result = this.findToolResult(messages, index, block.id);
                                const content = result?.content || "";
                                const w = token_counter_1.TokenCounter.count(String(JSON.stringify(content)));
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
            // 5. Everything else
            historyTokens += token_counter_1.TokenCounter.countMessage(msg);
        }
        const totalTokens = systemTokens + toolTokens + historyTokens + fileTokens + summaryTokens;
        const mk = (tokens) => ({
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
    analyze(messages, currentTurn) {
        return this.analyzeByType(messages, currentTurn);
    }
    extractPath(toolName, args) {
        if (!args || typeof args !== "object")
            return null;
        if (toolName === "read" || toolName === "write" || toolName === "edit") {
            return typeof args.path === "string" ? args.path : null;
        }
        if (toolName === "bash") {
            const match = args.command?.match(/(?:cat|ls|rm|mv|cp|vi|nano)\s+([^\s;]+)/);
            return match ? match[1] : null;
        }
        return null;
    }
    extractPathFromToolResult(content) {
        if (typeof content === "string")
            return null;
        if (Array.isArray(content)) {
            for (const block of content) {
                if (block.type === "text" && typeof block.text === "string") {
                    const match = block.text.match(/(?:\/|[A-Z]:\\)[\w./\\-]+\.\w+/);
                    if (match)
                        return match[0];
                }
            }
        }
        return null;
    }
    getOpType(toolName) {
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
    calculateStatus(turn, currentTurn) {
        const diff = currentTurn - turn;
        if (diff <= 3)
            return "active";
        if (diff <= 10)
            return "stale";
        return "legacy";
    }
    findToolResult(messages, toolTurnIndex, toolId) {
        for (let i = toolTurnIndex + 1; i < messages.length; i++) {
            const m = messages[i];
            // Pi uses role="toolResult" and toolCallId (not tool_call_id)
            if (m.role === "toolResult" && m.toolCallId === toolId) {
                return m;
            }
            if (m.role === "assistant")
                break;
        }
        return null;
    }
}
exports.ContextAnalyzer = ContextAnalyzer;
