const listeners = new Set();
let active = false;

export function setRideActive(v) {
  if (active === v) return;
  active = v;
  listeners.forEach((l) => l(active));
}

export function subscribeRideActive(fn) {
  listeners.add(fn);
  fn(active);
  return () => listeners.delete(fn);
}