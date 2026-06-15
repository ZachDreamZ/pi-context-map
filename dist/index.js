"use strict";
/**
 * pi-context-map
 * Professional Context Profiler for Pi.
 * v0.5.1 — Dynamic context window, dark mode, session-unique reports.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = piContextMap;
const analyzer_1 = require("./analyzer");
const generator_1 = require("./generator");
const insights_1 = require("./insights");
const live_server_1 = require("./live-server");
const path = __importStar(require("node:path"));
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
function makeReportPath(sessionName) {
    const dir = path.join(os.homedir(), ".pi", "context-map");
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const now = new Date();
    const date = now.toISOString().split("T")[0];
    const time = now.toTimeString().split(" ")[0].replace(/:/g, "-");
    const safe = (sessionName || "session").replace(/[^\w.-]/g, "_").slice(0, 40);
    const filename = `${date}_${time}_${safe}.html`;
    return path.join(dir, filename);
}
async function piContextMap(pi) {
    const analyzer = new analyzer_1.ContextAnalyzer();
    const liveServer = new live_server_1.LiveReportServer();
    let sessionMessages = [];
    let currentTurn = 0;
    let contextWindow = 128_000;
    let currentReportPath = makeReportPath();
    // Capture messages and context window from Pi system
    pi.on("context", (event, ctx) => {
        if (event?.messages && Array.isArray(event.messages)) {
            sessionMessages = event.messages;
        }
        try {
            const usage = ctx?.getContextUsage?.();
            if (usage?.contextWindow && usage.contextWindow > 0) {
                contextWindow = usage.contextWindow;
            }
        }
        catch {
            // Keep fallback
        }
    });
    pi.on("turn_start", () => {
        currentTurn++;
    });
    // Update report path when session changes
    pi.on("session_start", () => {
        currentReportPath = makeReportPath();
    });
    async function runAnalysis() {
        const messages = sessionMessages.length > 0 ? sessionMessages : [];
        const composition = analyzer.analyzeByType(messages, currentTurn);
        const insights = insights_1.InsightEngine.generate(composition);
        const html = generator_1.ReportGenerator.generateHTML(composition, insights, contextWindow);
        try {
            const dir = path.dirname(currentReportPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(currentReportPath, html, "utf8");
        }
        catch (err) {
            console.error(`[pi-context-map] Failed to write report: ${err.message}`);
        }
        if (liveServer.isRunning) {
            liveServer.update(html, currentReportPath);
        }
        return { composition, insights, reportPath: currentReportPath };
    }
    const serverUrl = await liveServer.start();
    pi.registerCommand("context-map", {
        description: "Generate a visual context map with actionable insights. Use 'stop' to terminate the live server.",
        handler: async (args, ctx) => {
            if (args.trim().toLowerCase() === "stop") {
                liveServer.stop();
                ctx.ui.notify("Live server stopped.", "info");
                return;
            }
            ctx.ui.notify("Analyzing session context...", "info");
            try {
                const { insights, reportPath } = await runAnalysis();
                const criticalCount = insights.filter((i) => i.severity === "critical").length;
                const summary = criticalCount > 0
                    ? `Context map generated. ${criticalCount} critical insight(s) found.`
                    : "Context map generated successfully.";
                let details = `File: ${reportPath}`;
                if (serverUrl) {
                    details += ` | Live: ${serverUrl}`;
                }
                ctx.ui.notify(`${summary} ${details}`, criticalCount > 0 ? "warning" : "success");
            }
            catch (error) {
                ctx.ui.notify(`Failed to generate context map: ${error.message}`, "error");
            }
        },
    });
    pi.registerTool({
        name: "context-map",
        label: "Context Map",
        description: "Analyze the current session context composition and return actionable insights. The live localhost report will auto-update.",
        parameters: {
            type: "object",
            properties: {},
        },
        async execute(_params, _signal, _onUpdate, _ctx) {
            try {
                const { composition, insights, reportPath } = await runAnalysis();
                const usagePercent = composition.total.tokens > 0
                    ? Math.round((composition.total.tokens / contextWindow) * 100)
                    : 0;
                const summary = `Context: ${composition.total.tokens.toLocaleString()} tokens total. ` +
                    `System ${composition.system.percent}%, Tools ${composition.tools.percent}%, ` +
                    `History ${composition.history.percent}%, Files ${composition.files.percent}%, ` +
                    `Summaries ${composition.summaries.percent}%. ` +
                    `Usage: ${usagePercent}% of ${(contextWindow / 1000).toFixed(0)}k window. ` +
                    `${insights.length} insight(s) generated.`;
                return {
                    type: "text",
                    content: [
                        summary,
                        "",
                        ...insights.map((i) => `[${i.severity.toUpperCase()}] ${i.title}: ${i.message}`),
                        `Report: ${reportPath}`,
                        serverUrl ? `Live: ${serverUrl}` : "",
                    ]
                        .filter(Boolean)
                        .join("\n"),
                };
            }
            catch (error) {
                return {
                    type: "text",
                    content: `Error: ${error.message}`,
                    isError: true,
                };
            }
        },
    });
    pi.on("session_before_compact", (_event, ctx) => {
        const tokens = _event?.preparation?.tokensBefore;
        if (tokens && tokens > 100_000) {
            ctx.ui.notify(`High context load (${(tokens / 1000).toFixed(1)}k tokens). Try /context-map to see what's consuming space.`, "info");
        }
    });
    pi.on("message_end", async (_event) => {
        if (_event?.message?.role === "assistant" && liveServer.isRunning) {
            try {
                await runAnalysis();
            }
            catch {
                // Ignore auto-refresh failures
            }
        }
    });
    pi.on("session_shutdown", () => {
        liveServer.stop();
    });
    process.on("SIGINT", () => {
        liveServer.stop();
    });
    process.on("SIGTERM", () => {
        liveServer.stop();
    });
}
