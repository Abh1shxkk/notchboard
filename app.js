// Dashing New Tab v3. Everything comes from local Chrome APIs; nothing is sent anywhere.
'use strict';
const VERSION = '3.0.1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const DAY = 864e5;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============================== Theme ============================== */
document.documentElement.dataset.theme =
  localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

/* ============================== Helpers ============================== */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const fav = (u, size = 64) => `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(u)}&size=${size}`;
// App-icon style tile around a favicon (64px source so it stays crisp on HiDPI).
const fi = (u, cls = '') => `<span class="fi ${cls}"><img src="${fav(u)}" alt="" loading="lazy"></span>`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const todayKey = () => new Date().toLocaleDateString('en-CA');
const ago = (t) => {
  const m = Math.round((Date.now() - t) / 6e4);
  if (m < 1) return 'now'; if (m < 60) return m + 'm';
  const h = Math.round(m / 60); return h < 24 ? h + 'h' : Math.round(h / 24) + 'd';
};
const store = { get: (k) => chrome.storage.local.get(k), set: (o) => chrome.storage.local.set(o) };
const isWeb = (u) => /^https?:/i.test(u || '');
const has = (api) => typeof chrome[api] !== 'undefined';

/* ============================== Naming & categories ============================== */
const KNOWN = {
  'github.com': 'GitHub', 'web.whatsapp.com': 'WhatsApp', 'claude.ai': 'Claude', 'app.clickup.com': 'ClickUp',
  'mail.google.com': 'Gmail', 'gemini.google.com': 'Gemini', 'drive.google.com': 'Drive', 'calendar.google.com': 'Calendar',
  'docs.google.com': 'Docs', 'meet.google.com': 'Meet', 'chatgpt.com': 'ChatGPT', 'youtube.com': 'YouTube',
  'linkedin.com': 'LinkedIn', 'figma.com': 'Figma', 'vercel.com': 'Vercel', 'notion.so': 'Notion', 'lovable.dev': 'Lovable',
  'x.com': 'X', 'console.cloud.google.com': 'Cloud Console', 'console.firebase.google.com': 'Firebase', 'supabase.com': 'Supabase',
  'stackoverflow.com': 'Stack Overflow', 'perplexity.ai': 'Perplexity', 'canva.com': 'Canva', 'instagram.com': 'Instagram',
  'one.one.one.one': 'Cloudflare DNS',
};
const CATS = {
  Work: 'var(--c-work)', Dev: 'var(--c-dev)', AI: 'var(--c-ai)', University: 'var(--c-university)',
  Google: 'var(--c-google)', Social: 'var(--c-social)', Other: 'var(--c-other)',
};
const RULES = [
  [/github|gitlab|vercel|localhost|127\.0\.0\.1|pgadmin|swagger|stackoverflow|npmjs|figma|supabase|firebase|console\.cloud|aws|amazonaws/i, 'Dev'],
  [/claude|chatgpt|openai|gemini|perplexity|copilot|lovable/i, 'AI'],
  [/university|college|\.edu\b|\.ac\.|\blms\b|moodle|canvas|classroom|attendance/i, 'University'],
  [/clickup|notion|linear|slack|jira|asana|trello|teams|zoom|meet\.google/i, 'Work'],
  [/google\.com/i, 'Google'],
  [/whatsapp|instagram|facebook|twitter|x\.com|linkedin|youtube|reddit|telegram/i, 'Social'],
];
const categorize = (url, name = '') => (RULES.find(([re]) => re.test(url) || re.test(name)) || [0, 'Other'])[1];
function prettyHost(url) {
  let u; try { u = new URL(url); } catch { return url; }
  const h = u.hostname.replace(/^www\./, '');
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(h)) return 'Localhost' + (u.port ? ':' + u.port : '');
  if (/amazonaws\.com|aws\.amazon\.com/.test(h)) return 'AWS Console';
  const parts = h.split('.');
  let i = parts.length - 2;
  if (i > 0 && /^(co|ac|edu|gov|org|com|net)$/.test(parts[i])) i--;
  const main = parts[Math.max(i, 0)];
  const sub = i > 0 && !/^(www|app|web|portal|m)$/.test(parts[0]) ? parts[0] : '';
  const fmt = (s) => (s.length <= 4 ? s.toUpperCase() : cap(s));
  return sub ? `${fmt(sub)} · ${cap(main)}` : cap(main);
}
const GENERIC = /^(home|not found|404|new (session|tab|chat)|dashboard|login|log in|sign in|untitled|index|welcome|loading.*|redirecting.*|localhost)$/i;
function cleanName(title, url) {
  const h = host(url);
  if (KNOWN[h]) return KNOWN[h];
  if (/amazonaws|aws\.amazon/.test(h)) return 'AWS Console';
  let t = String(title || '').replace(/^\(\d+\+?\)\s*/, '').split(/\s+[|\-–—:·]\s+|[|–—]/)[0].trim();
  if (!t || GENERIC.test(t) || t.length > 22 || /^[\d\W]/.test(t)) t = prettyHost(url);
  return t;
}
const isJunk = (url) => {
  const h = host(url);
  if (!isWeb(url) || !h) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) && !/^127\./.test(h)) return true; // bare public IPs like 1.1.1.1
  return /\d{7,}/.test(h) || /googleusercontent|accounts\.google|oauth/i.test(url);
};
const toolKey = (url) => { try { const u = new URL(url); return u.hostname.replace(/^www\./, '') + (u.port ? ':' + u.port : ''); } catch { return url; } };
const DEFAULT_TOOLS = [
  ['GitHub', 'https://github.com'], ['WhatsApp', 'https://web.whatsapp.com'], ['Claude', 'https://claude.ai'],
  ['ClickUp', 'https://app.clickup.com'], ['Gmail', 'https://mail.google.com'], ['Gemini', 'https://gemini.google.com'],
];

/* ============================== State ============================== */
const S = { tools: [], editing: false, tabs: [], history: [], todos: [], workspaces: [], focus: null, focusPreset: 25, focusLog: {}, doneLog: {} };
const loaded = chrome.runtime.getManifest().version;
const NEEDS_RELOAD = loaded !== VERSION || !has('tabs') || !has('alarms');

/* ============================== Favicon contrast ============================== */
// Some favicons are white-on-transparent (GitHub, Vercel, Notion in dark mode) and vanish on a white tile.
// Sample each icon once; if its visible pixels are mostly light, flip its tile to dark.
const lightCache = new Map();
const probe = document.createElement('canvas'); probe.width = probe.height = 16;
const pctx = probe.getContext('2d', { willReadFrequently: true });
function isLightIcon(img) {
  if (lightCache.has(img.src)) return lightCache.get(img.src);
  let light = false;
  try {
    pctx.clearRect(0, 0, 16, 16); pctx.drawImage(img, 0, 0, 16, 16);
    const d = pctx.getImageData(0, 0, 16, 16).data;
    let sum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 100) continue;
      sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; n++;
    }
    light = n > 8 && sum / n > 0.86;
  } catch { /* cross-origin or not decoded: leave as is */ }
  lightCache.set(img.src, light);
  return light;
}
document.addEventListener('load', (e) => {
  const img = e.target;
  if (img.tagName !== 'IMG') return;
  const tile = img.closest('.fi, .dock-item.tool, .modal-hero .tile');
  if (tile) tile.classList.toggle('inv', isLightIcon(img));
}, true);

