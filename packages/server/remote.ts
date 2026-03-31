/**
 * Remote session detection and port configuration
 *
 * Environment variables:
 *   PLANNOTATOR_REMOTE - Set to "1" or "true" to force remote mode (preferred)
 *   PLANNOTATOR_PORT   - Exact port to use (default: random locally, 19432-19439 fallback remotely)
 *
 * Legacy (still supported): SSH_TTY, SSH_CONNECTION
 */

const DEFAULT_REMOTE_PORT = 19432;
const DEFAULT_REMOTE_PORT_RANGE_END = 19439;
const EXACT_PORT_RETRY_COUNT = 5;

export type ServerPortSource = "env" | "remote-default" | "random";

export interface ServerPortStrategy {
  port: number;
  portSource: ServerPortSource;
  attemptPorts: number[];
}

function parseConfiguredPort(): number | null {
  const envPort = process.env.PLANNOTATOR_PORT;
  if (!envPort) {
    return null;
  }

  const parsed = parseInt(envPort, 10);
  if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
    return parsed;
  }

  console.error(
    `[Plannotator] Warning: Invalid PLANNOTATOR_PORT "${envPort}", using default`
  );
  return null;
}

/**
 * Check if running in a remote session (SSH, devcontainer, etc.)
 */
export function isRemoteSession(): boolean {
  // New preferred env var
  const remote = process.env.PLANNOTATOR_REMOTE;
  if (remote === "1" || remote?.toLowerCase() === "true") {
    return true;
  }

  // Legacy: SSH_TTY/SSH_CONNECTION (deprecated, silent)
  if (process.env.SSH_TTY || process.env.SSH_CONNECTION) {
    return true;
  }

  return false;
}

/**
 * Get the server port strategy to use
 */
export function getServerPortStrategy(): ServerPortStrategy {
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
        (_, index) => DEFAULT_REMOTE_PORT + index
      ),
    };
  }

  return {
    port: 0,
    portSource: "random",
    attemptPorts: [0],
  };
}

/**
 * Get the preferred server port to use
 */
export function getServerPort(): number {
  return getServerPortStrategy().port;
}

export function formatPortConflictMessage(
  strategy: ServerPortStrategy
): string {
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

export function isPortInUseError(err: unknown): boolean {
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
