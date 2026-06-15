import { TokenCounter } from "../extensions/token-counter";

describe("TokenCounter", () => {
	test("count returns 0 for empty string", () => {
		expect(TokenCounter.count("")).toBe(0);
	});

	test("count returns approximate token count", () => {
		const text = "Hello world this is a test";
		const count = TokenCounter.count(text);
		expect(count).toBeGreaterThan(0);
		expect(count).toBeLessThan(text.length);
	});

	test("countMessage handles string content", () => {
		const msg = { role: "user", content: "Hello world" };
		const count = TokenCounter.countMessage(msg);
		expect(count).toBeGreaterThan(0);
	});

	test("countMessage handles array content", () => {
		const msg = {
			role: "assistant",
			content: [
				{ type: "text", text: "Hello world" },
				{
					type: "tool_use",
					name: "read",
					input: { path: "file.ts" },
					id: "t1",
				},
			],
		};
		const count = TokenCounter.countMessage(msg);
		expect(count).toBeGreaterThan(0);
	});

	test("countMessage returns 0 for invalid input", () => {
		expect(TokenCounter.countMessage(null)).toBe(0);
		expect(TokenCounter.countMessage(undefined)).toBe(0);
		expect(TokenCounter.countMessage({})).toBe(1); // "{}" = 2 chars / 4 = 0.5 -> ceil 1
	});

	test("count handles null and undefined", () => {
		expect(TokenCounter.count(null as any)).toBe(0);
		expect(TokenCounter.count(undefined as any)).toBe(0);
	});
});