/* ============================== Effects: encrypted (typewriter) text ============================== */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&@$*+=<>/';
const scrambling = new WeakMap();
function encrypt(el, text = el.textContent, dur = 700) {
  if (REDUCED) { el.textContent = text; return; }
  cancelAnimationFrame(scrambling.get(el));
  const t0 = performance.now();
  const frame = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    const revealed = Math.floor(k * text.length);
    el.textContent = [...text].map((ch, i) => (i < revealed || ch === ' ' || ch === ',' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
    if (k < 1) scrambling.set(el, requestAnimationFrame(frame));
  };
  scrambling.set(el, requestAnimationFrame(frame));
}
// Card titles decode once on load (staggered).
$$('.card-h h2').forEach((h, i) => setTimeout(() => encrypt(h, h.textContent, 500), 150 + i * 60));

/* ============================== Effects: squiggly text ============================== */
function squiggle(el) {
  let timer, i = 0;
  el.addEventListener('mouseenter', () => { if (REDUCED) return; timer = setInterval(() => { el.style.filter = `url(#sq${i++ % 5})`; }, 70); });
  el.addEventListener('mouseleave', () => { clearInterval(timer); el.style.filter = ''; });
}

/* ============================== Effects: ripple + burst ============================== */
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('.fx, .ws li');
  if (!el) return;
  const r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
  const s = document.createElement('span');
  s.className = 'ripple';
  s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  el.appendChild(s); setTimeout(() => s.remove(), 650);
});
function burst(x, y) {
  if (REDUCED) return;
  for (let i = 0; i < 10; i++) {
    const p = document.createElement('i'), a = (Math.PI * 2 * i) / 10, dist = 22 + Math.random() * 22;
    p.className = 'burst';
    p.style.cssText = `left:${x - 2}px;top:${y - 2}px;--dx:${Math.cos(a) * dist}px;--dy:${Math.sin(a) * dist}px;${i % 2 ? 'background:var(--ink)' : ''}`;
    document.body.appendChild(p); setTimeout(() => p.remove(), 700);
  }
}

/* ============================== Toast ============================== */
let toastTimer;
function toast(msg, action) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  if (action) t.querySelector('button').onclick = () => { action.run(); t.classList.remove('show'); };
  t.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), action ? 6000 : 2600);
}

/* ============================== Clock, greeting, summary ============================== */
// 05–11 morning · 12–16 afternoon · 17–20 evening · 21–04 night
const greetingFor = (h) => (h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night');
const isoWeek = (d) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / DAY + 1) / 7);
};
const ZONES = [['UTC', 'UTC'], ['London', 'Europe/London'], ['New York', 'America/New_York']];
const tzShort = Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value || '';
/* ---------- Micro-interaction: rolling digits ---------- */
// Each character sits in its own slot; when it changes, the old glyph rolls up and the new one rolls in.
function roll(el, text) {
  if (el.dataset.v === text) return;
  const prev = el.dataset.v || '';
  el.dataset.v = text;
  const slot = (c) => `<span class="dg${c === ':' ? ' colon' : ''}"><span>${esc(c)}</span></span>`;
  if (REDUCED || prev.length !== text.length || el.children.length !== text.length) {
    el.innerHTML = [...text].map(slot).join('');
    return;
  }
  [...text].forEach((c, i) => {
    if (c === prev[i]) return;
    const box = el.children[i], old = box.lastElementChild;
    const nw = document.createElement('span'); nw.textContent = c; box.appendChild(nw);
    const o = { duration: 320, easing: 'cubic-bezier(.3,.7,.2,1)' };
    old.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-60%)', opacity: 0 }], o).onfinish = () => old.remove();
    nw.animate([{ transform: 'translateY(60%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], o);
  });
}

/* ---------- Micro-interaction: sliding highlight in segmented toggles ---------- */
function segInd(seg) {
  if (!seg) return;
  let ind = seg.querySelector('.seg-ind');
  if (!ind) { ind = document.createElement('span'); ind.className = 'seg-ind'; seg.prepend(ind); }
  const a = seg.querySelector('button.active'); if (!a) return;
  ind.style.left = a.offsetLeft + 'px'; ind.style.width = a.offsetWidth + 'px';
}
const segIndAll = () => $$('.board > .card:not(.ghost) .seg').forEach(segInd);
addEventListener('resize', segIndAll);

function renderTime(d) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(d).map((p) => [p.type, p.value]));
  roll($('#tHM'), `${parts.hour}:${parts.minute}`);
  roll($('#tS'), parts.second);
  $('#tAP').textContent = parts.dayPeriod || '24h';
  $('#tzName').textContent = tzShort;
  $('#tDate').textContent = `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · W${isoWeek(d)}`;
  const mid = new Date(d); mid.setHours(0, 0, 0, 0);
  const pct = (d - mid) / DAY, left = DAY - (d - mid);
  $('#dayBar').style.width = (pct * 100).toFixed(2) + '%';
  $('#dayPct').textContent = Math.floor(pct * 100) + '%';
  $('#dayLeft').textContent = `${Math.floor(left / 36e5)}h ${Math.floor((left % 36e5) / 6e4)}m left`;
  if (d.getSeconds() === 0 || !$('#zones').children.length) {
    const localDay = d.toLocaleDateString('en-CA');
    $('#zones').innerHTML = ZONES.map(([label, tz]) => {
      const t = d.toLocaleTimeString(undefined, { timeZone: tz, hour: '2-digit', minute: '2-digit' });
      const h = +d.toLocaleString('en-GB', { timeZone: tz, hour: '2-digit', hour12: false });
      const day = d.toLocaleDateString('en-CA', { timeZone: tz });
      const rel = day < localDay ? 'yesterday' : day > localDay ? 'tomorrow' : 'today';
      return `<li><span class="z"><i class="${h >= 7 && h < 19 ? 'day' : ''}"></i>${label}</span><b>${t}</b><small>${rel}</small></li>`;
    }).join('');
  }
}
function tick() {
  const d = new Date();
  $('#heroDate').textContent = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  renderTime(d);
  const g = greetingFor(d.getHours());
  if ($('#greeting').dataset.text !== g) { $('#greeting').dataset.text = g; encrypt($('#greeting'), g, 900); }
  renderFocus();
}
const nameEl = $('#name');
nameEl.contentEditable = 'plaintext-only'; nameEl.spellcheck = false; nameEl.title = 'Click to set your name';
nameEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); } });
nameEl.addEventListener('blur', () => store.set({ name: nameEl.textContent.trim() || '' }));
squiggle(nameEl);

