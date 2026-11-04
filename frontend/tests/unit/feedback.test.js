// Sound / vibration / music settings and gating
import { describe, it, expect, vi, beforeEach } from "vitest";

const store = {};
const vibrate = vi.fn();
vi.stubGlobal("localStorage", {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => (store[k] = v),
});
vi.stubGlobal("navigator", { vibrate });
vi.stubGlobal("window", {}); // no AudioContext: audio calls must be harmless no-ops
vi.stubGlobal("document", { hidden: false });

const fb = await import("../../src/lib/feedback");

beforeEach(() => {
  vibrate.mockClear();
  fb.setSetting("sound", true);
  fb.setSetting("vibration", true);
  fb.setSetting("music", false);
  vibrate.mockClear();
});

describe("settings", () => {
  it("saves each toggle on this device", () => {
    fb.setSetting("music", true);
    fb.setSetting("vibration", false);
    expect(JSON.parse(store["piknik-bingo-feedback"])).toEqual({ sound: true, vibration: false, music: true });
    fb.stopMusic();
  });

  it("reports vibration support", () => {
    expect(fb.canVibrate()).toBe(true);
  });
});

describe("vibration", () => {
  it("vibrates with the pattern for each game moment", () => {
    fb.buzz("bingo");
    expect(vibrate).toHaveBeenCalledWith([120, 60, 120, 60, 240]);
    fb.feedback("tap");
    expect(vibrate).toHaveBeenLastCalledWith(12);
  });

  it("stays still when vibration is off", () => {
    fb.setSetting("vibration", false);
    fb.feedback("full");
    fb.buzz("error");
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("gives a short buzz when vibration is switched on", () => {
    fb.setSetting("vibration", false);
    fb.setSetting("vibration", true);
    expect(vibrate).toHaveBeenCalledWith(12);
  });

  it("survives browsers that throw from vibrate()", () => {
    vibrate.mockImplementationOnce(() => {
      throw new Error("no gesture");
    });
    expect(() => fb.buzz("tap")).not.toThrow();
  });
});

describe("audio without Web Audio support", () => {
  it("sound effects and music are silent no-ops", () => {
    expect(() => fb.play("bingo")).not.toThrow();
    expect(() => fb.setSetting("music", true)).not.toThrow();
    fb.stopMusic();
  });
});
