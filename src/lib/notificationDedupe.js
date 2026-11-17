// Session-wide record of which chat alerts have already been shown on this
// device. A single message can reach the app through more than one path (the
// server's Notification record and the conversation poll) — both build the
// same stable key from the conversation id plus the message timestamp, so the
// second arrival is suppressed instead of alerting the rider again.
const shownAlerts = new Set();
const MAX_KEYS = 500;

// Stable identity of one chat message: its conversation plus when it was sent.
export function messageAlertKey({ conversationId, messageAt }) {
  if (!conversationId || !messageAt) return null;
  return `chat:${conversationId}:${messageAt}`;
}

// True when this alert key has already been shown on this device.
export function hasAlert(key) {
  return !!key && shownAlerts.has(key);
}

// Returns true the first time an alert key is seen, false for any repeat.
export function claimAlert(key) {
  if (!key) return true;
  if (shownAlerts.has(key)) return false;
  shownAlerts.add(key);
  if (shownAlerts.size > MAX_KEYS) {
    const oldest = shownAlerts.values().next().value;
    shownAlerts.delete(oldest);
  }
  return true;
}