function renderSummary() {
  const open = S.todos.filter((t) => !t.done).length;
  const dupes = dupeGroups().reduce((n, g) => n + g.length - 1, 0);
  const parts = [
    [S.tabs.length, 'tabs open'], [dupes, dupes === 1 ? 'duplicate' : 'duplicates'],
    [open, 'tasks open'], [S.focusLog[todayKey()] || 0, 'min focused'], [brief.length, 'in brief'],
  ];
  $('#summary').innerHTML = parts.map(([n, l]) => `<span><b>${n}</b> ${l}</span>`).join('<span>/</span>');
}
function countUp(el, to) {
  const from = +el.textContent || 0, t0 = performance.now();
  const step = (t) => { const k = Math.min(1, (t - t0) / 800), e = 1 - (1 - k) ** 3; el.textContent = Math.round(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/* ============================== Tabs ============================== */
async function loadTabs() {
  if (!has('tabs')) return;
  S.tabs = (await chrome.tabs.query({})).filter((t) => isWeb(t.url));
  if (S.winId === undefined) { try { S.winId = (await chrome.windows.getCurrent()).id; } catch { S.winId = null; } }
  renderTabs(); renderDock(); renderSummary(); renderResume(); renderWs();
  countUp($('#kTabs'), S.tabs.length);
}
const dupeGroups = () => {
  const m = new Map();
  for (const t of S.tabs) { const k = t.url.split('#')[0]; m.set(k, [...(m.get(k) || []), t]); }
  return [...m.values()].filter((g) => g.length > 1);
};
async function switchTo(tab) { await chrome.tabs.update(tab.id, { active: true }); await chrome.windows.update(tab.windowId, { focused: true }); }
function renderTabs() {
  const dupeIds = new Set(dupeGroups().flatMap((g) => g.slice(1).map((t) => t.id)));
  $('#closeDupesBtn').hidden = !dupeIds.size;
  $('#segOpen').textContent = `Open ${S.tabs.length}`;
  segInd($('#tabsSeg'));
  if ($('[data-card="tabs"]').dataset.view !== 'open') $('#closeDupesBtn').hidden = true;
  const list = [...S.tabs].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  $('#tabsList').innerHTML = list.map((t) => `
    <li>
      <button class="row-btn" data-switch="${t.id}">${fi(t.url)}
        <span class="t-main"><span class="t-title">${esc(t.title || host(t.url))}</span>
        <span class="t-sub">${esc(host(t.url))}${t.lastAccessed ? ' · ' + ago(t.lastAccessed) : ''}</span></span></button>
      ${dupeIds.has(t.id) ? '<span class="badge">dupe</span>' : ''}
      <button class="mini-x" data-close="${t.id}" title="Close tab" aria-label="Close tab">✕</button>
    </li>`).join('') || `<p class="empty">${NEEDS_RELOAD ? 'Click “Apply update” in the Daily brief to enable tab features.' : 'No web tabs open.'}</p>`;
}
// Resume: the tabs you were in most recently, one click to jump back.
function renderResume() {
  const recent = [...S.tabs].filter((t) => !t.active).sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0)).slice(0, 5);
  $('#resume').innerHTML = recent.map((t) => `
    <button class="qa fx" data-switch="${t.id}" title="${esc(t.title)}">${fi(t.url, 'sm')}
      <span>${esc(cleanName(t.title, t.url))}</span>${t.lastAccessed ? `<small>${ago(t.lastAccessed)}</small>` : ''}</button>`).join('')
    || '<span class="muted">Your recent tabs will show up here.</span>';
}
$('#resume').addEventListener('click', (e) => {
  const b = e.target.closest('[data-switch]'); if (!b) return;
  const t = S.tabs.find((x) => x.id === +b.dataset.switch); if (t) switchTo(t);
});
$('#tabsList').addEventListener('click', async (e) => {
  const sw = e.target.closest('[data-switch]'), cl = e.target.closest('[data-close]');
  if (cl) { cl.closest('li').classList.add('leaving'); await chrome.tabs.remove(+cl.dataset.close).catch(() => {}); }
  else if (sw) { const t = S.tabs.find((x) => x.id === +sw.dataset.switch); if (t) switchTo(t); }
});
async function closeDupes() {
  const ids = dupeGroups().flatMap((g) => g.slice(1).map((t) => t.id));
  if (!ids.length) return 0;
  await chrome.tabs.remove(ids);
  toast(`Closed ${ids.length} duplicate tab${ids.length > 1 ? 's' : ''}`, { label: 'Undo', run: () => chrome.sessions.restore() });
  return ids.length;
}
$('#closeDupesBtn').addEventListener('click', (e) => { burst(e.clientX, e.clientY); closeDupes(); });
let tabsTimer;
const refreshTabsSoon = () => { clearTimeout(tabsTimer); tabsTimer = setTimeout(() => { loadTabs(); buildBrief(); }, 250); };
if (has('tabs')) ['onCreated', 'onRemoved', 'onUpdated', 'onActivated'].forEach((ev) => chrome.tabs[ev].addListener(refreshTabsSoon));

/* ============================== Floating dock ============================== */
const ICONS = {
  add: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
  cmd: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="m21 21-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z"/></svg>',
};
function openTabFor(url) {
  if (!S.tabs.length) return null;
  const k = toolKey(url);
  return S.tabs.filter((t) => toolKey(t.url) === k).sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
}
function renderDock() {
  const dock = $('#dock');
  dock.classList.toggle('editing', S.editing);
  dock.innerHTML = S.tools.map((t, i) => {
    const live = openTabFor(t.url);
    return `<a class="dock-item tool" href="${esc(t.url)}" data-i="${i}" draggable="${S.editing}" style="--c:${CATS[t.cat] || CATS.Other}" aria-label="${esc(t.name)}">
      <img src="${fav(t.url, 64)}" alt=""><span class="cat-dot"></span>
      ${live ? '<i class="live"></i>' : ''}<button class="x" data-del="${i}" aria-label="Remove ${esc(t.name)}">×</button></a>`;
  }).join('') + `<span class="dock-sep"></span>
    <button class="dock-item util" data-act="add" aria-label="Add tool">${ICONS.add}</button>
    <button class="dock-item util edit" data-act="edit" aria-label="${S.editing ? 'Done editing' : 'Edit dock'}">${ICONS.edit}</button>
    <button class="dock-item util" data-act="cmd" aria-label="Command palette">${ICONS.cmd}</button>`;
}
// Magnification: items near the cursor grow, like the macOS dock.
const BASE = 46, MAXS = 74, RANGE = 150;
$('#dock').addEventListener('mousemove', (e) => {
  if (S.editing || REDUCED) return;
  $$('.dock-item', $('#dock')).forEach((it) => {
    const r = it.getBoundingClientRect(), d = Math.abs(e.clientX - (r.left + r.width / 2));
    const s = BASE + (MAXS - BASE) * Math.max(0, Math.cos(Math.min(d / RANGE, 1) * Math.PI / 2));
    it.style.setProperty('--s', s.toFixed(1) + 'px');
  });
});
$('#dock').addEventListener('mouseleave', () => $$('.dock-item', $('#dock')).forEach((it) => it.style.removeProperty('--s')));
function launchTool(t, e) {
  if (e && (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1)) return false;
  const live = openTabFor(t.url);
  if (live) switchTo(live); else location.href = t.url;
  return true;
}
$('#dock').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]');
  if (act) {
    if (act.dataset.act === 'add') openModal();
    if (act.dataset.act === 'cmd') openPalette();
    if (act.dataset.act === 'edit') { S.editing = !S.editing; renderDock(); if (S.editing) toast('Drag icons to reorder · × removes'); }
    return;
  }
  const del = e.target.closest('[data-del]');
  if (del) {
    e.preventDefault();
    const i = +del.dataset.del, [removed] = S.tools.splice(i, 1);
    saveTools();
    toast(`Removed ${removed.name}`, { label: 'Undo', run: () => { S.tools.splice(i, 0, removed); saveTools(); } });
    return;
  }
  const a = e.target.closest('.dock-item.tool'); if (!a) return;
  if (S.editing) { e.preventDefault(); return; }
  // macOS-style launch bounce
  if (!REDUCED) { a.classList.remove('launch'); void a.offsetWidth; a.classList.add('launch'); a.addEventListener('animationend', () => a.classList.remove('launch'), { once: true }); }
  if (launchTool(S.tools[+a.dataset.i], e)) e.preventDefault();
});
let dragFrom = null;
$('#dock').addEventListener('dragstart', (e) => { const a = e.target.closest('.dock-item.tool'); if (a) dragFrom = +a.dataset.i; });
$('#dock').addEventListener('dragover', (e) => {
  const a = e.target.closest('.dock-item.tool'); if (!a || dragFrom === null) return;
  e.preventDefault(); $$('.drag-over').forEach((x) => x.classList.remove('drag-over')); a.classList.add('drag-over');
});
$('#dock').addEventListener('drop', (e) => {
  const a = e.target.closest('.dock-item.tool'); if (!a || dragFrom === null) return;
  e.preventDefault(); const [m] = S.tools.splice(dragFrom, 1); S.tools.splice(+a.dataset.i, 0, m); dragFrom = null; saveTools();
});
const saveTools = () => { store.set({ tools: S.tools }); renderDock(); };
function addTool(name, url, cat) {
  if (!/^[a-z]+:\/\//i.test(url)) url = 'https://' + url;
  if (S.tools.some((t) => toolKey(t.url) === toolKey(url))) { toast('Already in your dock'); return false; }
  name = name || cleanName('', url);
  S.tools.push({ name, url, cat: cat || categorize(url, name) });
  saveTools(); return true;
}

/* ============================== Animated modal ============================== */
const modal = $('#modal');
$('#tCat').innerHTML = Object.keys(CATS).map((c) => `<option>${c}</option>`).join('');
function modalTiles(url) {
  const urls = url ? [url] : S.tools.slice(0, 3).map((t) => t.url);
  $('#modalTiles').innerHTML = urls.map((u) => `<span class="tile"><img src="${fav(u, 64)}" alt=""></span>`).join('');
}
function openModal(url = '', name = '') {
  $('#toolForm').reset(); $('#tUrl').value = url; $('#tName').value = name;
  $('#tCat').value = categorize(url, name); modalTiles(url);
  modal.classList.add('show'); modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => $('#tUrl').focus(), 80);
}
function closeModal() { modal.classList.remove('show'); modal.setAttribute('aria-hidden', 'true'); }
const normUrl = (v) => (/^[a-z]+:\/\//i.test(v) ? v : 'https://' + v);
let tileTimer;
$('#tUrl').addEventListener('input', (e) => {
  const v = e.target.value.trim();
  $('#tCat').value = categorize(v, $('#tName').value);
  $('#tName').placeholder = v ? cleanName('', normUrl(v)) : 'Auto from the URL';
  clearTimeout(tileTimer); tileTimer = setTimeout(() => v.includes('.') && modalTiles(normUrl(v)), 350);
});
$('#toolForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (addTool($('#tName').value.trim(), $('#tUrl').value.trim(), $('#tCat').value)) { closeModal(); toast('Added to your dock'); }
});
$('#modalCancel').addEventListener('click', closeModal);
modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeModal(); });

