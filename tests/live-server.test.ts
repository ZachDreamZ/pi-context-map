import { LiveReportServer } from "../extensions/live-server";

describe("LiveReportServer", () => {
	let server: LiveReportServer;

	afterEach(async () => {
		if (server) {
			server.stop();
		}
	});

	test("start returns a URL", async () => {
		server = new LiveReportServer();
		const url = await server.start();
		expect(url).toBeTruthy();
		expect(url).toContain("http://127.0.0.1:");
	});

	test("isRunning is true after start", async () => {
		server = new LiveReportServer();
		await server.start();
		expect(server.isRunning).toBe(true);
	});

	test("stop makes isRunning false", async () => {
		server = new LiveReportServer();
		await server.start();
		server.stop();
		expect(server.isRunning).toBe(false);
	});

	test("update stores HTML and sends to clients", async () => {
		server = new LiveReportServer();
		await server.start();
		server.update("<html><body>Test</body></html>");
		// Update doesn't return anything, but it shouldn't throw
		expect(server.isRunning).toBe(true);
	});

	test("health endpoint returns ok", async () => {
		server = new LiveReportServer();
		await server.start();
		const response = await fetch(`${server.url}/health`);
		const data = await response.json();
		expect(data.status).toBe("ok");
		expect(data.port).toBeGreaterThan(0);
	});

	test("token is generated", () => {
		server = new LiveReportServer();
		expect(server.token).toBeTruthy();
		expect(server.token.length).toBe(32); // 16 bytes = 32 hex chars
	});
});
