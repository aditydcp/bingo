// Sound effects, vibration and background music. Browser only.
// Everything is synthesized with Web Audio (no audio files to download). Each channel has its
// own on/off setting, saved per device. Browsers only allow audio after a tap, so the first
// tap anywhere unlocks it (see unlockAudio).
import { useEffect, useState } from "react";

const KEY = "piknik-bingo-feedback";
const DEFAULTS = { sound: true, vibration: true, music: false };

let settings = { ...DEFAULTS };
const listeners = new Set();

function load() {
  try {
    settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    settings = { ...DEFAULTS };
  }
}

export const canVibrate = () => typeof navigator !== "undefined" && "vibrate" in navigator;

export function setSetting(name, on) {
  settings = { ...settings, [name]: on };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // private mode: keep for this visit only
  }
  if (name === "music") (on ? startMusic : stopMusic)();
  if (name === "vibration" && on) buzz("tap");
  if (name === "sound" && on) play("toggle");
  listeners.forEach((fn) => fn(settings));
}

// [settings, toggle(name)] — also starts the music if it was left on
export function useFeedback() {
  const [state, setState] = useState(DEFAULTS);
  useEffect(() => {
    load();
    setState(settings);
    listeners.add(setState);
    const unlock = () => {
      unlockAudio();
      if (settings.music) startMusic();
    };
    const onVisibility = () => {
      if (document.hidden) stopMusic();
      else if (settings.music && ctx) startMusic();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      listeners.delete(setState);
      window.removeEventListener("pointerdown", unlock);
      document.removeEventListener("visibilitychange", onVisibility);
      stopMusic();
    };
  }, []);
  return [state, (name) => setSetting(name, !settings[name])];
}

// ── Vibration ────────────────────────────────────────────────────────
const PATTERNS = {
  tap: 12,
  success: [30, 40, 30],
  error: [80, 60, 80],
  line: [60, 40, 60],
  bingo: [120, 60, 120, 60, 240],
  full: [150, 70, 150, 70, 150, 70, 400],
  reroll: [20, 30, 20, 30, 20],
};

export function buzz(name) {
  if (!settings.vibration || !canVibrate()) return;
  try {
    navigator.vibrate(PATTERNS[name] ?? name);
  } catch {
    // some browsers throw without a recent user gesture
  }
}

// ── Audio plumbing ───────────────────────────────────────────────────
let ctx;
let sfxBus;
let musicBus;

export function unlockAudio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.35;
    sfxBus.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.09;
    musicBus.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// One enveloped note: quick attack, exponential decay
function note(bus, midi, at, dur, { type = "triangle", vol = 1, glideTo } = {}) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(hz(midi), at);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(hz(glideTo), at + dur);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(vol, at + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(env).connect(bus);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

// ── Sound effects ────────────────────────────────────────────────────
// Each effect: list of [semitone offset from C5 (72), start beat, length beat, options]
const C5 = 72;
const SFX = {
  tap: { beat: 0.05, notes: [[19, 0, 1.2]] },
  toggle: { beat: 0.05, notes: [[12, 0, 1], [19, 1, 1.5]] },
  success: { beat: 0.07, notes: [[7, 0, 1.5], [19, 1, 3]] },
  error: { beat: 0.12, notes: [[-5, 0, 1.4, { type: "square", vol: 0.4 }], [-10, 1.5, 2, { type: "square", vol: 0.4 }]] },
  line: { beat: 0.08, notes: [[0, 0, 1], [4, 1, 1], [7, 2, 1], [12, 3, 3]] },
  bingo: {
    beat: 0.11,
    notes: [
      [0, 0, 1], [4, 1, 1], [7, 2, 1], [12, 3, 2],
      [7, 5, 1], [12, 6, 6], [16, 6, 6, { vol: 0.6 }], [19, 6, 6, { vol: 0.5 }],
    ],
  },
  full: {
    beat: 0.1,
    notes: [
      [0, 0, 1], [4, 1, 1], [7, 2, 1], [12, 3, 1], [16, 4, 1], [19, 5, 1], [24, 6, 3],
      [19, 9, 1], [24, 10, 8], [28, 10, 8, { vol: 0.6 }], [31, 10, 8, { vol: 0.5 }],
      [12, 10, 8, { type: "sine", vol: 0.7 }],
    ],
  },
  reroll: { beat: 0.045, shuffle: true },
};
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19];

export function play(name) {
  if (!settings.sound) return;
  const c = unlockAudio();
  if (!c) return;
  const fx = SFX[name];
  const t0 = c.currentTime + 0.02;
  const notes = fx.shuffle
    ? Array.from({ length: 8 }, (_, i) => [PENTA[Math.floor(Math.random() * PENTA.length)], i, 1])
    : fx.notes;
  notes.forEach(([semi, start, len, opts]) =>
    note(sfxBus, C5 + semi, t0 + start * fx.beat, len * fx.beat + 0.05, opts),
  );
  if (musicBus && (name === "bingo" || name === "full")) duckMusic(fx.beat * 16);
}

// ── Background music ─────────────────────────────────────────────────
// A light 8-bar loop in C major (C–G–Am–F), 112 bpm, scheduled a little ahead of time.
const BPM = 112;
const STEP = 60 / BPM / 2; // eighth notes
const CHORDS = [
  [48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48],
  [48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48],
];
// 8 eighths per bar, MIDI or null (rest)
const MELODY = [
  [76, null, 79, null, 81, 79, 76, null],
  [74, null, 71, 74, 79, null, null, null],
  [72, null, 76, null, 81, null, 79, 76],
  [77, null, 76, 74, 72, null, null, null],
  [76, 79, 81, 79, 84, null, 81, null],
  [79, null, 74, null, 71, 74, 79, null],
  [81, null, 79, 76, 72, null, 76, 79],
  [77, 76, 74, 72, 74, null, 72, null],
];
let musicTimer = null;
let nextStepTime = 0;
let step = 0;

function scheduleStep(i, at) {
  const bar = Math.floor(i / 8) % CHORDS.length;
  const beat = i % 8;
  const chord = CHORDS[bar];
  if (beat === 0 || beat === 4) note(musicBus, chord[0] - 12, at, STEP * 3, { type: "sine", vol: 0.9 });
  if (beat % 2 === 1) chord.forEach((m) => note(musicBus, m + 12, at, STEP * 0.8, { type: "triangle", vol: 0.18 }));
  const m = MELODY[bar][beat];
  if (m) note(musicBus, m, at, STEP * 1.6, { type: "square", vol: 0.16 });
  if (beat % 2 === 0) note(musicBus, 96, at, 0.03, { type: "square", vol: 0.04 }); // tick
}

export function startMusic() {
  if (musicTimer || !settings.music || document.hidden) return;
  const c = unlockAudio();
  if (!c) return;
  nextStepTime = c.currentTime + 0.1;
  musicTimer = setInterval(() => {
    while (nextStepTime < c.currentTime + 0.2) {
      scheduleStep(step++, nextStepTime);
      nextStepTime += STEP;
    }
  }, 50);
}

export function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}

function duckMusic(seconds) {
  const g = musicBus.gain;
  const t = ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(0.02, t);
  g.linearRampToValueAtTime(0.09, t + seconds + 0.5);
}

// Sound + vibration for one game moment
export function feedback(name) {
  play(name);
  buzz(name);
}
