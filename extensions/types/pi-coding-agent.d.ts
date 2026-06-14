declare module "@earendil-works/pi-coding-agent" {
	export interface ExtensionAPI {
		registerCommand(
			name: string,
			options: {
				description: string;
				handler: (
					args: string | undefined,
					ctx: ExtensionContext,
				) => Promise<void> | void;
			},
		): void;
		on(
			event: string,
			handler: (event: any, ctx: ExtensionContext) => Promise<void> | void,
		): void;
	}

	export interface ExtensionContext {
		ui: {
			notify(
				message: string,
				level: "info" | "success" | "warning" | "error",
			): void;
		};
		session: {
			messages: any[];
		};
		modelRegistry: any;
	}
}
