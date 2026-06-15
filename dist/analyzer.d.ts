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
export declare class ContextAnalyzer {
    analyzeByType(messages: any[], currentTurn: number, systemPrompt?: string): ContextComposition;
    /** Backward-compatible wrapper. */
    analyze(messages: any[], currentTurn: number): ContextComposition;
    private extractPath;
    private extractPathFromToolResult;
    private getOpType;
    private calculateStatus;
    private findToolResult;
}
