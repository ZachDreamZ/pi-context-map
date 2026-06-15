import { ReportGenerator } from "../extensions/generator";
import type { ContextComposition } from "../extensions/analyzer";
import type { Insight } from "../extensions/insights";

describe("ReportGenerator", () => {
	const baseComposition: ContextComposition = {
		system: { tokens: 5000, percent: 10 },
		tools: { tokens: 5000, percent: 10 },
		history: { tokens: 20000, percent: 40 },
		files: { tokens: 5000, percent: 10 },
		summaries: { tokens: 0, percent: 0 },
		total: { tokens: 35000, percent: 100 },
		files_detail: [],
	};

	const baseInsights: Insight[] = [
		{
			id: "healthy-context",
			severity: "info",
			title: "Context looks healthy",
			message: "Your context composition is balanced.",
		},
	];

	test("generateHTML returns a non-empty string", () => {
		const html = ReportGenerator.generateHTML(baseComposition, baseInsights);
		expect(html).toBeTruthy();
		expect(html.length).toBeGreaterThan(100);
	});

	test("generateHTML contains expected elements", () => {
		const html = ReportGenerator.generateHTML(baseComposition, baseInsights);
		expect(html).toContain("Context Profiler");
		expect(html).toContain("Context Composition");
		expect(html).toContain("Insights");
		expect(html).toContain("</html>");
	});

	test("generateHTML includes file cards when files_detail is populated", () => {
		const comp: ContextComposition = {
			...baseComposition,
			files_detail: [
				{
					path: "src/app.ts",
					weight: 2000,
					lastOp: { type: "read", turn: 5, timestamp: 1000 },
					status: "active",
				},
			],
		};
		const html = ReportGenerator.generateHTML(comp, baseInsights);
		expect(html).toContain("src/app.ts");
		expect(html).toContain("2,000");
		expect(html).toContain("Read");
	});

	test("generateHTML includes insight cards", () => {
		const insights: Insight[] = [
			{
				id: "tool-bloat",
				severity: "warning",
				title: "Tool bloat detected",
				message: "Tool results at 50%.",
				command: "/ultra-compact",
			},
		];
		const html = ReportGenerator.generateHTML(baseComposition, insights);
		expect(html).toContain("Tool bloat detected");
		expect(html).toContain("warning");
		expect(html).toContain("/ultra-compact");
	});

	test("generateHTML handles empty composition gracefully", () => {
		const emptyComposition: ContextComposition = {
			system: { tokens: 0, percent: 0 },
			tools: { tokens: 0, percent: 0 },
			history: { tokens: 0, percent: 0 },
			files: { tokens: 0, percent: 0 },
			summaries: { tokens: 0, percent: 0 },
			total: { tokens: 0, percent: 0 },
			files_detail: [],
		};
		const html = ReportGenerator.generateHTML(emptyComposition, []);
		expect(html).toBeTruthy();
		expect(html).toContain("Context Profiler");
		expect(html).toContain("</html>");
	});
});
