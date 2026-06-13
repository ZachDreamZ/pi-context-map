/**
 * ContextAnalyzer
 * Responsible for parsing Pi session messages to identify the active working set of files,
 * their token weights, and their temporal status.
 */
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
export interface ContextMap {
    files: FileContext[];
    totalTokens: number;
    systemTokens: number;
    historyTokens: number;
    fileTokens: number;
    toolTokens: number;
}
export declare class ContextAnalyzer {
    /**
     * Heuristic for token estimation: approx 4 chars per token.
     */
    private static TOKEN_HEURISTIC;
    /**
     * Analyze session messages to produce a context map.
     * @param messages The full session conversation history.
     * @param currentTurn The current turn number.
     */
    analyze(messages: any[], currentTurn: number): ContextMap;
    private extractPath;
    private getOpType;
    private calculateStatus;
    private findToolResult;
}
