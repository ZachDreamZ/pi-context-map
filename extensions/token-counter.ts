/**
 * TokenCounter
 * Code-aware token estimation. Avoids heavy external tokenizers (e.g., tiktoken)
 * by applying multipliers based on content structure.
 *
 * Heuristic base: 4 characters per token (the standard for English text).
 * Adjustments:
 *  - Code blocks (```...```) are denser in tokens (identifiers, symbols).
 *  - JSON payloads have more structural overhead.
 *  - Pure whitespace is under-weighted.
 */
export class TokenCounter {
	/** Base heuristic: average English is ~4 characters per token. */
	private static BASE_CHARS_PER_TOKEN = 4;

	/** Multiplier for fenced code blocks (```` ``` ````). */
	private static CODE_MULTIPLIER = 1.3;

	/** Multiplier for JSON-like structures. */
	private static JSON_MULTIPLIER = 1.5;

	/**
	 * Count estimated tokens for a raw string of text.
	 */
	public static count(text: string): number {
		if (!text) return 0;

		let total = 0;
		let cursor = 0;
		const len = text.length;

		while (cursor < len) {
			// Detect fenced code blocks
			const fenceStart = text.indexOf("```", cursor);
			if (fenceStart !== -1) {
				// Count everything up to the fence as regular text
				total += TokenCounter.regularChunk(text.substring(cursor, fenceStart));
				// Find the closing fence
				const fenceEnd = text.indexOf("```", fenceStart + 3);
				if (fenceEnd === -1) {
					// Unclosed fence — treat the rest as code
					total += TokenCounter.codeChunk(text.substring(fenceStart));
					cursor = len;
				} else {
					total += TokenCounter.codeChunk(
						text.substring(fenceStart, fenceEnd + 3),
					);
					cursor = fenceEnd + 3;
				}
				continue;
			}

			// Detect JSON-like content (starts with { or [ and has balanced structure)
			const trimmed = text.substring(cursor).trimStart();
			const firstChar = trimmed.charAt(0);
			if (
				(firstChar === "{" || firstChar === "[") &&
				TokenCounter.looksLikeJson(trimmed)
			) {
				const jsonLen = TokenCounter.extractJsonLength(trimmed);
				if (jsonLen > 0) {
					total += TokenCounter.jsonChunk(trimmed.substring(0, jsonLen));
					cursor += text.substring(cursor).indexOf(trimmed) + jsonLen;
					continue;
				}
			}

			// Default: regular text
			total += TokenCounter.regularChunk(text.substring(cursor));
			cursor = len;
		}

		return Math.ceil(total);
	}

	/**
	 * Convenience: count tokens for any message shape Pi uses.
	 */
	public static countMessage(msg: any): number {
		if (!msg) return 0;
		if (typeof msg.content === "string") {
			return TokenCounter.count(msg.content);
		}
		if (Array.isArray(msg.content)) {
			return msg.content.reduce((sum: number, block: any) => {
				if (typeof block === "string") return sum + TokenCounter.count(block);
				if (block.type === "text" && typeof block.text === "string") {
					return sum + TokenCounter.count(block.text);
				}
				if (block.type === "tool_use" || block.type === "tool_result") {
					return sum + TokenCounter.count(JSON.stringify(block));
				}
				return sum + TokenCounter.count(JSON.stringify(block));
			}, 0);
		}
		return TokenCounter.count(JSON.stringify(msg));
	}

	private static regularChunk(text: string): number {
		return text.length / TokenCounter.BASE_CHARS_PER_TOKEN;
	}

	private static codeChunk(text: string): number {
		return (
			(text.length / TokenCounter.BASE_CHARS_PER_TOKEN) *
			TokenCounter.CODE_MULTIPLIER
		);
	}

	private static jsonChunk(text: string): number {
		return (
			(text.length / TokenCounter.BASE_CHARS_PER_TOKEN) *
			TokenCounter.JSON_MULTIPLIER
		);
	}

	private static looksLikeJson(text: string): boolean {
		// Quick heuristic: contains quoted keys and structural punctuation
		return /"[^"]+"\s*:/i.test(text) && /[{}[\],]/.test(text);
	}

	private static extractJsonLength(text: string): number {
		let depth = 0;
		let inString = false;
		let escape = false;
		for (let i = 0; i < text.length; i++) {
			const ch = text[i];
			if (escape) {
				escape = false;
				continue;
			}
			if (ch === "\\") {
				escape = true;
				continue;
			}
			if (ch === '"') {
				inString = !inString;
				continue;
			}
			if (inString) continue;
			if (ch === "{" || ch === "[") depth++;
			else if (ch === "}" || ch === "]") {
				depth--;
				if (depth === 0) return i + 1;
			}
		}
		return 0;
	}
}
