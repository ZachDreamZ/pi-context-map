"use strict";
/**
 * pi-context-map
 * Pi extension to visualize session context window and token distribution.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const analyzer_1 = require("./analyzer");
const generator_1 = require("./generator");
function default_1(pi) {
    const analyzer = new analyzer_1.ContextAnalyzer();
    // Register the /context-map command
    pi.registerCommand("context-map", {
        description: "Generate a visual map of the current session context window.",
        handler: (_args, ctx) => {
            ctx.ui.notify("Analyzing session context...", "info");
            try {
                // 1. Extract messages and current turn
                // Note: We assume ctx.session.messages is available.
                // If not, we may need to fetch them via another API or use provided event data.
                const messages = ctx.session.messages || [];
                const currentTurn = messages.length;
                if (messages.length === 0) {
                    ctx.ui.notify("No session history found to map.", "warning");
                    return;
                }
                // 2. Analyze context
                const map = analyzer.analyze(messages, currentTurn);
                // 3. Generate HTML Report
                const html = generator_1.ReportGenerator.generateHTML(map);
                const reportPath = generator_1.ReportGenerator.writeReport(html);
                ctx.ui.notify(`Context map generated successfully! \nPath: ${reportPath}`, "success");
                // Providing a link or instruction to open the report
                ctx.ui.notify("You can open the report.html in your browser to see the visualization.", "info");
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                ctx.ui.notify(`Failed to generate context map: ${message}`, "error");
            }
        },
    });
    // Optional: Notify the user when a significant amount of context is loaded
    pi.on("session_before_compact", (event, ctx) => {
        const { preparation } = event;
        const tokens = preparation.tokensBefore;
        if (tokens > 100_000) {
            ctx.ui.notify(`High context load detected (${(tokens / 1000).toFixed(1)}k tokens). Try /context-map to see what's consuming space.`, "info");
        }
    });
}
