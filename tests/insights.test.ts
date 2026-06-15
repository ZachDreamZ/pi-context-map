import { InsightEngine } from "../extensions/insights";
import type { ContextComposition } from "../extensions/analyzer";

describe("InsightEngine", () => {
	const baseComposition = (): ContextComposition => ({
		system: { tokens: 5000, percent: 10 },
		tools: { tokens: 5000, percent: 10 },
		history: { tokens: 20000, percent: 40 },
		files: { tokens: 5000, percent: 10 },
		summaries: { tokens: 0, percent: 0 },
		total: { tokens: 35000, percent: 100 },
		files_detail: [],
	});

	test("returns healthy insight when composition is balanced", () => {
		const insights = InsightEngine.generate(baseComposition());
		const healthy = insights.find((i) => i.id === "healthy-context");
		expect(healthy).toBeDefined();
	});

	test("tool-bloat warning when tools > 40%", () => {
		const comp = baseComposition();
		comp.tools = { tokens: 60000, percent: 50 };
		comp.total = { tokens: 120000, percent: 100 };
		const insights = InsightEngine.generate(comp);
		const bloat = insights.find((i) => i.id === "tool-bloat");
		expect(bloat).toBeDefined();
		expect(bloat!.severity).toBe("warning");
	});

	test("stale-files insight shown when legacy files exist", () => {
		const comp = baseComposition();
		comp.files_detail = [
			{
				path: "old-file.ts",
				weight: 500,
				lastOp: { type: "read" as const, turn: 1, timestamp: 0 },
				status: "legacy" as const,
			},
		];
		const insights = InsightEngine.generate(comp);
		const stale = insights.find((i) => i.id === "stale-files");
		expect(stale).toBeDefined();
	});

	test("high-usage critical when > 80%", () => {
		const comp = baseComposition();
		comp.total = { tokens: 110000, percent: 100 };
		const insights = InsightEngine.generate(comp);
		const high = insights.find((i) => i.id === "high-usage");
		expect(high).toBeDefined();
		expect(high!.severity).toBe("critical");
		expect(high!.command).toBe("/ultra-compact");
	});

	test("moderate-usage warning when > 60%", () => {
		const comp = baseComposition();
		comp.total = { tokens: 90000, percent: 100 };
		const insights = InsightEngine.generate(comp);
		const moderate = insights.find((i) => i.id === "moderate-usage");
		expect(moderate).toBeDefined();
		expect(moderate!.severity).toBe("warning");
	});

	test("file-heavy insight when files > 30%", () => {
		const comp = baseComposition();
		comp.files = { tokens: 50000, percent: 40 };
		comp.total = { tokens: 125000, percent: 100 };
		const insights = InsightEngine.generate(comp);
		const heavy = insights.find((i) => i.id === "file-heavy");
		expect(heavy).toBeDefined();
		expect(heavy!.severity).toBe("info");
	});

	test("summaries-present when compaction summaries exist", () => {
		const comp = baseComposition();
		comp.summaries = { tokens: 3000, percent: 5 };
		const insights = InsightEngine.generate(comp);
		const s = insights.find((i) => i.id === "summaries-present");
		expect(s).toBeDefined();
	});

	test("system-overhead insight when system > 25%", () => {
		const comp = baseComposition();
		comp.system = { tokens: 40000, percent: 30 };
		comp.total = { tokens: 133000, percent: 100 };
		const insights = InsightEngine.generate(comp);
		const overhead = insights.find((i) => i.id === "system-overhead");
		expect(overhead).toBeDefined();
	});
});
