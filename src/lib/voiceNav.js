// Builds natural-language navigation instructions from OSRM maneuver data
// and speaks them via the browser SpeechSynthesis API.

export function buildManeuverInstruction(step, destinationName) {
  if (!step?.maneuver) return null;
  const m = step.maneuver;
  const name = (step.name || '').trim();
  const onto = name ? ` onto ${name}` : '';
  const toward = name ? ` toward ${name}` : '';

  if (m.type === 'arrive') return 'You have arrived at your destination';
  if (m.type === 'depart') return null;

  if (m.type === 'roundabout' || m.type === 'rotary' || m.type === 'roundabout turn') {
    return `At the roundabout, take the exit${toward}`;
  }
  if (m.type === 'merge') {
    const dir = dirWord(m.modifier);
    return `Merge${dir ? ` ${dir}` : ''}${onto}`;
  }
  if (m.type === 'fork') {
    return `Keep ${dirWord(m.modifier) || 'straight'}${toward}`;
  }
  if (m.type === 'on ramp') {
    const dir = dirWord(m.modifier);
    return `Take the ramp${dir ? ` ${dir}` : ''}${onto}`;
  }
  if (m.type === 'off ramp' || m.type === 'exit roundabout' || m.type === 'exit rotary') {
    return `Take the exit${onto}`;
  }
  if (m.type === 'end of road') {
    return `${turnWord(m.modifier)}${onto}`;
  }
  if (m.type === 'continue' || m.type === 'new name') {
    return `Continue${onto}`;
  }
  // default: turn
  return `${turnWord(m.modifier)}${onto}`;
}

function dirWord(modifier) {
  switch (modifier) {
    case 'left': return 'left';
    case 'right': return 'right';
    case 'slight left': return 'slight left';
    case 'slight right': return 'slight right';
    case 'sharp left': return 'sharp left';
    case 'sharp right': return 'sharp right';
    case 'straight': return 'straight';
    default: return '';
  }
}

function turnWord(modifier) {
  switch (modifier) {
    case 'left': return 'Turn left';
    case 'right': return 'Turn right';
    case 'slight left': return 'Bear left';
    case 'slight right': return 'Bear right';
    case 'sharp left': return 'Turn sharp left';
    case 'sharp right': return 'Turn sharp right';
    case 'uturn': return 'Make a U-turn';
    case 'straight': return 'Continue straight';
    default: return 'Continue';
  }
}

export function speak(text) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en';
    u.rate = 0.95;
    u.pitch = 1;
    u.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const en = voices.find((v) => /^en/i.test(v.lang));
    if (en) u.voice = en;
    window.speechSynthesis.speak(u);
  } catch (e) {
    // ignore — speech unavailable
  }
}