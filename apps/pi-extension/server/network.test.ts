import { afterEach, describe, expect, test } from "bun:test";
import { hasBrowserOverride, shouldAutoOpenBrowser } from "./network";

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

describe("pi network browser overrides", () => {
	test("detects no override by default", () => {
		clearEnv();
		expect(hasBrowserOverride()).toBe(false);
	});

	test("detects PLANNOTATOR_BROWSER", () => {
		clearEnv();
		process.env.PLANNOTATOR_BROWSER = "Google Chrome";
		expect(hasBrowserOverride()).toBe(true);
	});

	test("detects BROWSER helper", () => {
		clearEnv();
		process.env.BROWSER = "/tmp/vscode-open.sh";
		expect(hasBrowserOverride()).toBe(true);
	});
});

describe("pi network browser auto-open policy", () => {
	test("local sessions auto-open by default", () => {
		clearEnv();
		expect(shouldAutoOpenBrowser(false)).toBe(true);
	});

	test("remote sessions skip auto-open without an override", () => {
		clearEnv();
		expect(shouldAutoOpenBrowser(true)).toBe(false);
	});

	test("remote sessions allow auto-open with PLANNOTATOR_BROWSER", () => {
		clearEnv();
		process.env.PLANNOTATOR_BROWSER = "Google Chrome";
		expect(shouldAutoOpenBrowser(true)).toBe(true);
	});

	test("remote sessions allow auto-open with BROWSER helper", () => {
		clearEnv();
		process.env.BROWSER = "/tmp/vscode-open.sh";
		expect(shouldAutoOpenBrowser(true)).toBe(true);
	});
});
