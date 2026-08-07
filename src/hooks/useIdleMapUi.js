import { useSyncExternalStore } from 'react';

const HIDE_DELAY = 5000;

let visible = true;
let timer = null;
const listeners = new Set();

function emit() {
  listeners.forEach((l) => l());
}
function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
function scheduleHide() {
  clearTimer();
  timer = setTimeout(() => {
    visible = false;
    emit();
  }, HIDE_DELAY);
}

export function revealMapUi() {
  visible = true;
  emit();
  scheduleHide();
}

export function toggleMapUi() {
  if (visible) {
    visible = false;
    clearTimer();
    emit();
  } else {
    revealMapUi();
  }
}

export function armMapUiHide() {
  scheduleHide();
}

function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot() {
  return visible;
}

export function useIdleMapUi() {
  const v = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { visible: v, reveal: revealMapUi, toggle: toggleMapUi, arm: armMapUiHide };
}