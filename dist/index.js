"use strict";
/**
 * pi-context-map
 * Professional Context Profiler for Pi.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = piContextMap;
const analyzer_1 = require("./analyzer");
const generator_1 = require("./generator");
const insights_1 = require("./insights");
async function piContextMap(pi) {
    const analyzer = new analyzer_1.ContextAnalyzer();
    async function runAnalysis() {
        const messages = pi.session?.messages || [];
        const currentTurn = messages.length;
        const composition = analyzer.analyzeByType(messages, currentTurn);
        const insights = insights_1.InsightEngine.generate(composition);
        const html = generator_1.ReportGenerator.generateHTML(composition, insights);
        const reportPath = generator_1.ReportGenerator.writeReport(html);
        return { composition, insights, reportPath };
    }
    pi.registerCommand("context-map", {
        description: "Generate a visual context map with actionable insights.",
        handler: async (_args, ctx) => {
            ctx.ui.notify("Analyzing session context...", "info");
            try {
                const { reportPath, insights } = await runAnalysis();
                const criticalCount = insights.filter((i) => i.severity === "critical").length;
                const summary = criticalCount > 0
                    ? `Context map generated. ${criticalCount} critical insight(s) found.`
                    : `Context map generated successfully.`;
                ctx.ui.notify(`${summary} Path: ${reportPath}`, criticalCount > 0 ? "warning" : "success");
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                ctx.ui.notify(`Failed to generate context map: ${message}`, "error");
            }
        },
    });
    pi.registerTool({
        name: "context-map",
        description: "Analyze the current session context composition and return actionable insights.",
        parameters: {
            type: "object",
            properties: {},
        },
        handler: async (_ctx, _args) => {
            try {
                const { composition, insights } = await runAnalysis();
                const summary = `Context: ${composition.total.tokens.toLocaleString()} tokens total. ` +
                    `System ${composition.system.percent}%, Tools ${composition.tools.percent}%, ` +
                    `History ${composition.history.percent}%, Files ${composition.files.percent}%, ` +
                    `Summaries ${composition.summaries.percent}%. ` +
                    `${insights.length} insight(s) generated.`;
                return {
                    summary,
                    composition: {
                        system: composition.system.tokens,
                        tools: composition.tools.tokens,
                        history: composition.history.tokens,
                        files: composition.files.tokens,
                        summaries: composition.summaries.tokens,
                        total: composition.total.tokens,
                    },
                    insights: insights.map((i) => ({
                        severity: i.severity,
                        title: i.title,
                        message: i.message,
                        command: i.command,
                    })),
                };
            }
            catch (error) {
                return { error: error.message };
            }
        },
    });
    pi.on("session_before_compact", (event, ctx) => {
        const tokens = event.preparation?.tokensBefore;
        if (tokens && tokens > 100_000) {
            ctx.ui.notify(`High context load detected (${(tokens / 1000).toFixed(1)}k tokens). Try /context-map to see what's consuming space.`, "info");
        }
    });
}
