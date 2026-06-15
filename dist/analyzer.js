"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextAnalyzer = void 0;
/**
 * ContextAnalyzer
 * Parses Pi session messages to identify the active working set of files,
 * their token weights, and their temporal status.
 */
const token_counter_1 = require("./token-counter");
class ContextAnalyzer {
    analyzeByType(messages, currentTurn) {
        const fileRegistry = new Map();
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
            if (role === "compaction" ||
                msgType === "compaction" ||
                msg.customType === "compaction" ||
                msg.compactionEntry) {
                summaryTokens += token_counter_1.TokenCounter.countMessage(msg);
                continue;
            }
            // 2. System messages
            if (role === "system" || msgType === "system") {
                systemTokens += token_counter_1.TokenCounter.countMessage(msg);
                continue;
            }
            // 3. Tool results (Pi uses "toolResult")
            if (role === "toolResult" || role === "tool") {
                toolTokens += token_counter_1.TokenCounter.countMessage(msg);
                continue;
            }
            // 4. User messages — track file attachments
            if (role === "user") {
                historyTokens += token_counter_1.TokenCounter.countMessage(msg);
                if (Array.isArray(msg.content)) {
                    for (const block of msg.content) {
                        if (block.type === "image" || block.type === "image_url") {
                            const p = block.source?.url || block.image_url?.url || "[image]";
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
            // 5. Assistant messages — track tool_use blocks
            if (role === "assistant") {
                historyTokens += token_counter_1.TokenCounter.countMessage(msg);
                if (Array.isArray(msg.content)) {
                    for (const block of msg.content) {
                        if (block.type === "tool_use") {
                            const input = block.input;
                            const p = this.extractPath(block.name, input);
                            if (p) {
                                const opType = this.getOpType(block.name);
                                const result = this.findToolResult(messages, index, block.id);
                                const content = result?.content || "";
                                const w = token_counter_1.TokenCounter.count(String(content));
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
    extractPath(toolName, input) {
        if (toolName === "read" || toolName === "write" || toolName === "edit") {
            return typeof input.path === "string" ? input.path : null;
        }
        if (toolName === "bash") {
            const match = input.command?.match(/(?:cat|ls|rm|mv|cp|vi|nano)\s+([^\s;]+)/);
            return match ? match[1] : null;
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
            if (messages[i].role === "toolResult" &&
                messages[i].tool_call_id === toolId) {
                return messages[i];
            }
            if (messages[i].role === "assistant")
                break;
        }
        return null;
    }
}
exports.ContextAnalyzer = ContextAnalyzer;
