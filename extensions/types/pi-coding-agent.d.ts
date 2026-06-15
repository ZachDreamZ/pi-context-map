declare module "pi-coding-agent" {
	export interface ExtensionAPI {
		on(event: string, handler: Function): void;
		registerTool<TDetails = unknown>(tool: ToolDefinition<TDetails>): void;
		registerCommand(
			name: string,
			options: {
				description?: string;
				handler: (
					args: string,
					ctx: ExtensionCommandContext,
				) => Promise<void> | void;
			},
		): void;
		registerProvider(name: string, config: any): void;
		unregisterProvider(name: string): void;
		sendMessage(message: any, options?: any): void;
		sendUserMessage(content: string | any[], options?: any): void;
		appendEntry(customType: string, data?: any): void;
		setSessionName(name: string): void;
		getSessionName(): string | undefined;
		setLabel(entryId: string, label: string | undefined): void;
		getActiveTools(): string[];
		getAllTools(): any[];
		setActiveTools(toolNames: string[]): void;
	}

	export interface ToolDefinition<TDetails = unknown> {
		name: string;
		label: string;
		description: string;
		promptSnippet?: string;
		promptGuidelines?: string[];
		parameters: any;
		execute(
			params: any,
			signal: AbortSignal | undefined,
			onUpdate: ((update: TDetails) => void) | undefined,
			ctx: ExtensionContext,
		): Promise<{ type: "text"; content: string; isError?: boolean }>;
		renderCall?: (args: any, theme: any) => any;
		renderResult?: (result: any, options: any, theme: any) => any;
	}

	export interface ExtensionContext {
		ui: ExtensionUIContext;
		hasUI: boolean;
		cwd: string;
		sessionManager: any;
		model: any;
		isIdle(): boolean;
		abort(): void;
		shutdown(): void;
		getContextUsage():
			| { tokens: number | null; contextWindow: number; percent: number | null }
			| undefined;
		compact(options?: any): void;
		getSystemPrompt(): string;
	}

	export interface ExtensionUIContext {
		notify(
			message: string,
			type?: "info" | "warning" | "error" | "success",
		): void;
	}

	export interface ExtensionCommandContext {
		ui: ExtensionUIContext;
		hasUI: boolean;
		cwd: string;
		sessionManager: any;
		model: any;
		isIdle(): boolean;
		abort(): void;
		shutdown(): void;
		getContextUsage(): any;
		compact(options?: any): void;
		getSystemPrompt(): string;
		waitForIdle(): Promise<void>;
		newSession(options?: any): Promise<{ cancelled: boolean }>;
		fork(entryId: string): Promise<{ cancelled: boolean }>;
		navigateTree(
			targetId: string,
			options?: any,
		): Promise<{ cancelled: boolean }>;
		switchSession(sessionPath: string): Promise<{ cancelled: boolean }>;
		reload(): Promise<void>;
	}

	export interface AgentMessage {
		role: "user" | "assistant" | "system" | "tool";
		content?: any;
		id?: string;
		name?: string;
		tool_call_id?: string;
		type?: string;
		compactionEntry?: any;
		timestamp?: number;
	}
}
