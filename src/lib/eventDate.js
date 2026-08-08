// Formats an event's date as a single date or a "From - To" range when an end_date is set.
// `event_date` is the start; `end_date` (optional) marks the end of multi-day events like rallies.
export function formatEventDateRange(event, style = 'short') {
  if (!event) return '';
  const start = event.event_date || event.start_date;
  if (!start) return '';
  const fmt = (d) =>
    style === 'full'
      ? new Date(d).toLocaleString('en-ZA', { dateStyle: 'full', timeStyle: 'short' })
      : new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  const startStr = fmt(start);
  if (!event.end_date) return startStr;
  return `${startStr} - ${fmt(event.end_date)}`;
}

// True when the event spans multiple days (used to decide range vs single-date display).
export function isMultiDayEvent(event) {
  if (!event?.end_date) return false;
  const start = new Date(event.event_date || event.start_date);
  const end = new Date(event.end_date);
  return end.getTime() > start.getTime();
}