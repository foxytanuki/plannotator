# Remote share URL output: decouple generation from presentation

## Context

Remote share URL generation currently lives in `packages/server/share-url.ts`.

`writeRemoteShareLink()` does three things at once:

1. generates the share URL
2. formats user-facing copy
3. writes directly to `stderr`

That is acceptable in the Claude Code hook CLI, where stdout is reserved for hook protocol output and human-facing status text belongs on stderr. It is not a good abstraction for OpenCode.

## Problem

In OpenCode, `stderr` is not the product's primary user notification surface.

Direct writes from shared server code bypass the host adapter and can cause host-specific formatting problems. The proper presentation surface in OpenCode is the app/client logging API, e.g. `client.app.log(...)`.

So the issue is not just that stderr is ugly; it is that shared code is taking responsibility for presentation.

## Goal

Make remote share URL handling host-aware without duplicating share URL generation logic.

## Proposed direction

Split the current abstraction into:

### Shared/pure layer

Keep these concerns in `packages/server/share-url.ts`:

- generate remote share URL
- compute size metadata
- optionally format a plain message string

Do **not** write to stdout/stderr from this layer.

Example shape:

```ts
type RemoteShareLink = {
  url: string;
  sizeBytes: number;
  sizeLabel: string;
};

async function createRemoteShareLink(
  content: string,
  shareBaseUrl?: string
): Promise<RemoteShareLink>

function formatRemoteShareMessage(
  link: RemoteShareLink,
  opts: { verb: string; noun: string }
): string
```

### Host presentation layer

Each runtime presents that information in its own way.

#### Claude Code hook

- call `createRemoteShareLink(...)`
- write the formatted message to `stderr`

This preserves the current hook UX and keeps stdout clean for machine-readable output.

#### OpenCode

- call `createRemoteShareLink(...)`
- send the formatted message via `client.app.log({ level: "info", message })`

This uses the host's intended notification surface instead of raw stderr.

## Why this is better

- shared code stays reusable and host-agnostic
- OpenCode can control rendering and avoid stderr formatting issues
- Claude Code keeps its current stderr-based behavior
- the same separation can later be reused for remote port/fallback notices

## Minimal migration plan

1. Add `createRemoteShareLink()` to `packages/server/share-url.ts`
2. Add `formatRemoteShareMessage()` (or equivalent structured formatter)
3. Keep `writeRemoteShareLink()` temporarily as a compatibility wrapper if needed
4. Update `apps/hook/server/index.ts` to present via stderr explicitly
5. Update `apps/opencode-plugin/index.ts` to present via `client.app.log(...)`
6. Update other OpenCode command paths if they also surface remote-share guidance
7. After validation, remove or deprecate `writeRemoteShareLink()`

## Validation plan

Implement first, then verify in OpenCode:

- remote plan review shows a readable share URL message in OpenCode UI
- no broken formatting from stderr passthrough
- Claude Code hook still prints the expected message without polluting stdout
- share URL generation failures remain non-fatal

If the OpenCode behavior looks good after implementation, turn this into an upstream issue describing the abstraction problem and the chosen fix.
