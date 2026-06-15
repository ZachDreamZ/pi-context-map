/**
 * LiveReportServer
 * Serves the context map HTML report on a local HTTP server with live updates via SSE.
 *
 * Features:
 *  - Auto-assigns a free port (pass 0 to OS).
 *  - Binds to 127.0.0.1 only (no external access).
 *  - Serves the current report HTML at `/`.
 *  - Streams updates via Server-Sent Events at `/events`.
 *  - Graceful shutdown via `stop()`.
 *  - Null-safe error handling throughout.
 */
import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import type { AddressInfo } from "node:net";

const DEFAULT_REPORT_PATH = path.join(
	os.homedir(),
	".pi",
	"context-map",
	"report.html",
);

/**
 * Allowed origins for SSE connections. Only localhost variants are allowed.
 */
function isAllowedOrigin(origin: string | undefined, port: number): boolean {
	if (!origin) return true; // No Origin header (e.g., direct curl) is allowed
	const allowed = [
		`http://127.0.0.1:${port}`,
		`http://localhost:${port}`,
		"http://127.0.0.1",
		"http://localhost",
	];
	return allowed.some((o) => origin.startsWith(o));
}

export class LiveReportServer {
	private server: http.Server | null = null;
	private clients: Set<http.ServerResponse> = new Set();
	private currentHtml: string = "";
	private port: number = 0;
	private host: string = "127.0.0.1";
	/** Session token to prevent unauthorized access. */
	public readonly token: string = crypto.randomBytes(16).toString("hex");

	/**
	 * Start the server. Returns a Promise that resolves to the URL, or null on failure.
	 */
	public start(): Promise<string | null> {
		// Kill any pre-existing server to ensure only one instance runs
		if (this.server) {
			this.stop();
		}

		return new Promise((resolve) => {
			try {
				this.server = http.createServer((req, res) =>
					this.handleRequest(req, res),
				);
				this.server.on("error", (err) => {
					console.error(`[pi-context-map] Server error: ${err.message}`);
					this.stop();
				});

				this.server.listen(0, this.host, () => {
					const addr = this.server?.address() as AddressInfo | null;
					if (addr) {
						this.port = addr.port;
						resolve(this.url);
					} else {
						resolve(null);
					}
				});
			} catch (err: any) {
				console.error(
					`[pi-context-map] Failed to start server: ${err.message}`,
				);
				resolve(null);
			}
		});
	}

	/**
	 * Stop the server and close all client connections.
	 */
	public stop(): void {
		if (!this.server) return;

		// Close all SSE clients
		for (const client of this.clients) {
			try {
				client.end();
			} catch {
				// Ignore
			}
		}
		this.clients.clear();

		// Force-close all connections synchronously (Node 18.2+)
		if (typeof this.server.closeAllConnections === "function") {
			this.server.closeAllConnections();
		}

		// Close server and reset state synchronously
		this.server.close();
		this.server = null;
		this.port = 0;
	}

	/**
	 * Update the report content and broadcast to all connected clients.
	 * @param html The new HTML content.
	 * @param reportPath Optional path to the report file to also write to disk.
	 */
	public update(html: string, reportPath?: string): void {
		this.currentHtml = html;

		// Optionally write to disk
		if (reportPath) {
			try {
				const dir = path.dirname(reportPath);
				if (!fs.existsSync(dir)) {
					fs.mkdirSync(dir, { recursive: true });
				}
				fs.writeFileSync(reportPath, html, "utf8");
			} catch (err: any) {
				console.error(
					`[pi-context-map] Failed to write report: ${err.message}`,
				);
			}
		}

		// Broadcast to all SSE clients
		for (const client of this.clients) {
			try {
				client.write(
					`data: ${JSON.stringify({ html, timestamp: Date.now() })}\n\n`,
				);
			} catch (err) {
				// Client may have disconnected; remove it
				this.clients.delete(client);
			}
		}
	}

