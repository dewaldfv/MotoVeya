/**
 * Global registry for open overlay surfaces (BottomSheet + shadcn Dialog).
 *
 * When an overlay opens it pushes a sentinel history entry, so the hardware /
 * browser Back button pops that sentinel (firing `popstate`) instead of
 * navigating to the previous route. The popstate handler then closes the
 * topmost overlay, keeping the user on the current page — mirroring the
 * native mobile expectation that Back dismisses a sheet before leaving.
 */

let idCounter = 0;
const stack = [];
let suppressNextPop = false;

export function nextOverlayId() {
  return ++idCounter;
}

export function registerOverlay(id, close) {
  if (stack.find((o) => o.id === id)) return;
  stack.push({ id, close });
  try {
    window.history.pushState({ __motoveya_overlay: id }, '');
  } catch (_) {
    /* history unavailable — registry still tracks the close fn */
  }
}

export function unregisterOverlay(id) {
  const idx = stack.findIndex((o) => o.id === id);
  if (idx === -1) return;
  stack.splice(idx, 1);
  // Remove the sentinel entry we pushed, but only if it is still current.
  try {
    const st = window.history.state;
    if (st && st.__motoveya_overlay === id) {
      suppressNextPop = true;
      window.history.back();
    }
  } catch (_) {
    /* noop */
  }
}

export function closeTopOverlay() {
  if (suppressNextPop) {
    suppressNextPop = false;
    return false;
  }
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}