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
export declare class ContextAnalyzer {
    analyzeByType(messages: any[], _currentTurn: number, systemPrompt?: string): ContextComposition;
    /** Backward-compatible wrapper. */
    analyze(messages: any[], _currentTurn: number): ContextComposition;
    private extractPath;
    private extractPathFromToolResult;
    private getOpType;
    /**
     * Calculate file status based on position in message array.
     * Files near the end are "active", middle are "stale", beginning are "legacy".
     * This is more reliable than turn-based calculation since the context event
     * replaces all messages at once.
     */
    private calculateStatus;
    private findToolResult;
}
