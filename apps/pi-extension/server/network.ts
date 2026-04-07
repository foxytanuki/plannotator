/**
 * Network utilities — remote detection, port binding, browser opening.
 */

import { spawn } from "node:child_process";
import type { Server } from "node:http";
import { release } from "node:os";

const DEFAULT_REMOTE_PORT = 19432;
const DEFAULT_REMOTE_PORT_RANGE_END = 19439;
const EXACT_PORT_RETRY_COUNT = 5;

type PortSource = "env" | "remote-default" | "random";

interface PortStrategy {
	port: number;
	portSource: PortSource;
	attemptPorts: number[];
}

function parseConfiguredPort(): number | null {
	const envPort = process.env.PLANNOTATOR_PORT;
	if (!envPort) {
		return null;
	}

	const parsed = parseInt(envPort, 10);
	if (!Number.isNaN(parsed) && parsed > 0 && parsed < 65536) {
		return parsed;
	}

	return null;
}

/**
 * Check if running in a remote session (SSH, devcontainer, etc.)
 * Honors PLANNOTATOR_REMOTE as a tri-state override, or detects SSH_TTY/SSH_CONNECTION.
 */
function getRemoteOverride(): boolean | null {
	const remote = process.env.PLANNOTATOR_REMOTE;
	if (remote === undefined) {
		return null;
	}

	if (remote === "1" || remote?.toLowerCase() === "true") {
		return true;
	}

	if (remote === "0" || remote?.toLowerCase() === "false") {
		return false;
	}

	return null;
}

export function isRemoteSession(): boolean {
	const remoteOverride = getRemoteOverride();
	if (remoteOverride !== null) {
		return remoteOverride;
	}
	// Legacy SSH detection
	if (process.env.SSH_TTY || process.env.SSH_CONNECTION) {
		return true;
	}
	return false;
}

/** Get the server port strategy to use. */
function getServerPortStrategy(): PortStrategy {
	const configuredPort = parseConfiguredPort();
	if (configuredPort !== null) {
		return {
			port: configuredPort,
			portSource: "env",
			attemptPorts: Array(EXACT_PORT_RETRY_COUNT).fill(configuredPort),
		};
	}

	if (isRemoteSession()) {
		return {
			port: DEFAULT_REMOTE_PORT,
			portSource: "remote-default",
			attemptPorts: Array.from(
				{ length: DEFAULT_REMOTE_PORT_RANGE_END - DEFAULT_REMOTE_PORT + 1 },
				(_, index) => DEFAULT_REMOTE_PORT + index,
			),
		};
	}

	return { port: 0, portSource: "random", attemptPorts: [0] };
}

/**
 * Get the preferred server port to use.
 * Returns the first port that listenOnPort will try, plus the source label.
 */
export function getServerPort(): { port: number; portSource: PortSource } {
	const strategy = getServerPortStrategy();
	return { port: strategy.port, portSource: strategy.portSource };
}

const RETRY_DELAY_MS = 500;

function formatPortConflictMessage(strategy: PortStrategy): string {
	if (strategy.portSource === "remote-default") {
		const startPort = strategy.attemptPorts[0] ?? DEFAULT_REMOTE_PORT;
		const endPort =
			strategy.attemptPorts[strategy.attemptPorts.length - 1] ??
			DEFAULT_REMOTE_PORT_RANGE_END;
		return `Ports ${startPort}-${endPort} are all in use in remote mode (set PLANNOTATOR_PORT to use an exact port)`;
	}

	if (strategy.portSource === "env") {
		return `Port ${strategy.port} in use after ${strategy.attemptPorts.length} retries`;
	}

	return "Failed to bind an available local port";
}

function isPortInUseError(err: unknown): boolean {
	if (!err || typeof err !== "object") {
		return false;
	}

	const errorWithCode = err as { code?: unknown; message?: unknown };
	const message =
		typeof errorWithCode.message === "string"
			? errorWithCode.message.toLowerCase()
			: "";

	return (
		errorWithCode.code === "EADDRINUSE" ||
		message.includes("eaddrinuse") ||
		message.includes("address already in use")
	);
}

export async function listenOnPort(
	server: Server,
): Promise<{ port: number; portSource: PortSource }> {
	const strategy = getServerPortStrategy();

	for (let attemptIndex = 0; attemptIndex < strategy.attemptPorts.length; attemptIndex++) {
		const attemptPort = strategy.attemptPorts[attemptIndex]!;

		try {
			await new Promise<void>((resolve, reject) => {
				server.once("error", reject);
				server.listen(
					attemptPort,
					isRemoteSession() ? "0.0.0.0" : "127.0.0.1",
					() => {
						server.removeListener("error", reject);
						resolve();
					},
				);
			});
			const addr = server.address() as { port: number };
			return { port: addr.port, portSource: strategy.portSource };
		} catch (err: unknown) {
			const isAddressInUse = isPortInUseError(err);
			if (isAddressInUse && attemptIndex < strategy.attemptPorts.length - 1) {
				const nextPort = strategy.attemptPorts[attemptIndex + 1];
				if (nextPort === attemptPort) {
					await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
				}
				continue;
			}
			if (isAddressInUse) {
				throw new Error(formatPortConflictMessage(strategy));
			}
			throw err;
		}
	}

	throw new Error("Failed to bind port");
}

/**
 * Open URL in system browser (Node-compatible, no Bun $ dependency).
 * Honors PLANNOTATOR_BROWSER and BROWSER env vars.
 * Returns { opened: true } if browser was opened, { opened: false, isRemote: true, url } if remote session.
 */
export function openBrowser(url: string): {
	opened: boolean;
	isRemote?: boolean;
	url?: string;
} {
	const browser = process.env.PLANNOTATOR_BROWSER || process.env.BROWSER;
	if (isRemoteSession() && !browser) {
		return { opened: false, isRemote: true, url };
	}

	try {
		const platform = process.platform;
		const wsl =
			platform === "linux" && release().toLowerCase().includes("microsoft");

		let cmd: string;
		let args: string[];

		if (browser) {
			if (process.env.PLANNOTATOR_BROWSER && platform === "darwin") {
				cmd = "open";
				args = ["-a", browser, url];
			} else if (platform === "win32" || wsl) {
				cmd = "cmd.exe";
				args = ["/c", "start", "", browser, url];
			} else {
				cmd = browser;
				args = [url];
			}
		} else if (platform === "win32" || wsl) {
			cmd = "cmd.exe";
			args = ["/c", "start", "", url];
		} else if (platform === "darwin") {
			cmd = "open";
			args = [url];
		} else {
			cmd = "xdg-open";
			args = [url];
		}

		const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
		child.once("error", () => {});
		child.unref();
		return { opened: true };
	} catch {
		return { opened: false };
	}
}
