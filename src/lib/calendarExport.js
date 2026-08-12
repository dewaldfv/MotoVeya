// Generates iCalendar (.ics) files compatible with Google Calendar, Apple Calendar, and Outlook.

function pad(n) {
  return String(n).padStart(2, '0');
}

function toIcsDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function escapeIcs(text) {
  if (text == null) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// ICS spec requires lines ≤75 octets; fold with a leading space.
function foldLine(line) {
  if (line.length <= 75) return line;
  const chunks = [];
  let i = 0;
  while (i < line.length) {
    chunks.push(line.slice(i, i + 73));
    i += 73;
  }
  return chunks.join('\r\n ');
}

function buildVEvent(ev, now) {
  const start = new Date(ev.event_date);
  // Use the stored end_date (multi-day rallies) or default to a 3-hour block.
  const end = ev.end_date ? new Date(ev.end_date) : new Date(start.getTime() + 3 * 60 * 60 * 1000);
  const lines = [
    'BEGIN:VEVENT',
    `UID:${ev.id}@motogo.app`,
    `DTSTAMP:${toIcsDate(now)}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escapeIcs(ev.title)}`,
  ];
  if (ev.venue_name) lines.push(`LOCATION:${escapeIcs(ev.venue_name)}`);
  if (ev.lat != null && ev.lng != null) lines.push(`GEO:${ev.lat};${ev.lng}`);
  const descParts = [];
  if (ev.description) descParts.push(ev.description);
  if (ev.category) descParts.push(`Category: ${ev.category.replace(/_/g, ' ')}`);
  if (ev.entry_fee_zar === 0) descParts.push('Entry: Free');
  else if (ev.entry_fee_zar > 0) descParts.push(`Entry: R${ev.entry_fee_zar}`);
  if (ev.contact_phone) descParts.push(`Contact: ${ev.contact_phone}`);
  if (descParts.length) lines.push(`DESCRIPTION:${escapeIcs(descParts.join('\n'))}`);
  if (ev.booking_link) lines.push(`URL:${escapeIcs(ev.booking_link)}`);
  lines.push('END:VEVENT');
  return lines.map(foldLine).join('\r\n');
}

export function buildIcs(events) {
  const list = Array.isArray(events) ? events : [events];
  const now = new Date();
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MotoVeya//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ].join('\r\n');
  const body = list.map((ev) => buildVEvent(ev, now)).join('\r\n');
  return `${header}\r\n${body}\r\nEND:VCALENDAR\r\n`;
}

export function downloadIcs(events, filename = 'motogo-events') {
  const ics = buildIcs(events);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}