/* ============================== Expandable cards ============================== */
// Once a card has played its entrance, it must never replay it (that caused the flash on close).
$$('.board > .card').forEach((c) => c.addEventListener('animationend', (e) => { if (e.target === c) c.classList.add('settled'); }));
let expanded = null, animating = false;
function expandCard(card) {
  if (expanded || animating) return;
  card.classList.add('settled');
  const r = card.getBoundingClientRect();
  // A static, dimmed copy holds the slot so the grid never shows a hole.
  const ph = card.cloneNode(true);
  ph.classList.add('ghost', 'settled'); ph.setAttribute('inert', ''); ph.setAttribute('aria-hidden', 'true');
  $$('[id]', ph).forEach((el) => el.removeAttribute('id'));
  const ta = $('textarea', card); if (ta) $('textarea', ph).value = ta.value;
  card.after(ph);
  Object.assign(card.style, { top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px' });
  card.classList.add('floating');
  card.getBoundingClientRect(); // commit start frame
  const w = Math.min(860, innerWidth * .9), h = Math.min(640, innerHeight * .82);
  Object.assign(card.style, { top: (innerHeight - h) / 2 + 'px', left: (innerWidth - w) / 2 + 'px', width: w + 'px', height: h + 'px' });
  card.classList.add('expanded');
  $('#scrim').classList.add('show');
  expanded = { card, ph };
}
// Genie: the window funnels down and is sucked into the dock, like minimizing on macOS.
const smooth = (x) => x * x * (3 - 2 * x);
function genieFrames(ox, dy, steps = 14) {
  const frames = [];
  for (let k = 0; k <= steps; k++) {
    const p = k / steps;
    const pinch = Math.min(1, p * 1.35);          // how hard the bottom is pinched
    const topShrink = Math.max(0, (p - .55) / .45); // the top follows late
    const pts = [];
    const N = 10;
    for (let j = 0; j <= N; j++) {                 // left edge, top → bottom
      const y = j / N;
      const f = Math.max(.015, (1 - pinch * (.15 + .85 * smooth(y))) * (1 - topShrink * .92));
      pts.push(`${(ox - ox * f).toFixed(2)}% ${(y * 100).toFixed(1)}%`);
    }
    for (let j = N; j >= 0; j--) {                 // right edge, bottom → top
      const y = j / N;
      const f = Math.max(.015, (1 - pinch * (.15 + .85 * smooth(y))) * (1 - topShrink * .92));
      pts.push(`${(ox + (100 - ox) * f).toFixed(2)}% ${(y * 100).toFixed(1)}%`);
    }
    frames.push({
      clipPath: `polygon(${pts.join(',')})`,
      transform: `translateY(${(dy * p ** 2.2).toFixed(1)}px) scaleY(${(1 - .97 * p ** 1.6).toFixed(3)})`,
      opacity: p > .85 ? 1 - (p - .85) / .15 : 1,
      offset: p,
    });
  }
  return frames;
}
function collapseCard() {
  if (!expanded || animating) return;
  const { card, ph } = expanded; expanded = null; animating = true;
  const r = card.getBoundingClientRect(), dock = $('#dock').getBoundingClientRect();
  const ox = Math.min(98, Math.max(2, ((dock.left + dock.width / 2) - r.left) / r.width * 100));
  const dy = dock.top + dock.height / 2 - r.bottom;
  $('#scrim').classList.remove('show');
  ph.classList.add('back');
  const finish = () => {
    card.classList.remove('floating', 'expanded', 'genie');
    card.removeAttribute('style');
    ph.remove(); animating = false;
  };
  if (REDUCED) { finish(); return; }
  card.classList.add('genie');
  card.style.transformOrigin = `${ox}% 100%`;
  const anim = card.animate(genieFrames(ox, dy), { duration: 340, easing: 'cubic-bezier(.45,0,.85,.35)', fill: 'forwards' });
  anim.onfinish = () => {
    finish(); anim.cancel();
    $('#dock').animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-5px) scale(1.015)' }, { transform: 'translateY(0)' }],
      { duration: 260, easing: 'cubic-bezier(.34,1.5,.64,1)' });
  };
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('.exp'); if (!b) return;
  const card = b.closest('.card');
  card.classList.contains('expanded') ? collapseCard() : expandCard(card);
});
$('#scrim').addEventListener('click', collapseCard);

/* ============================== History ============================== */
async function loadHistory() {
  const now = Date.now();
  S.history = (await chrome.history.search({ text: '', startTime: now - 30 * DAY, maxResults: 5000 })).filter((i) => isWeb(i.url));
  const by = new Map();
  for (const it of S.history) {
    const k = toolKey(it.url);
    const c = by.get(k) || { key: k, url: it.url, title: it.title, visits: 0 };
    c.visits += it.visitCount || 1;
    if (it.url.length < c.url.length) { c.url = it.url; c.title = it.title || c.title; }
    by.set(k, c);
  }
  const top = [...by.values()].filter((s) => !isJunk(s.url)).sort((a, b) => b.visits - a.visits).slice(0, 25);
  const max = top[0]?.visits || 1;
  $('#freqCount').textContent = `${by.size} sites · 30d`;
  $('#frequent').innerHTML = top.map((s, i) => `
    <li>
      <span class="n">${String(i + 1).padStart(2, '0')}</span>
      ${fi(s.url)}
      <span class="nm"><a href="${esc(s.url)}" title="${esc(s.title || s.key)}">${esc(cleanName(s.title, s.url))}</a><small>${esc(s.key)} · ${s.visits} visits</small></span>
      <span class="meter"><b style="width:${Math.max(4, (s.visits / max) * 100)}%;animation-delay:${i * 40}ms"></b></span>
      <button class="pin" data-url="${esc(new URL(s.url).origin)}" data-name="${esc(cleanName(s.title, s.url))}" title="Add to dock">＋</button>
    </li>`).join('') || '<p class="empty">No history yet.</p>';
  fitRanked();

  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const today = S.history.filter((i) => i.lastVisitTime >= +midnight);
  countUp($('#kVisits'), today.length);
  countUp($('#kSites'), new Set(today.map((i) => host(i.url))).size);
  const hours = Array(24).fill(0); today.forEach((i) => hours[new Date(i.lastVisitTime).getHours()]++);
  const hmax = Math.max(1, ...hours), nowH = new Date().getHours();
  $('#spark').innerHTML = hours.map((v, h) => `<i class="${h === nowH ? 'now' : ''}" data-h="${h}" data-v="${v}" style="height:${Math.max(6, (v / hmax) * 100)}%;--i:${h}"></i>`).join('');
  const peakH = hours.indexOf(Math.max(...hours));
  $('#todayMeta').dataset.rest = today.length ? `busiest ${String(peakH).padStart(2, '0')}:00` : '';
  $('#todayMeta').textContent = $('#todayMeta').dataset.rest;
  return top;
}
// Show only the rows that fit fully, so the card never ends on a half-cut row.
function fitRanked() {
  const box = $('[data-card="freq"]:not(.ghost) .card-b'), rows = $$('#frequent li');
  if (!box || !rows.length) return;
  rows.forEach((r) => r.classList.remove('over'));
  if (box.closest('.expanded')) return;
  const rowH = rows[0].offsetHeight + 2, room = box.clientHeight - 12;
  const n = Math.max(1, Math.floor(room / rowH));
  rows.forEach((r, i) => r.classList.toggle('over', i >= n));
}
new ResizeObserver(() => fitRanked()).observe($('[data-card="freq"] .card-b'));
$('#frequent').addEventListener('click', (e) => {
  const b = e.target.closest('.pin'); if (!b) return;
  if (addTool(b.dataset.name, b.dataset.url)) {
    burst(e.clientX, e.clientY); toast(`Added ${b.dataset.name} to your dock`);
    b.textContent = '✓'; b.classList.add('pinned');   // + morphs into a tick
  }
});

