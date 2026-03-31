import { afterEach, describe, expect, test } from "bun:test";
import { hasBrowserOverride, shouldAutoOpenBrowser } from "./browser";

const envKeys = ["PLANNOTATOR_BROWSER", "BROWSER"];
const savedEnv: Record<string, string | undefined> = {};

function clearEnv() {
  for (const key of envKeys) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
}

afterEach(() => {
  for (const key of envKeys) {
    if (savedEnv[key] !== undefined) {
      process.env[key] = savedEnv[key];
    } else {
      delete process.env[key];
    }
  }
});

describe("hasBrowserOverride", () => {
  test("false when no browser env vars are set", () => {
    clearEnv();
    expect(hasBrowserOverride()).toBe(false);
  });

  test("true when PLANNOTATOR_BROWSER is set", () => {
    clearEnv();
    process.env.PLANNOTATOR_BROWSER = "Google Chrome";
    expect(hasBrowserOverride()).toBe(true);
  });

  test("true when only BROWSER is set", () => {
    clearEnv();
    process.env.BROWSER = "/tmp/open-helper.sh";
    expect(hasBrowserOverride()).toBe(true);
  });
});

describe("shouldAutoOpenBrowser", () => {
  test("local sessions auto-open by default", () => {
    clearEnv();
    expect(shouldAutoOpenBrowser(false)).toBe(true);
  });

  test("remote sessions skip auto-open when no override is configured", () => {
    clearEnv();
    expect(shouldAutoOpenBrowser(true)).toBe(false);
  });

  test("remote sessions still auto-open with PLANNOTATOR_BROWSER", () => {
    clearEnv();
    process.env.PLANNOTATOR_BROWSER = "Google Chrome";
    expect(shouldAutoOpenBrowser(true)).toBe(true);
  });

  test("remote sessions still auto-open with BROWSER helper", () => {
    clearEnv();
    process.env.BROWSER = "/tmp/vscode-open.sh";
    expect(shouldAutoOpenBrowser(true)).toBe(true);
  });
});
