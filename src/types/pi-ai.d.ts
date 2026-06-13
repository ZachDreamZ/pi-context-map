declare module "@earendil-works/pi-ai" {
	export async function complete(
		model: any,
		params: {
			messages: any[];
		},
		options?: {
			apiKey?: string;
			headers?: Record<string, string>;
			maxTokens?: number;
			signal?: AbortSignal;
		}
	): Promise<{
		content: Array<{ type: "text"; text: string }>;
	}>;
}