/* ---------- Micro-interaction: live readouts on hover ---------- */
// Today: hovering an hour bar shows its count in the header.
$('#spark').addEventListener('mouseover', (e) => {
  const i = e.target.closest('i[data-h]'); if (!i) return;
  $('#todayMeta').textContent = `${String(i.dataset.h).padStart(2, '0')}:00 · ${i.dataset.v} pages`;
  $('#todayMeta').classList.add('live');
});
$('#spark').addEventListener('mouseleave', () => { $('#todayMeta').textContent = $('#todayMeta').dataset.rest || ''; $('#todayMeta').classList.remove('live'); });
// Week: crosshair over the hovered day + hour, with a readout in the header.
let heatHL = [];
$('#heat').addEventListener('mouseover', (e) => {
  const c = e.target.closest('i[data-d]'); if (!c) return;
  heatHL.forEach((x) => x.classList.remove('hl', 'focus')); heatHL = [];
  $$('#heat i').forEach((x) => { if (x.dataset.d === c.dataset.d || x.dataset.h === c.dataset.h) { x.classList.add('hl'); heatHL.push(x); } });
  c.classList.add('focus');
  $('#heat').classList.add('probing');
  $('#peak').textContent = `${c.dataset.day} ${String(c.dataset.h).padStart(2, '0')}:00 · ${c.dataset.v} visits`;
  $('#peak').classList.add('live');
});
$('#heat').addEventListener('mouseleave', () => {
  heatHL.forEach((x) => x.classList.remove('hl', 'focus')); heatHL = [];
  $('#heat').classList.remove('probing');
  $('#peak').textContent = $('#peak').dataset.rest || ''; $('#peak').classList.remove('live');
});
async function loadHeatmap() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const from = +start - 6 * DAY;
  const items = S.history.filter((i) => i.lastVisitTime >= from).slice(0, 400);
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  const visits = await Promise.all(items.map((i) => chrome.history.getVisits({ url: i.url }).catch(() => [])));
  for (const v of visits.flat()) {
    if (v.visitTime < from) continue;
    const d = Math.floor((v.visitTime - from) / DAY);
    if (d >= 0 && d < 7) grid[d][new Date(v.visitTime).getHours()]++;
  }
  const max = Math.max(1, ...grid.flat());
  let peak = { v: 0, d: 0, h: 0 }, html = '';
  grid.forEach((row, d) => {
    const day = new Date(from + d * DAY);
    html += `<span>${d === 6 ? 'Tod' : day.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3)}</span>`;
    row.forEach((v, h) => {
      if (v > peak.v) peak = { v, d, h };
      html += `<i data-d="${d}" data-h="${h}" data-v="${v}" data-day="${d === 6 ? 'Today' : day.toLocaleDateString(undefined, { weekday: 'short' })}" style="--v:${v ? (0.12 + 0.88 * (v / max)).toFixed(2) : 0};--d:${d * 24 + h}"></i>`;
    });
  });
  $('#heat').innerHTML = html;
  $('#peak').dataset.rest = peak.v ? `peak ${new Date(from + peak.d * DAY).toLocaleDateString(undefined, { weekday: 'short' })} ${String(peak.h).padStart(2, '0')}:00` : '';
  $('#peak').textContent = $('#peak').dataset.rest;
}

/* ============================== Search + palette ============================== */
function score(q, ...fields) {
  q = q.toLowerCase(); let best = 0;
  for (const f of fields) {
    const s = (f || '').toLowerCase(); if (!s) continue;
    if (s.startsWith(q)) best = Math.max(best, 3);
    else if (s.split(/[\s.\-/·]/).some((w) => w.startsWith(q))) best = Math.max(best, 2);
    else if (s.includes(q)) best = Math.max(best, 1);
  }
  return best;
}
const looksLikeUrl = (q) => !/\s/.test(q) && /^(https?:\/\/|localhost|[\w-]+(\.[\w-]+)+)(:\d+)?(\/\S*)?$/i.test(q);
function buildResults(q) {
  q = q.trim();
  const out = [];
  const go = (url) => (e) => (e?.ctrlKey || e?.metaKey ? chrome.tabs.create({ url, active: false }) : (location.href = url));
  const toolRow = (t) => ({ icon: fav(t.url), title: t.name, sub: host(t.url), kind: openTabFor(t.url) ? 'switch' : 'tool', run: (e) => launchTool(t, e) || go(t.url)(e) });
  if (!q) { out.push({ group: 'Tools' }, ...S.tools.slice(0, 6).map(toolRow), { group: 'Actions' }, ...ACTIONS.slice(0, 5)); return out; }
  if (/^todo:\s*/i.test(q)) {
    const text = q.replace(/^todo:\s*/i, '');
    if (text) out.push({ glyph: '✓', title: `Add to-do: “${text}”`, kind: 'action', run: () => { addTodo(text); toast('Added to your to-do list'); } });
    return out;
  }
  if (looksLikeUrl(q)) out.push({ glyph: '↗', title: `Go to ${q}`, kind: 'url', run: go(/^https?:\/\//i.test(q) ? q : 'https://' + q) });
  const tools = S.tools.map((t) => [score(q, t.name, host(t.url), t.cat), t]).filter(([s]) => s).sort((a, b) => b[0] - a[0]).slice(0, 5);
  const tabs = S.tabs.map((t) => [score(q, t.title, host(t.url)), t]).filter(([s]) => s).sort((a, b) => b[0] - a[0]).slice(0, 5);
  const seen = new Set();
  const hist = S.history.map((h) => [score(q, h.title, host(h.url), h.url), h])
    .filter(([s, h]) => { const k = host(h.url) + '|' + (h.title || h.url); return s && !seen.has(k) && seen.add(k); })
    .sort((a, b) => b[0] - a[0] || b[1].visitCount - a[1].visitCount).slice(0, 6);
  const acts = ACTIONS.filter((a) => score(q, a.title, a.alias));
  if (tools.length) out.push({ group: 'Tools' }, ...tools.map(([, t]) => toolRow(t)));
  if (tabs.length) out.push({ group: 'Open tabs' }, ...tabs.map(([, t]) => ({ icon: fav(t.url), title: t.title, sub: host(t.url), kind: 'switch', run: () => switchTo(t) })));
  if (acts.length) out.push({ group: 'Actions' }, ...acts);
  if (hist.length) out.push({ group: 'History' }, ...hist.map(([, h]) => ({ icon: fav(h.url), title: h.title || h.url, sub: host(h.url), kind: ago(h.lastVisitTime), run: go(h.url) })));
  out.push({ group: 'Web' }, { glyph: 'G', title: `Search the web for “${q}”`, kind: 'enter', run: () => chrome.search.query({ text: q, disposition: 'CURRENT_TAB' }) });
  return out;
}
class ResultList {
  constructor(input, list, onClose) { this.input = input; this.list = list; this.items = []; this.idx = 0; this.onClose = onClose; this.bind(); }
  render(q) {
    this.items = buildResults(q);
    const sel = this.items.findIndex((r) => !r.group); this.idx = sel < 0 ? 0 : sel;
    this.list.innerHTML = this.items.map((r, i) => r.group ? `<li class="group" role="presentation">${esc(r.group)}</li>` : `
      <li role="option" data-i="${i}" aria-selected="${i === this.idx}">
        ${r.icon ? `<span class="fi sm"><img src="${r.icon}" alt=""></span>` : `<span class="glyph">${esc(r.glyph || '•')}</span>`}
        <span class="t">${esc(r.title)}</span>${r.sub ? `<span class="s">${esc(r.sub)}</span>` : ''}${r.kind ? `<span class="k">${esc(r.kind)}</span>` : ''}
      </li>`).join('');
  }
  move(d) {
    const opts = this.items.map((r, i) => (r.group ? -1 : i)).filter((i) => i >= 0);
    const p = opts.indexOf(this.idx); this.idx = opts[(p + d + opts.length) % opts.length];
    $$('[role=option]', this.list).forEach((li) => li.setAttribute('aria-selected', +li.dataset.i === this.idx));
    $(`[data-i="${this.idx}"]`, this.list)?.scrollIntoView({ block: 'nearest' });
  }
  run(i, e) { const r = this.items[i]; if (!r || r.group) return; this.onClose?.(); r.run(e); }
  bind() {
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); this.run(this.idx, e); }
    });
    this.list.addEventListener('mousedown', (e) => { const li = e.target.closest('[data-i]'); if (li) { e.preventDefault(); this.run(+li.dataset.i, e); } });
    this.list.addEventListener('mousemove', (e) => {
      const li = e.target.closest('[data-i]'); if (!li || +li.dataset.i === this.idx) return;
      this.idx = +li.dataset.i; $$('[role=option]', this.list).forEach((x) => x.setAttribute('aria-selected', x === li));
    });
  }
}
// Hero search: the bar stays put; the button grows into "Search →" while you type.
const searchBox = $('#gooey');
const heroList = new ResultList($('#q'), $('#heroResults'), () => $('#heroResults').classList.remove('show'));
$('#q').addEventListener('focus', () => { searchBox.classList.add('active'); if ($('#q').value.trim()) $('#heroResults').classList.add('show'); });
$('#q').addEventListener('blur', () => setTimeout(() => { $('#heroResults').classList.remove('show'); searchBox.classList.remove('active'); }, 120));
$('#q').addEventListener('input', (e) => {
  const has = !!e.target.value.trim();
  heroList.render(e.target.value);
  $('#heroResults').classList.toggle('show', has);
  searchBox.classList.toggle('typing', has);
});
$('#searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!$('#q').value.trim()) { $('#q').focus(); return; }
  heroList.run(heroList.idx, e);
});
// Clicking anywhere on the bar (icon, padding) focuses the input.
$('#searchForm').addEventListener('mousedown', (e) => { if (!e.target.closest('input, .s-go')) { e.preventDefault(); $('#q').focus(); } });

