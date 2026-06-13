"use strict";
/**
 * ContextAnalyzer
 * Responsible for parsing Pi session messages to identify the active working set of files,
 * their token weights, and their temporal status.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextAnalyzer = void 0;
class ContextAnalyzer {
    /**
     * Heuristic for token estimation: approx 4 chars per token.
     */
    static TOKEN_HEURISTIC = 4;
    /**
     * Analyze session messages to produce a context map.
     * @param messages The full session conversation history.
     * @param currentTurn The current turn number.
     */
    analyze(messages, currentTurn) {
        const fileRegistry = new Map();
        let totalTokens = 0;
        let fileTokens = 0;
        let toolTokens = 0;
        messages.forEach((msg, index) => {
            const turn = index + 1;
            // Basic token estimation for the message
            const msgText = typeof msg.content === "string"
                ? msg.content
                : JSON.stringify(msg.content);
            const msgTokens = Math.ceil(msgText.length / ContextAnalyzer.TOKEN_HEURISTIC);
            totalTokens += msgTokens;
            if (msg.role === "assistant" && Array.isArray(msg.content)) {
                for (const block of msg.content) {
                    if (block.type === "tool_use") {
                        const input = block.input;
                        const path = this.extractPath(block.name, input);
                        if (path) {
                            const opType = this.getOpType(block.name);
                            // If the file is already tracked, update it
                            // Find the tool result for this tool use to get actual content length
                            const result = this.findToolResult(messages, index, block.id);
                            const content = result?.content || "";
                            const weight = Math.ceil(String(content).length / ContextAnalyzer.TOKEN_HEURISTIC);
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
            if (msg.role === "tool") {
                toolTokens += Math.ceil(String(msg.content).length / ContextAnalyzer.TOKEN_HEURISTIC);
            }
        });
        const files = Array.from(fileRegistry.values());
        fileTokens = files.reduce((acc, f) => acc + f.weight, 0);
        return {
            files: files.sort((a, b) => b.weight - a.weight).slice(0, 100),
            totalTokens,
            systemTokens: 0, // Pi provides this via ctx, not messages
            historyTokens: totalTokens - fileTokens - toolTokens,
            fileTokens,
            toolTokens,
        };
    }
    extractPath(toolName, input) {
        if (toolName === "read" || toolName === "write" || toolName === "edit") {
            return typeof input.path === "string" ? input.path : null;
        }
        if (toolName === "bash") {
            // Simple regex for paths in bash commands (e.g., cat path/to/file)
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
                return "delete"; // Simplified; usually bash implies modification or deletion
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
        // Look for the tool result immediately following the tool use
        for (let i = toolTurnIndex + 1; i < messages.length; i++) {
            if (messages[i].role === "tool" && messages[i].tool_call_id === toolId) {
                return messages[i];
            }
            // If we hit another assistant turn, the result for this specific call is likely gone/compacted
            if (messages[i].role === "assistant")
                break;
        }
        return null;
    }
}
exports.ContextAnalyzer = ContextAnalyzer;
