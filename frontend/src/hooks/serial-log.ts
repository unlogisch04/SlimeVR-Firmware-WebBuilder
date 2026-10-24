import { useSyncExternalStore } from "react";

const MAX_LINES = 500;

let lines: string[] = [];
let partial = "";
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

const commit = () => {
  if (lines.length > MAX_LINES) lines = lines.slice(-MAX_LINES);
  lines = [...lines];
  emit();
};

export const serialLog = {
  line(text: string) {
    if (partial) {
      text = partial + text;
      partial = "";
    }
    lines.push(text);
    commit();
  },
  // Text without a trailing newline, e.g. esptool progress dots
  write(text: string) {
    partial += text;
    commit();
  },
  // Replaces the unfinished line currently shown at the end
  setTail(text: string) {
    partial = text;
    commit();
  },
  clear() {
    lines = [];
    partial = "";
    emit();
  },
  get snapshot() {
    return lines;
  },
  get partial() {
    return partial;
  },
};

export function useSerialLog() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => lines,
  );
}
