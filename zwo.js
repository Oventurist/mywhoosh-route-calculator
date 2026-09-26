// zwo.js — parse Zwift-style .zwo workout files.
// Regex-based attribute parsing (the format is flat: <workout> children
// with attributes only). No DOMParser, no dependencies: runs in browsers
// and under node --test unchanged.
//
// Power rule (per spec): a numeric power value > 2 is explicit watts,
// otherwise it is a fraction of the effective FTP. File-level
// <ftpOverride> (element or workout_file attribute) wins over passed ftp
// for percent segments only.

const KNOWN = new Set([
  'Warmup',
  'Cooldown',
  'SteadyState',
  'IntervalsT',
  'Ramp',
  'FreeRide',
]);

function parseAttrs(s) {
  const attrs = {};
  const re = /(\w+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    attrs[m[1]] = m[3] !== undefined ? m[3] : m[4];
  }
  return attrs;
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

// Missing power resolves to 0 W: conservative (slows the estimate, so a
// route can only drop out of the list, never strand the rider).
function resolvePower(raw, ftp) {
  const v = num(raw);
  if (v === undefined) return 0;
  return v > 2 ? v : v * ftp;
}

function avgEnds(attrs, ftp) {
  const lo = num(attrs.PowerLow);
  const hi = num(attrs.PowerHigh);
  if (lo === undefined && hi === undefined) return 0;
  const a = lo === undefined ? hi : lo;
  const b = hi === undefined ? lo : hi;
  const mean = (a + b) / 2;
  return mean > 2 ? mean : mean * ftp;
}

export function parseZwo(xmlString, { ftp, freeridePct = 70 } = {}) {
  if (typeof xmlString !== 'string' || !xmlString.includes('<workout')) {
    throw new Error('parseZwo: no <workout> block found');
  }

  let effFtp = ftp;
  const el = /<ftpOverride>\s*([\d.]+)\s*<\/ftpOverride>/i.exec(xmlString);
  if (el) {
    effFtp = parseFloat(el[1]);
  } else {
    const root = /<workout_file\b([^>]*)>/i.exec(xmlString);
    if (root) {
      const n = num(parseAttrs(root[1]).ftpOverride);
      if (n !== undefined) effFtp = n;
    }
  }
  if (!Number.isFinite(effFtp)) {
    throw new Error('parseZwo: a finite ftp is required (or ftpOverride in the file)');
  }

  const fr = Number.isFinite(freeridePct) ? freeridePct : 70;

  const nameMatch = /<name>\s*([^<]*?)\s*<\/name>/i.exec(xmlString);
  const name = nameMatch ? nameMatch[1] : '';

  const bodyMatch = /<workout\b[^>]*>([\s\S]*?)<\/workout>/i.exec(xmlString);
  const body = bodyMatch ? bodyMatch[1] : '';

  const segments = [];
  let totalSeconds = 0;
  let wattSeconds = 0;
  let freerideSeconds = 0;

  const push = (type, seconds, watts) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const w = Math.round(watts * 100) / 100;
    segments.push({ type, seconds, watts: w });
    totalSeconds += seconds;
    wattSeconds += seconds * w;
  };

  const tagRe = /<(\w+)\b([^>]*?)\/?>/g;
  let t;
  while ((t = tagRe.exec(body)) !== null) {
    const tag = t[1];
    if (tag === 'textevent') continue;
    const a = parseAttrs(t[2]);
    const dur = num(a.Duration);

    if (tag === 'IntervalsT') {
      let repeat = parseInt(a.Repeat, 10);
      if (!Number.isFinite(repeat) || repeat < 1) repeat = 1;
      const onDur = num(a.OnDuration) || 0;
      const offDur = num(a.OffDuration) || 0;
      const onW = resolvePower(a.OnPower, effFtp);
      const offW = resolvePower(a.OffPower, effFtp);
      const secs = repeat * (onDur + offDur);
      const avg = secs > 0 ? (repeat * (onDur * onW + offDur * offW)) / secs : 0;
      push('IntervalsT', secs, avg);
      continue;
    }

    if (dur === undefined || dur <= 0) {
      console.warn(`parseZwo: skipping <${tag}> with missing/non-positive Duration`);
      continue; // missing-Duration: skip
    }
    if (tag === 'FreeRide') {
      const w =
        a.Power !== undefined || a.PowerLow !== undefined
          ? avgEnds({ PowerLow: a.Power ?? a.PowerLow, PowerHigh: a.Power ?? a.PowerHigh }, effFtp)
          : (fr / 100) * effFtp;
      push('FreeRide', dur, w);
      freerideSeconds += dur;
    } else if (tag === 'Warmup' || tag === 'Cooldown' || tag === 'Ramp') {
      push(tag, dur, avgEnds(a, effFtp));
    } else if (tag === 'SteadyState') {
      push(tag, dur, resolvePower(a.Power, effFtp));
    } else {
      // Unknown future tag: count its time at 0 W rather than hiding it.
      push(tag, dur, 0);
    }
  }

  return {
    name,
    totalSeconds,
    avgWatts: totalSeconds > 0 ? Math.round((wattSeconds / totalSeconds) * 100) / 100 : 0,
    freerideSeconds,
    segments,
  };
}