	/**
	 * Get the URL the server is listening on, or null if not started.
	 */
	public get url(): string | null {
		if (!this.server || this.port === 0) return null;
		return `http://${this.host}:${this.port}`;
	}

	/**
	 * Whether the server is currently running.
	 */
	public get isRunning(): boolean {
		return this.server !== null;
	}

	/**
	 * Handle incoming HTTP requests.
	 */
	private handleRequest(
		req: http.IncomingMessage,
		res: http.ServerResponse,
	): void {
		if (!req.url) {
			res.writeHead(400);
			res.end("Bad request");
			return;
		}

		const url = new URL(req.url, `http://${this.host}:${this.port}`);

		// SSE endpoint for live updates
		if (url.pathname === "/events") {
			this.handleSSE(req, res);
			return;
		}

		// Health check
		if (url.pathname === "/health") {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ status: "ok", port: this.port }));
			return;
		}

		// Stop endpoint
		if (url.pathname === "/stop" && req.method === "POST") {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ status: "stopping" }));
			setTimeout(() => this.stop(), 100);
			return;
		}

		// Main page: serve the current HTML or load from disk
		if (url.pathname === "/" || url.pathname === "/report.html") {
			let html = this.currentHtml;
			if (!html) {
				// Try to load from disk as fallback
				try {
					html = fs.readFileSync(DEFAULT_REPORT_PATH, "utf8");
				} catch {
					html = this.placeholderHtml();
				}
			}
			// Inject the session token so the client can authenticate to /events
			if (html.includes("<head>")) {
				html = html.replace(
					"<head>",
					`<head><meta name="context-map-token" content="${this.token}">`,
				);
			}
			res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
			res.end(html);
			return;
		}

		// 404 for everything else
		res.writeHead(404);
		res.end("Not found");
	}

	/**
	 * Handle Server-Sent Events connection.
	 */
	private handleSSE(req: http.IncomingMessage, res: http.ServerResponse): void {
		// Token-based auth: require ?token=<sessionToken> to prevent unauthorized SSE subscriptions
		if (!req.url) {
			res.writeHead(400);
			res.end("Bad request");
			return;
		}
		const reqUrl = new URL(req.url, `http://${this.host}:${this.port}`);
		const providedToken = reqUrl.searchParams.get("token");
		if (providedToken !== this.token) {
			res.writeHead(401, { "Content-Type": "text/plain" });
			res.end("Unauthorized: invalid or missing token");
			return;
		}

		// Origin validation: only allow connections from localhost
		if (!isAllowedOrigin(req.headers.origin, this.port)) {
			res.writeHead(403, { "Content-Type": "text/plain" });
			res.end("Forbidden: origin not allowed");
			return;
		}

		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"Access-Control-Allow-Origin": `http://127.0.0.1:${this.port}`,
		});

		// Send initial state if we have content
		if (this.currentHtml) {
			res.write(
				`data: ${JSON.stringify({ html: this.currentHtml, timestamp: Date.now() })}\n\n`,
			);
		} else {
			res.write(`data: ${JSON.stringify({ waiting: true })}\n\n`);
		}

		this.clients.add(res);

		// Heartbeat to keep connection alive (every 30s)
		const heartbeat = setInterval(() => {
			try {
				res.write(": heartbeat\n\n");
			} catch {
				clearInterval(heartbeat);
				this.clients.delete(res);
			}
		}, 30000);

		req.on("close", () => {
			clearInterval(heartbeat);
			this.clients.delete(res);
		});
	}

	/**
	 * Placeholder HTML shown when no report has been generated yet.
	 */
	private placeholderHtml(): string {
		return `<!DOCTYPE html>
<html><head><title>pi-context-map</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#010102;color:#f7f8f8;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}</style>
</head><body>
<div style="text-align:center;">
<h1 style="color:#5e6ad2;font-size:24px;font-weight:600;">pi-context-map</h1>
<p style="color:#8a8f98;margin-top:8px;">No report generated yet. Run <code>/context-map</code> in Pi to generate one.</p>
</div>
</body></html>`;
	}
}
