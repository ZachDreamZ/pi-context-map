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

	test("system messages are categorized correctly", () => {
		const messages = [
			{ role: "system", content: "You are a helpful assistant." },
		];
		const result = analyzer.analyzeByType(messages, 1);
		expect(result.system.tokens).toBeGreaterThan(0);
		expect(result.tools.tokens).toBe(0);
		expect(result.history.tokens).toBe(0);
	});

	test("tool messages are categorized correctly", () => {
		const messages = [
			{ role: "tool", content: "Result data", tool_call_id: "t1" },
		];
		const result = analyzer.analyzeByType(messages, 1);
		expect(result.tools.tokens).toBeGreaterThan(0);
	});

	test("assistant messages are categorized as history", () => {
		const messages = [{ role: "assistant", content: "I will help you." }];
		const result = analyzer.analyzeByType(messages, 1);
		expect(result.history.tokens).toBeGreaterThan(0);
	});

	test("user messages are categorized as history", () => {
		const messages = [{ role: "user", content: "Help me debug this." }];
		const result = analyzer.analyzeByType(messages, 1);
		expect(result.history.tokens).toBeGreaterThan(0);
	});

	test("compaction messages are categorized as summaries", () => {
		const messages = [
			{ role: "compaction", content: "Summary of prior conversation." },
		];
		const result = analyzer.analyzeByType(messages, 1);
		expect(result.summaries.tokens).toBeGreaterThan(0);
	});

	test("percentages sum to ~100", () => {
		const messages = [
			{ role: "system", content: "System prompt" },
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there" },
			{ role: "tool", content: "Output", tool_call_id: "t1" },
		];
		const result = analyzer.analyzeByType(messages, 1);
		const totalPercent =
			result.system.percent +
			result.tools.percent +
			result.history.percent +
			result.files.percent +
			result.summaries.percent;
		expect(totalPercent).toBeGreaterThanOrEqual(95);
		expect(totalPercent).toBeLessThanOrEqual(105);
	});

	test("file tracking works for tool_use blocks", () => {
		const messages = [
			{
				role: "assistant",
				content: [
					{
						type: "tool_use",
						name: "read",
						input: { path: "src/auth.ts" },
						id: "t1",
					},
				],
			},
			{
				role: "tool",
				content: "export function login() {}",
				tool_call_id: "t1",
			},
		];
		const result = analyzer.analyzeByType(messages, 2);
		expect(result.files_detail.length).toBe(1);
		expect(result.files_detail[0].path).toBe("src/auth.ts");
		expect(result.files_detail[0].lastOp.type).toBe("read");
	});

	test("analyze() backward compatibility wrapper works", () => {
		const result = analyzer.analyze([{ role: "user", content: "Hi" }], 1);
		expect(result.total.tokens).toBeGreaterThan(0);
		expect(result.history.tokens).toBeGreaterThan(0);
	});
});
