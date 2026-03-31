import { afterEach, describe, expect, test } from "bun:test";
import { listenOnPort } from "./network";

const envKeys = ["PLANNOTATOR_REMOTE", "PLANNOTATOR_PORT", "SSH_TTY", "SSH_CONNECTION"];
const savedEnv: Record<string, string | undefined> = {};

function resetEnv() {
	for (const key of envKeys) {
		savedEnv[key] = process.env[key];
		delete process.env[key];
	}
}

afterEach(() => {
	for (const key of envKeys) {
		if (savedEnv[key] !== undefined) process.env[key] = savedEnv[key];
		else delete process.env[key];
	}
});

class FakeServer {
	ports: number[] = [];
	private currentPort = 0;
	private attemptsByPort = new Map<number, number>();

	constructor(private readonly failOnPort: number, private readonly failCount = 1) {}

	once(_event: string, _handler: (err: unknown) => void) {}

	removeListener(_event: string, _handler: (err: unknown) => void) {}

	listen(port: number, _host: string, callback: () => void) {
		this.ports.push(port);
		const attempts = (this.attemptsByPort.get(port) ?? 0) + 1;
		this.attemptsByPort.set(port, attempts);
		if (port === this.failOnPort && attempts <= this.failCount) {
			throw new Error("EADDRINUSE: address already in use");
		}
		this.currentPort = port;
		callback();
	}

	address() {
		return { port: this.currentPort };
	}
}

describe("listenOnPort", () => {
	test("falls through to the next remote port when the first is occupied", async () => {
		resetEnv();
		process.env.PLANNOTATOR_REMOTE = "1";
		const server = new FakeServer(19432);

		const result = await listenOnPort(server as never);

		expect(result).toEqual({ port: 19433, portSource: "remote-default" });
		expect(server.ports.slice(0, 2)).toEqual([19432, 19433]);
	});

	test("keeps retrying the exact configured port", async () => {
		resetEnv();
		process.env.PLANNOTATOR_REMOTE = "1";
		process.env.PLANNOTATOR_PORT = "9999";
		const server = new FakeServer(9999, 5);

		await expect(listenOnPort(server as never)).rejects.toThrow(
			"Port 9999 in use after 5 retries",
		);
		expect(server.ports).toEqual([9999, 9999, 9999, 9999, 9999]);
	});
});