const pal = $('#palette');
const palList = new ResultList($('#pq'), $('#paletteResults'), () => closePalette());
function openPalette(prefill = '') { pal.hidden = false; $('#pq').value = prefill; palList.render(prefill); $('#pq').focus(); }
function closePalette() { pal.hidden = true; }
$('#pq').addEventListener('input', (e) => palList.render(e.target.value));
$('#paletteBtn').addEventListener('click', () => openPalette());
pal.addEventListener('mousedown', (e) => { if (e.target === pal) closePalette(); });

const ACTIONS = [
  { glyph: '◔', title: 'Start a 25-minute focus block', alias: 'focus pomodoro timer', kind: 'action', run: () => startFocus(25) },
  { glyph: '⧉', title: 'Close duplicate tabs', alias: 'dupes clean', kind: 'action', run: () => closeDupes().then((n) => !n && toast('No duplicates')) },
  { glyph: '▣', title: 'Save this window as a workspace', alias: 'workspace session save', kind: 'action', run: () => showWsForm() },
  { glyph: '+', title: 'Add a tool to the dock', alias: 'pin new tool', kind: 'action', run: () => openModal() },
  { glyph: '◐', title: 'Toggle light / dark', alias: 'theme dark light mode', kind: 'action', run: () => toggleTheme() },
  { glyph: '✎', title: 'Write in scratchpad', alias: 'notes', kind: 'action', run: () => $('#notes').focus() },
  { glyph: '↺', title: 'Reopen last closed tab', alias: 'restore undo', kind: 'action', run: () => chrome.sessions.restore() },
];

/* ============================== Keyboard ============================== */
document.addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.hidden ? openPalette() : closePalette(); return; }
  if (e.key === 'Escape') {
    if (!pal.hidden) closePalette(); else if (modal.classList.contains('show')) closeModal(); else if (expanded) collapseCard();
    setNotch(false); if (document.activeElement === $('#q')) $('#q').blur(); return;
  }
  if (e.altKey && /^[1-9]$/.test(e.key)) { const t = S.tools[+e.key - 1]; if (t) { e.preventDefault(); launchTool(t); } return; }
  if (typing) return;
  if (e.key === '/') { e.preventDefault(); $('#q').focus(); }
  if (e.key === 'b') { e.preventDefault(); setNotch($('#notch').dataset.open !== 'true'); }
});

/* ============================== Theme ============================== */
function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  const swap = () => { document.documentElement.dataset.theme = next; localStorage.setItem('theme', next); };
  document.startViewTransition ? document.startViewTransition(swap) : swap();
}
$('#themeBtn').addEventListener('click', toggleTheme);

