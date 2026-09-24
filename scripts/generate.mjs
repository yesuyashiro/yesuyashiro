// Generates the animated SVGs used in the profile README.
// Runs daily from .github/workflows/profile.yml. No dependencies (Node 20+).
//   GITHUB_TOKEN=... GH_USER=yesuyashiro node scripts/generate.mjs

import { mkdirSync, writeFileSync } from 'node:fs';

const USER = process.env.GH_USER || 'yesuyashiro';
const TOKEN = process.env.GITHUB_TOKEN;
const OUT = new URL('../assets/', import.meta.url);

const C = {
  bg: '#0a0f14', panel: '#0c1a17', border: '#1f6f55', neon: '#39ff9f',
  cyan: '#5ce1e6', dim: '#5f7f74', text: '#c9f7e4', white: '#eafff6',
  levels: ['#12211d', '#0e4d3a', '#138a5f', '#20c783', '#39ff9f'],
};
const FONT = `font-family="'JetBrains Mono','Fira Code',Consolas,'Courier New',monospace"`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const glow = (id, blur = 2.5) => `
  <filter id="${id}" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur stdDeviation="${blur}" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`;

async function fetchProfile() {
  const query = `query($login: String!) {
    user(login: $login) {
      login name createdAt
      followers { totalCount }
      repositories(privacy: PUBLIC, ownerAffiliations: OWNER) { totalCount }
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount contributionLevel } }
        }
      }
    }
  }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: USER } }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user;
}

/* ---------------- 1. Pixel name header ---------------- */
const FONT5x7 = {
  A: ['01110','10001','10001','11111','10001','10001','10001'],
  E: ['11111','10000','10000','11110','10000','10000','11111'],
  I: ['11111','00100','00100','00100','00100','00100','11111'],
  L: ['10000','10000','10000','10000','10000','10000','11111'],
  O: ['01110','10001','10001','10001','10001','10001','01110'],
  R: ['11110','10001','10001','11110','10100','10010','10001'],
  S: ['01111','10000','10000','01110','00001','00001','11110'],
  U: ['10001','10001','10001','10001','10001','10001','01110'],
  Y: ['10001','10001','01010','00100','00100','00100','00100'],
  ' ': ['00000','00000','00000','00000','00000','00000','00000'],
};

function headerSvg(name, subtitle) {
  const W = 900, H = 190, cell = 8, text = name.toUpperCase();
  const cols = text.length * 6 - 1;
  const x0 = Math.round((W - cols * cell) / 2), y0 = 28;
  let pixels = '';
  [...text].forEach((ch, i) => {
    (FONT5x7[ch] || FONT5x7[' ']).forEach((row, r) => {
      [...row].forEach((bit, c) => {
        if (bit !== '1') return;
        const col = i * 6 + c;
        const delay = (col * 0.018).toFixed(3);
        pixels += `<rect x="${x0 + col * cell}" y="${y0 + r * cell}" width="${cell - 1}" height="${cell - 1}" rx="1" fill="${C.neon}" opacity="0">
          <animate attributeName="opacity" from="0" to="1" begin="${delay}s" dur="0.25s" fill="freeze"/></rect>`;
      });
    });
  });
  const subW = subtitle.length * 10.2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(name)}">
  <defs>${glow('g', 2.2)}
    <clipPath id="type"><rect x="0" y="120" height="40" width="0">
      <animate attributeName="width" from="0" to="${W}" begin="2s" dur="2.2s" fill="freeze" calcMode="discrete" values="${Array.from({ length: subtitle.length + 3 }, (_, k) => Math.round((W - subW) / 2 + k * 10.2)).join(';')}"/>
    </rect></clipPath>
    <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#ffffff" opacity="0.025"/></pattern>
  </defs>
  <rect width="100%" height="100%" rx="12" fill="${C.bg}"/>
  <g filter="url(#g)">${pixels}</g>
  <g clip-path="url(#type)">
    <text x="${W / 2}" y="146" text-anchor="middle" ${FONT} font-size="17" fill="${C.cyan}">${esc(subtitle)}</text>
  </g>
  <rect x="${(W + subW) / 2 + 4}" y="131" width="10" height="19" fill="${C.neon}" opacity="0">
    <animate attributeName="opacity" values="0;1;0" dur="1s" begin="4.2s" repeatCount="indefinite"/>
  </rect>
  <rect width="100%" height="100%" rx="12" fill="url(#scan)"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="none" stroke="${C.border}"/>
</svg>`;
}

