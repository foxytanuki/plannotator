---
title: "Remote & Devcontainers"
description: "Using Plannotator over SSH, in VS Code Remote, devcontainers, and Docker."
sidebar:
  order: 20
section: "Guides"
---

Plannotator works in remote environments — SSH sessions, VS Code Remote, devcontainers, and Docker. The browser can't auto-open on a headless server, so remote mode prints the URL and uses a predictable port range for forwarding.

## Remote mode

Set `PLANNOTATOR_REMOTE=1` to enable remote mode:

```bash
export PLANNOTATOR_REMOTE=1
export PLANNOTATOR_PORT=9999  # Optional: exact port if you want to pin forwarding
```

Remote mode changes two behaviors:

1. **Predictable port range** — Uses `19432-19439` by default instead of a random port, so you can set up port forwarding once
2. **No browser auto-open** — Prints the URL to the terminal instead of trying to open a browser

If you forward only one remote port, set `PLANNOTATOR_PORT` to that exact port. Plannotator then retries that port repeatedly instead of falling back across the remote range.

### Legacy detection

Plannotator also detects `SSH_TTY` and `SSH_CONNECTION` environment variables for automatic remote mode. However, `PLANNOTATOR_REMOTE=1` is preferred for explicit control.

## VS Code Remote / devcontainers

VS Code sets the `BROWSER` environment variable in devcontainers to a helper script that opens URLs on your local machine. Plannotator respects this — in most cases, the browser opens automatically with no extra configuration.

If the automatic `BROWSER` detection doesn't work for your setup, you can fall back to manual remote mode:

1. Set the environment variables in your devcontainer config:

```json
{
  "containerEnv": {
    "PLANNOTATOR_REMOTE": "1",
    "PLANNOTATOR_PORT": "9999"
  },
  "forwardPorts": [9999]
}
```

2. When Plannotator opens, check the VS Code **Ports** tab — the port should be automatically forwarded
3. Open the printed URL in your local browser

## SSH port forwarding

For direct SSH connections, forward the port in your `~/.ssh/config`:

```
Host your-server
    LocalForward 9999 localhost:9999
```

Or forward ad-hoc when connecting:

```bash
ssh -L 9999:localhost:9999 your-server
```

If you're only forwarding one port like `9999`, set `PLANNOTATOR_PORT=9999` so Plannotator retries that exact port instead of the default `19432-19439` range.

Then open `http://localhost:9999` locally when Plannotator prints the URL.

## Docker (without VS Code)

For standalone Docker containers, expose the port and set environment variables:

```dockerfile
ENV PLANNOTATOR_REMOTE=1
ENV PLANNOTATOR_PORT=9999
EXPOSE 9999
```

Or via `docker run`:

```bash
docker run -e PLANNOTATOR_REMOTE=1 -e PLANNOTATOR_PORT=9999 -p 9999:9999 your-image
```

## Custom browser

The `PLANNOTATOR_BROWSER` environment variable lets you specify a custom browser or script for opening the UI.

**macOS** — Set to an app name or path:

```bash
export PLANNOTATOR_BROWSER="Google Chrome"
# or
export PLANNOTATOR_BROWSER="/Applications/Firefox.app"
```

**Linux** — Set to an executable path:

```bash
export PLANNOTATOR_BROWSER="/usr/bin/firefox"
```

**Windows / WSL** — Set to an executable:

```bash
export PLANNOTATOR_BROWSER="chrome.exe"
```

You can also point `PLANNOTATOR_BROWSER` at a custom script that handles URL opening in your specific environment — for example, a script that opens the URL on a different machine or sends a notification with the link.