/* ============================== Focus timer ============================== */
const RING = 2 * Math.PI * 52;
function renderFocus() {
  const f = S.focus;
  const total = (f ? f.duration : S.focusPreset) * 6e4;
  const remaining = f ? (f.paused ? f.remaining : Math.max(0, f.endAt - Date.now())) : total;
  const m = Math.floor(remaining / 6e4), s = Math.floor((remaining % 6e4) / 1000);
  const clock = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  roll($('#focusTime'), clock);
  $('#ringFg').style.strokeDashoffset = (RING * (1 - remaining / total)).toFixed(2);
  const state = !f ? 'idle' : f.paused ? 'paused' : remaining <= 0 ? 'done' : 'running';
  $('[data-card="focus"]').dataset.state = state;
  $('#focusState').textContent = { idle: 'Ready', paused: 'Paused', running: 'Deep work', done: 'Done' }[state];
  $('#focusStart').textContent = { idle: 'Start', paused: 'Resume', running: 'Pause', done: 'Start' }[state];
  $('#focusToday').textContent = `${S.focusLog[todayKey()] || 0} min today`;
  $('#focusNote').textContent = state === 'running' ? `Ends at ${new Date(f.endAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : 'Notifies you when done, even if this tab is closed.';
  document.title = state === 'running' ? `${clock} · Focus` : 'New Tab';
}
async function startFocus(min = S.focusPreset) {
  if (!has('alarms')) { toast('Apply the update first (see Daily brief)'); return; }
  S.focus = { duration: min, endAt: Date.now() + min * 6e4, paused: false };
  await chrome.alarms.create('focus', { when: S.focus.endAt });
  await store.set({ focus: S.focus }); renderFocus();
  toast(`Focus started · ${min} min`);
}
$('#focusStart').addEventListener('click', async () => {
  const f = S.focus;
  if (!f || (Date.now() >= f.endAt && !f.paused)) return startFocus();
  if (f.paused) { f.endAt = Date.now() + f.remaining; f.paused = false; delete f.remaining; await chrome.alarms.create('focus', { when: f.endAt }); }
  else { f.remaining = Math.max(0, f.endAt - Date.now()); f.paused = true; await chrome.alarms.clear('focus'); }
  await store.set({ focus: f }); renderFocus();
});
$('#focusReset').addEventListener('click', async () => { S.focus = null; if (has('alarms')) await chrome.alarms.clear('focus'); await store.set({ focus: null }); renderFocus(); });
$('#focusPresets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-m]'); if (!b) return;
  S.focusPreset = +b.dataset.m; $$('#focusPresets button').forEach((x) => x.classList.toggle('active', x === b));
  segInd($('#focusPresets'));
  if (!S.focus) renderFocus();
});

/* ============================== To-do ============================== */
function renderTodos() {
  const open = S.todos.filter((t) => !t.done).length;
  $('#todoCount').textContent = `${open} open`;
  $('#todos').innerHTML = S.todos.map((t, i) => `
    <li class="${t.done ? 'done' : ''}" data-k="${t.created || i}" style="animation-delay:${i * 25}ms">
      <input type="checkbox" class="check" data-i="${i}" ${t.done ? 'checked' : ''} aria-label="Done">
      <span>${esc(t.text)}</span><button class="mini-x" data-del="${i}" title="Delete" aria-label="Delete">✕</button>
    </li>`).join('') || '<p class="empty">Add the one thing that matters today.</p>';
  countUp($('#kDone'), S.doneLog[todayKey()] || 0);
  renderSummary();
}
const saveTodos = () => { store.set({ todos: S.todos, doneLog: S.doneLog }); renderTodos(); buildBrief(); };
function addTodo(text) { S.todos.unshift({ text, done: false, created: Date.now() }); saveTodos(); }
function setDone(i, done) {
  const t = S.todos[i]; if (!t || t.done === done) return;
  t.done = done; const k = todayKey(); S.doneLog[k] = Math.max(0, (S.doneLog[k] || 0) + (done ? 1 : -1));
  // Let the strike-through play, then glide finished tasks to the bottom (FLIP).
  $(`#todos li[data-k="${t.created || i}"]`)?.classList.toggle('done', done);
  clearTimeout(setDone.t);
  setDone.t = setTimeout(() => {
    const before = new Map($$('#todos li').map((li) => [li.dataset.k, li.getBoundingClientRect().top]));
    S.todos.sort((a, b) => a.done - b.done);
    saveTodos();
    $$('#todos li').forEach((li) => {
      li.style.animation = 'none';
      const dy = (before.get(li.dataset.k) ?? li.getBoundingClientRect().top) - li.getBoundingClientRect().top;
      if (dy && !REDUCED) li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
  }, 650);
}
$('#todoForm').addEventListener('submit', (e) => { e.preventDefault(); const v = $('#todoInput').value.trim(); if (v) { addTodo(v); $('#todoInput').value = ''; } });
$('#todos').addEventListener('click', (e) => {
  const del = e.target.closest('[data-del]');
  if (del) { S.todos.splice(+del.dataset.del, 1); saveTodos(); return; }
  if (e.target.matches('.check')) { if (e.target.checked) burst(e.clientX, e.clientY); setDone(+e.target.dataset.i, e.target.checked); }
});

/* ============================== Notes ============================== */
let noteTimer;
// Header shows a live word count with a status dot: pulsing orange while saving, green when saved.
function noteMeta(state) {
  const words = ($('#notes').value.match(/\S+/g) || []).length;
  $('#savedTag').className = `meta note-${state}`;
  $('#savedTag').innerHTML = `<i class="sv-dot"></i>${words} word${words === 1 ? '' : 's'} · ${state}`;
}
$('#notes').addEventListener('input', () => {
  noteMeta('saving'); clearTimeout(noteTimer);
  noteTimer = setTimeout(() => { store.set({ notes: $('#notes').value }); noteMeta('saved'); }, 400);
});

/* ============================== Workspaces ============================== */
function renderWs() {
  $('#wsList').innerHTML = S.workspaces.map((w, i) => `
    <li data-open="${i}" title="Open in a new window">
      <span class="stack">${w.urls.slice(0, 4).map((u) => fi(u, 'sm')).join('')}</span>
      <span class="t-main"><span class="t-title">${esc(w.name)}</span><span class="t-sub">${w.urls.length} tabs · ${ago(w.saved)} ago</span></span>
      <button class="mini-x" data-del="${i}" title="Delete workspace" aria-label="Delete workspace">✕</button>
    </li>`).join('');
  if (!S.workspaces.length) {
    // Empty state previews what would be saved: this window's tabs.
    const cur = S.tabs.filter((t) => t.windowId === S.winId);
    $('#wsList').innerHTML = `<button class="ws-empty" id="wsEmpty">
      <span class="pile">${cur.slice(0, 6).map((t) => fi(t.url)).join('') || fi('https://www.google.com')}</span>
      <span class="t-main"><span class="t-title">${cur.length ? `Save these ${cur.length} tabs` : 'Save a window of tabs'}</span>
      <span class="t-sub">Reopen the whole set later in one click</span></span>
      <span class="plus">+</span></button>`;
  }
}
$('#wsList').addEventListener('click', (e) => { if (e.target.closest('#wsEmpty')) showWsForm(); });
function showWsForm() { $('#wsForm').hidden = false; $('#wsName').focus(); }
$('#saveWsBtn').addEventListener('click', showWsForm);
$('#wsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!has('tabs')) { toast('Apply the update first (see Daily brief)'); return; }
  const tabs = (await chrome.tabs.query({ currentWindow: true })).filter((t) => isWeb(t.url));
  if (!tabs.length) { toast('No web tabs in this window'); return; }
  const name = $('#wsName').value.trim() || `Workspace · ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
  S.workspaces.unshift({ name, urls: tabs.map((t) => t.url), saved: Date.now() });
  await store.set({ workspaces: S.workspaces });
  $('#wsName').value = ''; $('#wsForm').hidden = true; renderWs();
  toast(`Saved “${name}” · ${tabs.length} tabs`);
});
$('#wsName').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); $('#wsForm').hidden = true; } });
$('#wsList').addEventListener('click', async (e) => {
  const del = e.target.closest('[data-del]');
  if (del) {
    e.stopPropagation();
    const i = +del.dataset.del, [w] = S.workspaces.splice(i, 1); await store.set({ workspaces: S.workspaces }); renderWs();
    toast(`Deleted “${w.name}”`, { label: 'Undo', run: async () => { S.workspaces.splice(i, 0, w); await store.set({ workspaces: S.workspaces }); renderWs(); } });
    return;
  }
  const li = e.target.closest('[data-open]'); if (li) chrome.windows.create({ url: S.workspaces[+li.dataset.open].urls, focused: true });
});

/* ============================== Recently closed ============================== */
async function loadClosed() {
  const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 25 });
  const rows = sessions.map((s) => {
    if (s.tab && isWeb(s.tab.url)) return { id: s.tab.sessionId, url: s.tab.url, title: s.tab.title, sub: host(s.tab.url), t: s.lastModified };
    if (s.window) { const t = s.window.tabs?.find((x) => isWeb(x.url)); if (t) return { id: s.window.sessionId, url: t.url, title: `Window · ${s.window.tabs.length} tabs`, sub: t.title, t: s.lastModified }; }
    return null;
  }).filter(Boolean);
  $('#closed').innerHTML = rows.map((r) => `
    <li><button class="row-btn" data-sid="${esc(r.id)}">${fi(r.url)}
      <span class="t-main"><span class="t-title">${esc(r.title || host(r.url))}</span><span class="t-sub">${esc(r.sub)}${r.t ? ' · ' + ago(r.t * 1000) : ''}</span></span></button></li>`
  ).join('') || '<p class="empty">Nothing closed recently.</p>';
}
$('#tabsSeg').addEventListener('click', (e) => {
  const b = e.target.closest('[data-v]'); if (!b) return;
  $('[data-card="tabs"]').dataset.view = b.dataset.v;
  $$('#tabsSeg button').forEach((x) => x.classList.toggle('active', x === b));
  segInd($('#tabsSeg'));
  $('#closeDupesBtn').hidden = b.dataset.v !== 'open' || !dupeGroups().length;
  // Crossfade the list that comes into view.
  const list = b.dataset.v === 'open' ? $('#tabsList') : $('#closed');
  if (!REDUCED) list.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
});
$('#closed').addEventListener('click', (e) => { const b = e.target.closest('[data-sid]'); if (b) chrome.sessions.restore(b.dataset.sid); });
chrome.sessions.onChanged.addListener(() => loadClosed());

/* ============================== Fluid notch: Daily brief ============================== */
let brief = [];
const dismissed = new Set(JSON.parse(sessionStorage.getItem('briefDismissed') || '[]'));
function buildBrief() {
  const items = [];
  if (NEEDS_RELOAD) items.push({
    id: 'reload-' + VERSION, kicker: 'Update ready', sticky: true,
    title: 'Apply the new version',
    text: 'Chrome is still running the old manifest, so tab switching, the focus timer and workspaces are off. This reloads the extension (this tab will close; open a new one).',
    meta: [], no: 'Later', yes: 'Apply update', run: () => chrome.runtime.reload(),
  });
  const dupes = dupeGroups(), dupeCount = dupes.reduce((n, g) => n + g.length - 1, 0);
  if (dupeCount) items.push({
    id: 'dupes', kicker: 'Tab hygiene', title: `Close ${dupeCount} duplicate tab${dupeCount > 1 ? 's' : ''}?`,
    text: 'The same page is open more than once. Keeping one copy of each frees memory.',
    meta: dupes.slice(0, 4).map((g) => ({ icon: fav(g[0].url), label: `${cleanName(g[0].title, g[0].url)} ×${g.length}` })),
    no: 'Keep them', yes: 'Close duplicates', run: closeDupes,
  });
  const stale = S.tabs.filter((t) => !t.active && !t.pinned && !t.audible && t.lastAccessed && Date.now() - t.lastAccessed > 2 * DAY);
  if (stale.length >= 2) items.push({
    id: 'stale', kicker: 'Tab hygiene', title: `${stale.length} tabs untouched for 2+ days`,
    text: 'They stay in Recently closed, so any of them is one click away.',
    meta: stale.slice(0, 4).map((t) => ({ icon: fav(t.url), label: cleanName(t.title, t.url) })),
    no: 'Not now', yes: `Close ${stale.length} tabs`, run: async () => { await chrome.tabs.remove(stale.map((t) => t.id)); toast(`Closed ${stale.length} stale tabs`); },
  });
  if (S.tabs.length >= 15) items.push({
    id: 'save-ws', kicker: 'Workspaces', title: `${S.tabs.length} tabs open. Save this window?`,
    text: 'Save it as a workspace so you can close it with confidence and reopen it later.',
    meta: [], no: 'Later', yes: 'Save workspace', run: () => showWsForm(),
  });
  const t = S.todos.find((x) => !x.done);
  if (t) items.push({
    id: 'todo-' + t.created, kicker: 'To-do', title: t.text.length > 60 ? t.text.slice(0, 58) + '…' : t.text,
    text: t.created ? `On your list for ${ago(t.created)}. Done, or push it down?` : 'Done, or push it down?',
    meta: [], no: 'Snooze', yes: 'Mark done',
    run: () => setDone(S.todos.indexOf(t), true),
    skip: () => { S.todos.splice(S.todos.indexOf(t), 1); S.todos.push(t); saveTodos(); },
  });
  if (!S.focus && !(S.focusLog[todayKey()] > 0) && new Date().getHours() >= 8 && has('alarms')) items.push({
    id: 'focus', kicker: 'Focus', title: 'No deep work yet today',
    text: 'Start a 25-minute block. You get a desktop notification when it ends, even if this tab is closed.',
    meta: [], no: 'Later', yes: 'Start 25 min', run: () => startFocus(25),
  });
  brief = items.filter((i) => i.sticky || !dismissed.has(i.id));
  renderNotch(); renderSummary();
}
function renderNotch() {
  const n = brief.length, notch = $('#notch'), cnt = $('#notchCount');
  notch.dataset.has = n > 0;
  if (+cnt.textContent !== n) { cnt.classList.add('bump'); setTimeout(() => cnt.classList.remove('bump'), 300); }
  cnt.textContent = n;
  $('#notchLabel').textContent = !n ? 'All clear' : brief[0].sticky ? 'Update ready' : 'Daily brief';
  $('#notchFaces').innerHTML = brief.flatMap((b) => b.meta.map((m) => m.icon)).slice(0, 3).map((u) => `<img src="${u}" alt="">`).join('');
  const b = brief[0];
  if (!b) { if (notch.dataset.open === 'true') setNotch(false); return; }
  $('#notchKicker').textContent = b.kicker; $('#notchStep').textContent = `1 of ${n}`;
  $('#notchTitle').textContent = b.title; $('#notchText').textContent = b.text;
  $('#notchMeta').innerHTML = b.meta.map((m) => `<span><img src="${m.icon}" alt="">${esc(m.label)}</span>`).join('');
  $('#notchNo').textContent = b.no; $('#notchYes').textContent = b.yes;
}
function setNotch(open) {
  if (open && !brief.length) { toast('All clear. Nothing needs you right now.'); return; }
  const was = $('#notch').dataset.open === 'true';
  $('#notch').dataset.open = open; $('#notchPill').setAttribute('aria-expanded', open);
  if (open && !was) encrypt($('#notchTitle'), brief[0].title, 500);
}
$('#notchPill').addEventListener('click', () => setNotch($('#notch').dataset.open !== 'true'));
async function answer(yes, e) {
  const b = brief[0]; if (!b) return;
  if (yes) { burst(e.clientX, e.clientY); await b.run?.(); } else if (b.skip) b.skip();
  if (!b.sticky || !yes) { dismissed.add(b.id); sessionStorage.setItem('briefDismissed', JSON.stringify([...dismissed])); }
  setNotch(false);
  setTimeout(() => { brief = brief.filter((x) => x.id !== b.id); renderNotch(); renderSummary(); }, 380);
}
$('#notchYes').addEventListener('click', (e) => answer(true, e));
$('#notchNo').addEventListener('click', (e) => answer(false, e));
document.addEventListener('mousedown', (e) => { if (!e.target.closest('#notch')) setNotch(false); });

/* ============================== Storage sync ============================== */
chrome.storage.onChanged.addListener((ch) => {
  if (ch.focus) { S.focus = ch.focus.newValue || null; renderFocus(); }
  if (ch.focusLog) { S.focusLog = ch.focusLog.newValue || {}; renderFocus(); buildBrief(); }
});

/* ============================== Boot ============================== */
(async function init() {
  $$('[data-fav]').forEach((img) => { img.src = fav(img.dataset.fav); });
  tick(); setInterval(tick, 1000);

  const d = await store.get(['tools', 'toolsVersion', 'notes', 'todos', 'doneLog', 'name', 'workspaces', 'focus', 'focusLog']);
  // Older versions saved the placeholder "there" as the name; treat that as unset.
  // No name saved yet: show a neutral default. Click the name on the page to set your own (stored locally only).
  nameEl.textContent = d.name || 'there';
  encrypt(nameEl, nameEl.textContent, 1100);
  $('#notes').value = d.notes || '';
  noteMeta('saved');
  requestAnimationFrame(segIndAll); document.fonts?.ready.then(segIndAll);
  S.todos = d.todos || []; S.doneLog = d.doneLog || {}; S.workspaces = d.workspaces || [];
  S.focus = d.focus || null; S.focusLog = d.focusLog || {};
  renderTodos(); renderWs(); renderFocus();

  const [top] = await Promise.all([loadHistory().catch(() => []), loadTabs().catch(() => {}), loadClosed().catch(() => {})]);

  if (d.tools && d.toolsVersion === 3) {
    S.tools = d.tools;
  } else {
    // First run, or upgrading: rebuild names, drop junk, dedupe, keep the user's order.
    const seen = new Set(), list = [];
    const push = (name, url) => {
      if (isJunk(url)) return;
      const k = toolKey(url); if (seen.has(k)) return; seen.add(k);
      const n = cleanName(name, url);
      list.push({ name: n, url, cat: categorize(url, n) });
    };
    (d.tools || []).forEach((t) => push(t.name, t.url));
    if (!d.tools) {
      (await chrome.topSites.get().catch(() => [])).forEach((s) => push(s.title, s.url));
      DEFAULT_TOOLS.forEach(([n, u]) => push(n, u));
      top.slice(0, 6).forEach((s) => push(s.title, new URL(s.url).origin));
    }
    S.tools = list.slice(0, 18);
    store.set({ tools: S.tools, toolsVersion: 3 });
  }
  renderDock();
  buildBrief();
  if (NEEDS_RELOAD) setTimeout(() => setNotch(true), 900);
  loadHeatmap().catch(() => {});
})();
