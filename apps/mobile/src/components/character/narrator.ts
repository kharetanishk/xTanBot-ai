import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import { Asset } from "expo-asset";
import { Audio } from "expo-av";
import lines from "../../../assets/narration/lines.json";
import { NARRATION_AUDIO } from "./narration.generated";

/**
 * xTan's landing-page narrator: one voice, one line at a time.
 *
 * Sections report what's on screen (`setSection` / `setChapter`); the narrator keeps a
 * single-slot queue so lines never overlap or cut each other off:
 *   - a new line waits for the current one to finish, then a short breath (GAP_MS);
 *   - if you scroll past several points quickly, only the latest one is spoken.
 * Audio is pre-recorded with ElevenLabs (scripts/generate-narration.mjs).
 */
export type LineId = keyof typeof lines;
export const LINES = lines as Record<LineId, { say: string; show: string }>;

/** Page sections in order → the line spoken while each is centred (story chapters set their own). */
const SECTION_LINES: (LineId | null)[] = ["hero", "marquee", null, "how", "callees", "stats", "faq", "final"];
const GAP_MS = 450;

type State = {
  soundOn: boolean;
  /** Line for whatever is centred on screen right now. */
  focus: LineId;
  /** Line currently being heard (null between lines). */
  speaking: LineId | null;
  /** 0..1 loudness of the playing clip (web) — drives lip-sync. */
  level: number;
  /** True when `level` is real (Web Audio analyser available); otherwise lips use the flap. */
  metered: boolean;
};

let state: State = { soundOn: false, focus: "hero", speaking: null, level: 0, metered: false };
let section = 0;
let chapter: LineId = "ch-calls";
let pending: LineId | null = null;
let busy = false;
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useNarrator<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => select(state),
    () => select(state),
  );
}

function refocus() {
  const next = SECTION_LINES[section] ?? chapter;
  if (next === state.focus) return;
  set({ focus: next });
  if (state.soundOn) enqueue(next);
}

export const narrator = {
  setSection(i: number) {
    if (i === section) return;
    section = i;
    refocus();
  },
  setChapter(id: LineId) {
    chapter = id;
    if (SECTION_LINES[section] === null) refocus();
  },
  /** Must be called from a tap/click: browsers only allow audio after a user gesture. */
  async enable() {
    await unlockAudio();
    set({ soundOn: true });
    enqueue(state.focus);
  },
  disable() {
    pending = null;
    stopAudio();
    busy = false;
    set({ soundOn: false, speaking: null, level: 0 });
  },
};

function enqueue(id: LineId) {
  pending = id;
  if (!busy) void pump();
}

async function pump() {
  if (!pending || !state.soundOn) return;
  busy = true;
  const id = pending;
  pending = null;
  set({ speaking: id });
  await playClip(id);
  set({ speaking: null, level: 0 });
  // A short breath before the next line so points are clearly separated.
  await new Promise((r) => setTimeout(r, GAP_MS));
  busy = false;
  if (pending && state.soundOn) void pump();
}

// ── Playback: HTMLAudio + analyser on web (for lip-sync), expo-av on iOS/Android ──

let el: HTMLAudioElement | null = null;
let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let meter: ReturnType<typeof setInterval> | null = null;
let nativeSound: Audio.Sound | null = null;
let finishCurrent: (() => void) | null = null;

async function unlockAudio() {
  if (Platform.OS !== "web") {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    return;
  }
  if (!el) {
    // (expo-av's `Audio` shadows the DOM one, so create the element directly)
    const audioEl = document.createElement("audio");
    audioEl.crossOrigin = "anonymous";
    el = audioEl;
    try {
      ctx = new AudioContext();
      const src = ctx.createMediaElementSource(audioEl);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      analyser.connect(ctx.destination);
    } catch {
      ctx = null; // no Web Audio → audio still plays, lips use the fallback flap
    }
  }
  await ctx?.resume();
  set({ metered: !!analyser });
}

function playClip(id: LineId): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (meter) clearInterval(meter);
      meter = null;
      finishCurrent = null;
      resolve();
    };
    finishCurrent = finish;
    const mod = NARRATION_AUDIO[id];

    if (Platform.OS === "web" && el) {
      el.src = Asset.fromModule(mod).uri;
      el.onended = finish;
      el.onerror = finish;
      el.play().catch(finish);
      if (analyser) {
        const buf = new Float32Array(analyser.fftSize);
        meter = setInterval(() => {
          analyser!.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
          set({ level: Math.round(Math.sqrt(sum / buf.length) * 100) / 100 });
        }, 60);
      }
      return;
    }

    void (async () => {
      try {
        await nativeSound?.unloadAsync();
        const { sound } = await Audio.Sound.createAsync(mod, { shouldPlay: true });
        nativeSound = sound;
        sound.setOnPlaybackStatusUpdate((st) => {
          if (!st.isLoaded || st.didJustFinish) finish();
        });
      } catch {
        finish();
      }
    })();
  });
}

function stopAudio() {
  if (el) {
    el.pause();
    el.removeAttribute("src");
  }
  void nativeSound?.stopAsync().catch(() => undefined);
  finishCurrent?.();
}