/* ---------------- 2. Profile scan panel ---------------- */
function scanSvg(u, total) {
  const W = 900, H = 330, since = new Date(u.createdAt).getFullYear();
  const lines = [
    ['user', u.login],
    ['name', u.name || u.login],
    ['role', 'Data Engineer · Power BI Developer'],
    ['location', 'Lima, Peru (GMT-5)'],
    ['stack', 'SQL Server · Power BI · Python · Azure · Databricks'],
    ['experience', '7+ years in data (NTT DATA, Atento, Stefanini)'],
    ['github', `since ${since} · ${u.repositories.totalCount} public repos`],
    ['activity', `${total.toLocaleString('en-US')} contributions in the last year`],
  ];
  const rows = lines.map(([k, v], i) => {
    const y = 92 + i * 26, begin = (0.6 + i * 0.35).toFixed(2);
    return `<g opacity="0"><animate attributeName="opacity" from="0" to="1" begin="${begin}s" dur="0.2s" fill="freeze"/>
      <text x="330" y="${y}" ${FONT} font-size="14" fill="${C.dim}">${esc(k.padEnd(11, ' '))}</text>
      <text x="440" y="${y}" ${FONT} font-size="14" fill="${C.text}">${esc(v)}</text></g>`;
  }).join('');
  const statusY = 92 + lines.length * 26 + 8;
  // radar blips at fixed pseudo-random spots
  const blips = [[40, -30], [-55, 20], [15, 60], [-25, -58], [62, 35]].map(([dx, dy], i) =>
    `<circle cx="${160 + dx}" cy="${190 + dy}" r="3.5" fill="${C.neon}" opacity="0">
      <animate attributeName="opacity" values="0;1;0" dur="4s" begin="${(i * 0.8).toFixed(1)}s" repeatCount="indefinite"/></circle>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Profile scan">
  <defs>${glow('g2', 2)}
    <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${C.neon}" stop-opacity="0"/><stop offset="1" stop-color="${C.neon}" stop-opacity="0.55"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" rx="12" fill="${C.bg}"/>
  <rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="10" fill="${C.panel}" stroke="${C.border}"/>
  <circle cx="38" cy="36" r="5" fill="#ff5f56"/><circle cx="56" cy="36" r="5" fill="#ffbd2e"/><circle cx="74" cy="36" r="5" fill="#27c93f"/>
  <text x="${W / 2}" y="41" text-anchor="middle" ${FONT} font-size="13" fill="${C.dim}">~/profile_scan.sh — ${esc(u.login)}</text>
  <line x1="16" y1="54" x2="${W - 16}" y2="54" stroke="${C.border}"/>
  <!-- radar -->
  <g filter="url(#g2)">
    ${[88, 62, 36].map((r) => `<circle cx="160" cy="190" r="${r}" fill="none" stroke="${C.border}"/>`).join('')}
    <line x1="72" y1="190" x2="248" y2="190" stroke="${C.border}"/><line x1="160" y1="102" x2="160" y2="278" stroke="${C.border}"/>
    <path d="M160 190 L248 190 A88 88 0 0 0 222 128 Z" fill="url(#sweep)">
      <animateTransform attributeName="transform" type="rotate" from="0 160 190" to="-360 160 190" dur="4s" repeatCount="indefinite"/>
    </path>
    ${blips}
    <text x="160" y="85" text-anchor="middle" ${FONT} font-size="12" fill="${C.neon}">SCANNING…</text>
  </g>
  <text x="330" y="72" ${FONT} font-size="14" fill="${C.neon}">$ whoami --verbose</text>
  ${rows}
  <g opacity="0"><animate attributeName="opacity" from="0" to="1" begin="${(0.6 + lines.length * 0.35).toFixed(2)}s" dur="0.2s" fill="freeze"/>
    <text x="330" y="${statusY}" ${FONT} font-size="14" fill="${C.dim}">status     </text>
    <circle cx="446" cy="${statusY - 5}" r="5" fill="${C.neon}" filter="url(#g2)">
      <animate attributeName="opacity" values="1;0.2;1" dur="1.4s" repeatCount="indefinite"/></circle>
    <text x="458" y="${statusY}" ${FONT} font-size="14" font-weight="bold" fill="${C.neon}">OPEN TO FREELANCE</text>
  </g>
</svg>`;
}

/* ---------------- 3. Contribution grid + jet ---------------- */
const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

function jetSvg(calendar) {
  const weeks = calendar.weeks, cell = 13, gap = 3, step = cell + gap;
  const gx = 44, gy = 92, W = gx * 2 + weeks.length * step, H = gy + 7 * step + 40;
  const DUR = 12, jetY = 66;
  const t = (col) => (col + 0.5) / weeks.length;     // fraction of the loop when the jet is above a column
  const days = [];
  weeks.forEach((w, col) => w.contributionDays.forEach((d) => {
    days.push({ ...d, col, row: new Date(d.date + 'T00:00:00Z').getUTCDay() });
  }));
  const busiest = days.filter((d) => d.contributionCount > 0)
    .sort((a, b) => b.contributionCount - a.contributionCount).slice(0, 14);
  const hit = new Set(busiest.map((d) => d.date));

  const cells = days.map((d) => {
    const x = gx + d.col * step, y = gy + d.row * step, fill = C.levels[LEVEL[d.contributionLevel] ?? 0];
    if (!hit.has(d.date)) return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2.5" fill="${fill}"/>`;
    const f = t(d.col), k = (v) => Math.min(0.999, Math.max(0.001, v)).toFixed(4);
    return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2.5" fill="${fill}">
      <animate attributeName="fill" dur="${DUR}s" repeatCount="indefinite" values="${fill};${fill};${C.white};${fill};${fill}" keyTimes="0;${k(f)};${k(f + 0.006)};${k(f + 0.05)};1"/></rect>
      <line x1="${x + cell / 2}" y1="${jetY + 8}" x2="${x + cell / 2}" y2="${y}" stroke="${C.cyan}" stroke-width="2" opacity="0">
      <animate attributeName="opacity" dur="${DUR}s" repeatCount="indefinite" values="0;0;1;0;0" keyTimes="0;${k(f - 0.004)};${k(f)};${k(f + 0.012)};1"/></line>
      <circle cx="${x + cell / 2}" cy="${y + cell / 2}" r="0" fill="none" stroke="${C.neon}" stroke-width="2" opacity="0">
      <animate attributeName="r" dur="${DUR}s" repeatCount="indefinite" values="0;0;2;14;14" keyTimes="0;${k(f)};${k(f + 0.004)};${k(f + 0.04)};1"/>
      <animate attributeName="opacity" dur="${DUR}s" repeatCount="indefinite" values="0;0;1;0;0" keyTimes="0;${k(f)};${k(f + 0.004)};${k(f + 0.04)};1"/></circle>`;
  }).join('');

  const months = [];
  weeks.forEach((w, col) => {
    const d = new Date(w.contributionDays[0].date + 'T00:00:00Z');
    if (d.getUTCDate() <= 7) months.push(`<text x="${gx + col * step}" y="${gy - 8}" ${FONT} font-size="10" fill="${C.dim}">${d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}</text>`);
  });
  const x0 = gx - 20, x1 = gx + weeks.length * step;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Contribution activity">
  <defs>${glow('g3', 1.6)}</defs>
  <rect width="100%" height="100%" rx="12" fill="${C.bg}"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="none" stroke="${C.border}"/>
  <text x="${gx}" y="34" ${FONT} font-size="15" font-weight="bold" fill="${C.neon}">Contribution Activity</text>
  <text x="${gx}" y="54" ${FONT} font-size="12" fill="${C.dim}">${calendar.totalContributions.toLocaleString('en-US')} contributions in the last year · the jet fires at the busiest days</text>
  ${months.join('')}
  ${['Mon', 'Wed', 'Fri'].map((l, i) => `<text x="${gx - 32}" y="${gy + (1 + i * 2) * step + 10}" ${FONT} font-size="10" fill="${C.dim}">${l}</text>`).join('')}
  <g filter="url(#g3)">${cells}</g>
  <g filter="url(#g3)">
    <g>
      <animateTransform attributeName="transform" type="translate" values="${x0} 0;${x1} 0" keyTimes="0;1" dur="${DUR}s" repeatCount="indefinite"/>
      <polygon points="0,${jetY - 7} 22,${jetY} 0,${jetY + 7} 5,${jetY}" fill="${C.cyan}"/>
      <polygon points="-2,${jetY - 3} -12,${jetY} -2,${jetY + 3}" fill="#ffbd2e">
        <animate attributeName="opacity" values="1;0.3;1" dur="0.2s" repeatCount="indefinite"/></polygon>
    </g>
  </g>
  <text x="${W - gx}" y="${H - 14}" text-anchor="end" ${FONT} font-size="10" fill="${C.dim}">updated ${new Date().toISOString().slice(0, 10)}</text>
</svg>`;
}

const u = await fetchProfile();
const cal = u.contributionsCollection.contributionCalendar;
mkdirSync(OUT, { recursive: true });
writeFileSync(new URL('header.svg', OUT), headerSvg(u.name || u.login, '> Data Engineer & Power BI Developer'));
writeFileSync(new URL('profile-scan.svg', OUT), scanSvg(u, cal.totalContributions));
writeFileSync(new URL('contributions-jet.svg', OUT), jetSvg(cal));
console.log(`SVGs generated for ${u.login}: ${cal.totalContributions} contributions`);
