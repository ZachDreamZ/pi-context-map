import { ContextAnalyzer } from "../extensions/analyzer";

describe("ContextAnalyzer", () => {
	const analyzer = new ContextAnalyzer();

	test("analyzeByType returns all slices for empty messages", () => {
		const result = analyzer.analyzeByType([], 0);
		expect(result.system).toBeDefined();
		expect(result.tools).toBeDefined();
		expect(result.history).toBeDefined();
		expect(result.files).toBeDefined();
		expect(result.summaries).toBeDefined();
		expect(result.total).toBeDefined();
		expect(result.files_detail).toEqual([]);
	});

	test("system prompt is categorized as system tokens", () => {
		const result = analyzer.analyzeByType(
			[],
			1,
			"You are a helpful assistant.",
		);
		expect(result.system.tokens).toBeGreaterThan(0);
		expect(result.tools.tokens).toBe(0);
		expect(result.history.tokens).toBe(0);
	});

	test("toolResult messages are categorized as tools", () => {
		// Pi uses role="toolResult" with toolCallId and toolName
		const messages = [
			{
				role: "toolResult",
				toolCallId: "t1",
				toolName: "bash",
				content: [{ type: "text", text: "Result data" }],
				isError: false,
			},
		];
		const result = analyzer.analyzeByType(messages, 1);
		expect(result.tools.tokens).toBeGreaterThan(0);
	});

	test("assistant messages are categorized as history", () => {
		const messages = [
			{
				role: "assistant",
				content: [{ type: "text", text: "I will help you." }],
			},
		];
		const result = analyzer.analyzeByType(messages, 1);
		expect(result.history.tokens).toBeGreaterThan(0);
	});

	test("user messages are categorized as history", () => {
		const messages = [
			{
				role: "user",
				content: [{ type: "text", text: "Help me debug this." }],
			},
		];
		const result = analyzer.analyzeByType(messages, 1);
		expect(result.history.tokens).toBeGreaterThan(0);
	});

	test("compaction messages are categorized as summaries", () => {
		const messages = [
			{
				role: "compaction",
				content: [{ type: "text", text: "Summary of prior conversation." }],
			},
		];
		const result = analyzer.analyzeByType(messages, 1);
		expect(result.summaries.tokens).toBeGreaterThan(0);
	});

	test("percentages sum to ~100", () => {
		const messages = [
			{
				role: "user",
				content: [{ type: "text", text: "Hello" }],
			},
			{
				role: "assistant",
				content: [{ type: "text", text: "Hi there" }],
			},
			{
				role: "toolResult",
				toolCallId: "t1",
				toolName: "bash",
				content: [{ type: "text", text: "Output" }],
				isError: false,
			},
		];
		const result = analyzer.analyzeByType(messages, 1, "System prompt");
		const totalPercent =
			result.system.percent +
			result.tools.percent +
			result.history.percent +
			result.files.percent +
			result.summaries.percent;
		expect(totalPercent).toBeGreaterThanOrEqual(95);
		expect(totalPercent).toBeLessThanOrEqual(105);
	});

	test("file tracking works for toolCall blocks (Pi format)", () => {
		// Pi uses type="toolCall" with id, name, arguments
		const messages = [
			{
				role: "assistant",
				content: [
					{
						type: "toolCall",
						id: "t1",
						name: "read",
						arguments: { path: "src/auth.ts" },
					},
				],
			},
			{
				role: "toolResult",
				toolCallId: "t1",
				toolName: "read",
				content: [{ type: "text", text: "export function login() {}" }],
				isError: false,
			},
		];
		const result = analyzer.analyzeByType(messages, 2);
		expect(result.files_detail.length).toBe(1);
		expect(result.files_detail[0].path).toBe("src/auth.ts");
		expect(result.files_detail[0].lastOp.type).toBe("read");
	});

	test("file tracking works for write toolCall", () => {
		const messages = [
			{
				role: "assistant",
				content: [
					{
						type: "toolCall",
						id: "t2",
						name: "write",
						arguments: { path: "output.txt", content: "data" },
					},
				],
			},
			{
				role: "toolResult",
				toolCallId: "t2",
				toolName: "write",
				content: [{ type: "text", text: "File written" }],
				isError: false,
			},
		];
		const result = analyzer.analyzeByType(messages, 2);
		expect(result.files_detail.length).toBe(1);
		expect(result.files_detail[0].lastOp.type).toBe("write");
	});

	test("image attachments in user messages are tracked", () => {
		const messages = [
			{
				role: "user",
				content: [
					{ type: "text", text: "Look at this" },
					{ type: "image", data: "base64...", mimeType: "image/png" },
				],
			},
		];
		const result = analyzer.analyzeByType(messages, 1);
		expect(result.files_detail.length).toBe(1);
		expect(result.files_detail[0].path).toBe("[image]");
	});

	test("file paths in user text are tracked", () => {
		const messages = [
			{
				role: "user",
				content: [
					{ type: "text", text: "Fix the file at /src/index.ts please" },
				],
			},
		];
		const result = analyzer.analyzeByType(messages, 1);
		expect(result.files_detail.length).toBe(1);
		expect(result.files_detail[0].path).toBe("/src/index.ts");
	});

	test("analyze() backward compatibility wrapper works", () => {
		const messages = [
			{
				role: "user",
				content: [{ type: "text", text: "Hi" }],
			},
		];
		const result = analyzer.analyze(messages, 1);
		expect(result.total.tokens).toBeGreaterThan(0);
		expect(result.history.tokens).toBeGreaterThan(0);
	});
});
