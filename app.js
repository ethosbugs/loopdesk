'use strict';
/* =====================================================================
   Loopdesk v2 — escritorio + reproductor (local, YouTube, Spotify embed, Audius, Jamendo)
   Datos: localStorage (escritorio/ajustes) + IndexedDB (audio y fondo)
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const enc = encodeURIComponent;
const dec = s => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };
const fmt = s => isFinite(s) && s > 0 ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '0:00';

/* ---------------------------- iconos propios (SVG) ---------------------------- */
const GL = {
  music: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M5 17l5-4 3 2.5 3-3 3 3"/>',
  pen: '<path d="M5 19l1-4L16 5l3 3L9 18z"/><path d="M14 7l3 3"/>',
  folder: '<path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>',
  globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>',
  star: '<path d="M12 4l2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.8 5.4-.7z"/>',
  play: '<path d="M9 6l9 6-9 6z"/>',
  bolt: '<path d="M13 3L6 13h5l-1 8 7-10h-5z"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8.5 4.8 4.8 0 0 1 17 18z"/>',
};
const glyph = (k, s = 34) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${GL[k] || GL.globe}</svg>`;
const I = {
  prev: '<path d="M7 5v14"/><path d="M19 5L9 12l10 7z" fill="currentColor"/>',
  next: '<path d="M17 5v14"/><path d="M5 5l10 7-10 7z" fill="currentColor"/>',
  play: '<path d="M8 5l11 7-11 7z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3.2"/>',
  heart: GL.heart,
  shuf: '<path d="M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4"/><path d="M18 4l3 3-3 3M18 14l3 3-3 3"/>',
  down: '<path d="M6 9l6 6 6-6"/>', up: '<path d="M6 15l6-6 6 6"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  pip: '<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="12" y="11" width="7" height="5" rx="1" fill="currentColor"/>',
  dl: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
};
const ic = (n, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;

/* ---------------------------- estado ---------------------------- */
const DEF = {
  wall: { type: 'color', value: '#0c0c10', fit: 'cover', dim: .25 },
  mini: { visible: true, mode: 'full', cover: true, accent: '#1db954', style: 'glass', op: .94, scale: 1, x: null, y: null },
  keys: { yt: '', jamendo: '' },
  vol: 1,
  favs: [],
  items: [
    { id: 'player', type: 'player', title: 'Música', icon: { k: 'glyph', v: 'music', bg: '#1db954' }, x: 70, y: 70, parent: null },
    { id: 'favs', type: 'favs', title: 'Favoritos', icon: { k: 'glyph', v: 'heart', bg: '#e11d48' }, x: 70, y: 200, parent: null },
    { id: 'wall', type: 'wall', title: 'Fondo', icon: { k: 'glyph', v: 'image', bg: '#6d5cff' }, x: 70, y: 330, parent: null },
    { id: 'n1', type: 'note', title: 'Bienvenida', icon: { k: 'glyph', v: 'pen', bg: '#f59e0b' }, x: 70, y: 460, parent: null,
      text: 'Doble clic para abrir.\nClic derecho: crear, renombrar, cambiar icono o borrar.\nArrastra un elemento sobre una carpeta para guardarlo dentro.\nSuelta audios o enlaces sobre el escritorio.' },
  ],
};
let S; try { S = JSON.parse(localStorage.getItem('ld2')); } catch { }
{ const d = structuredClone(DEF); S = Object.assign(d, S || {}); S.wall = { ...DEF.wall, ...S.wall }; S.mini = { ...DEF.mini, ...S.mini }; S.keys = { ...DEF.keys, ...S.keys }; }
const save = () => localStorage.setItem('ld2', JSON.stringify(S));
const byId = id => S.items.find(i => i.id === id);
let toastT;
function toast(m) {
  let t = $('#toast'); if (!t) { t = el('div'); t.id = 'toast'; document.body.append(t); }
  t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 4500);
}

/* ---------------------------- IndexedDB ---------------------------- */
const dbp = new Promise((res, rej) => {
  const r = indexedDB.open('loopdesk', 2);
  r.onupgradeneeded = () => {
    const d = r.result;
    if (!d.objectStoreNames.contains('tracks')) d.createObjectStore('tracks', { keyPath: 'id' });
    if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs');
  };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const tx = async (store, mode, fn) => {
  const d = await dbp;
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode), r = fn(t.objectStore(store));
    t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error);
  });
};
let lib = [];
const refreshLib = async () => {
  lib = ((await tx('tracks', 'readonly', s => s.getAll())) || []).sort((a, b) => a.added - b.added).map(t => ({ ...t, src: 'file' }));
  emit(true);
};
const putTrack = t => { const { src, ...r } = t; return tx('tracks', 'readwrite', s => s.put(r)); };
const delTrack = id => tx('tracks', 'readwrite', s => s.delete(id));
async function addFiles(files) {
  const list = [...files].filter(f => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|ogg|opus|wav|flac|weba)$/i.test(f.name));
  for (const f of list) {
    const base = f.name.replace(/\.[^.]+$/, ''), m = base.split(/\s+-\s+/);
    await putTrack({ id: uid(), name: m.length > 1 ? m.slice(1).join(' - ') : base, artist: m.length > 1 ? m[0] : '', blob: f, added: Date.now() });
  }
  await refreshLib(); return list.length;
}

/* ---------------------------- pistas ---------------------------- */
const keyOf = t => t.src === 'file' ? 'f' + t.id : t.src === 'yt' ? 'y' + t.vid : t.src === 'sp' ? 's' + t.sid : 'u' + t.url;
const slim = t => { const { blob, ...r } = t; return r; };
const isFav = t => !!t && S.favs.some(f => keyOf(f) === keyOf(t));
function toggleFav(t) {
  if (!t) return;
  const k = keyOf(t), i = S.favs.findIndex(f => keyOf(f) === k);
  if (i >= 0) S.favs.splice(i, 1); else S.favs.push(slim(t));
  save(); emit(true);
}
const favTracks = () => S.favs.map(f => f.src === 'file' ? lib.find(x => x.id === f.id) : f).filter(Boolean);
const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const cover = t => t && t.thumb ? `center/cover url('${t.thumb}')` :
  `linear-gradient(135deg,hsl(${hue(t ? t.name : 'x')} 70% 45%),hsl(${(hue(t ? t.name : 'x') + 60) % 360} 70% 28%))`;
const badgeOf = t => ({ yt: 'YouTube', sp: 'Spotify', url: 'Online', file: 'Local' }[t.src]);

/* ---------------------------- motor de reproducción ---------------------------- */
const audio = new Audio(); audio.preload = 'metadata'; audio.volume = S.vol;
const P = { queue: [], i: -1, cur: null, url: null, shuf: false, rep: false, yt: null, ytp: null, ytPaused: true, ytTime: 0, ytDur: 0, poll: 0 };
const subs = new Set(), tsubs = new Set();
const emit = full => subs.forEach(f => f(full)); const tick = () => tsubs.forEach(f => f());
['play', 'pause', 'loadedmetadata'].forEach(e => audio.addEventListener(e, () => emit()));
audio.addEventListener('timeupdate', tick);
audio.addEventListener('ended', () => next(true));
audio.addEventListener('error', () => { if (P.cur && P.cur.src !== 'yt') toast('No se puede reproducir esta pista.'); });
const kind = () => P.cur && P.cur.src;
const isYT = () => kind() === 'yt';
const isPaused = () => isYT() ? P.ytPaused : kind() === 'sp' ? false : audio.paused;
const curTime = () => isYT() ? P.ytTime : audio.currentTime || 0;
const durTime = () => isYT() ? P.ytDur : (isFinite(audio.duration) ? audio.duration : 0);

const ytApi = () => P.ytp || (P.ytp = new Promise(res => {
  if (window.YT && YT.Player) return res();
  const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.append(s);
  window.onYouTubeIframeAPIReady = res;
}));
function ytState(e) { const s = e.data; P.ytPaused = s !== 1 && s !== 3; if (s === 0) next(true); emit(); }
function ytTick() { if (!P.yt || !isYT()) return; try { P.ytTime = P.yt.getCurrentTime() || 0; P.ytDur = P.yt.getDuration() || 0; } catch { } tick(); }
async function ytLoad(id) {
  await ytApi();
  if (!P.yt) await new Promise(r => { P.yt = new YT.Player('ytp', { width: '100%', height: '100%', playerVars: { playsinline: 1, rel: 0 }, events: { onReady: r, onStateChange: ytState } }); });
  P.yt.loadVideoById(id); P.yt.setVolume(Math.round(audio.volume * 100));
  clearInterval(P.poll); P.poll = setInterval(ytTick, 500);
}
function showBox(t) {
  const vb = $('#vbox'), yt = $('#ytp'), sp = $('#spf');
  vb.hidden = !(t.src === 'yt' || t.src === 'sp');
  if (yt) yt.style.display = t.src === 'yt' ? '' : 'none';
  sp.hidden = t.src !== 'sp';
  if (t.src === 'sp') sp.src = `https://open.spotify.com/embed/${t.kind || 'track'}/${t.sid}?utm_source=generator`; else if (sp.src) sp.src = 'about:blank';
}
function stopAll() {
  audio.pause();
  if (P.yt) try { P.yt.pauseVideo(); } catch { }
  P.ytPaused = true; P.ytTime = 0; P.ytDur = 0;
  if (P.url) { URL.revokeObjectURL(P.url); P.url = null; }
}
async function play(list, i) {
  const t = list[i]; if (!t) return;
  stopAll(); P.queue = list; P.i = i; P.cur = t; showBox(t);
  if (!S.mini.visible) { S.mini.visible = true; save(); applyMini(); }
  if (t.src === 'yt') { try { await ytLoad(t.vid); } catch { toast('No se pudo cargar YouTube.'); } }
  else if (t.src === 'sp') toast('Spotify: la reproducción es la de su reproductor oficial (preview de 30 s si no has iniciado sesión).');
  else {
    if (t.blob) { P.url = URL.createObjectURL(t.blob); audio.src = P.url; } else audio.src = t.url;
    try { await audio.play(); } catch (e) { console.warn(e); }
  }
  if ('mediaSession' in navigator) {
    try { navigator.mediaSession.metadata = new MediaMetadata({ title: t.name, artist: t.artist || '', artwork: t.thumb ? [{ src: t.thumb }] : [] }); } catch { }
  }
  emit();
}
function toggle() {
  if (!P.cur) { if (lib.length) play(lib, 0); else openPlayer('web'); return; }
  if (isYT()) { P.ytPaused ? P.yt.playVideo() : P.yt.pauseVideo(); return; }
  if (kind() === 'sp') return;
  audio.paused ? audio.play() : audio.pause();
}
function next(auto) {
  if (!P.queue.length) return;
  let i;
  if (P.shuf) i = Math.floor(Math.random() * P.queue.length);
  else { i = P.i + 1; if (i >= P.queue.length) { if (P.rep || !auto) i = 0; else { stopAll(); emit(); return; } } }
  play(P.queue, i);
}
function prev() {
  if (!P.queue.length) return;
  if (curTime() > 3) { seekTo(0); return; }
  play(P.queue, (P.i - 1 + P.queue.length) % P.queue.length);
}
function seekTo(f) { const d = durTime(); if (!d) return; if (isYT()) P.yt.seekTo(f * d, true); else audio.currentTime = f * d; }
function setVol(v) { audio.volume = v; S.vol = v; save(); if (P.yt) try { P.yt.setVolume(Math.round(v * 100)); } catch { } }
if ('mediaSession' in navigator) {
  const ms = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch { } };
  ms('play', toggle); ms('pause', toggle); ms('previoustrack', prev); ms('nexttrack', () => next());
  ms('seekto', d => { const du = durTime(); if (du) seekTo(d.seekTime / du); });
}
let lastPos = 0;
tsubs.add(() => {
  const n = Date.now(); if (n - lastPos < 1000 || !('mediaSession' in navigator)) return; lastPos = n;
  const d = durTime(); if (d) try { navigator.mediaSession.setPositionState({ duration: d, position: Math.min(curTime(), d), playbackRate: 1 }); } catch { }
});

/* ---------------------------- fuentes de música ---------------------------- */
const PIPED = ['https://pipedapi.kavin.rocks', 'https://pipedapi.adminforge.de'];
async function ytSearch(q) {
  const k = S.keys.yt;
  if (k) {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=25&q=${enc(q)}&key=${enc(k)}`);
    if (!r.ok) throw new Error('yt ' + r.status);
    const j = await r.json();
    return (j.items || []).map(it => ({ src: 'yt', vid: it.id.videoId, name: dec(it.snippet.title), artist: dec(it.snippet.channelTitle), thumb: it.snippet.thumbnails.medium.url }));
  }
  for (const base of PIPED) {
    try {
      const r = await fetch(`${base}/search?q=${enc(q)}&filter=music_songs`); if (!r.ok) continue;
      const j = await r.json();
      const out = (j.items || []).filter(x => x.url && x.url.includes('v=')).map(x => ({ src: 'yt', vid: x.url.split('v=')[1].slice(0, 11), name: x.title, artist: x.uploaderName, thumb: x.thumbnail }));
      if (out.length) return out;
    } catch { }
  }
  throw new Error('Sin YouTube');
}
async function audiusSearch(q) {
  const r = await fetch(`https://api.audius.co/v1/tracks/search?query=${enc(q)}&limit=20&app_name=loopdesk`);
  if (!r.ok) throw new Error('audius'); const j = await r.json();
  return (j.data || []).map(d => ({ src: 'url', url: `https://api.audius.co/v1/tracks/${d.id}/stream?app_name=loopdesk`, name: d.title, artist: d.user && d.user.name, thumb: d.artwork && d.artwork['150x150'], from: 'Audius' }));
}
async function jamendoSearch(q) {
  const r = await fetch(`https://api.jamendo.com/v3.0/tracks/?client_id=${enc(S.keys.jamendo)}&format=json&limit=20&search=${enc(q)}&audiodlformat=mp32`);
  if (!r.ok) throw new Error('jamendo'); const j = await r.json();
  return (j.results || []).map(d => ({ src: 'url', url: d.audio, dl: d.audiodownload_allowed ? d.audiodownload : null, name: d.name, artist: d.artist_name, thumb: d.image, from: 'Jamendo' }));
}
function parseLink(s) {
  let m;
  if ((m = s.match(/(?:youtu\.be\/|[?&]v=|shorts\/|embed\/)([\w-]{11})/))) return { src: 'yt', vid: m[1] };
  if ((m = s.match(/open\.spotify\.com\/(?:intl-\w+\/)?(track|album|playlist|episode)\/(\w+)/))) return { src: 'sp', kind: m[1], sid: m[2] };
  if (/^https?:\/\/\S+\.(mp3|m4a|ogg|opus|wav|flac|aac)(\?\S*)?$/i.test(s)) return { src: 'url', url: s };
  return null;
}
async function resolveLink(l) {
  try {
    if (l.src === 'yt') {
      const j = await (await fetch('https://www.youtube.com/oembed?format=json&url=' + enc('https://www.youtube.com/watch?v=' + l.vid))).json();
      return { ...l, name: j.title, artist: j.author_name, thumb: `https://i.ytimg.com/vi/${l.vid}/mqdefault.jpg` };
    }
    if (l.src === 'sp') {
      const j = await (await fetch('https://open.spotify.com/oembed?url=' + enc(`https://open.spotify.com/${l.kind}/${l.sid}`))).json();
      return { ...l, name: j.title, artist: 'Spotify', thumb: j.thumbnail_url };
    }
  } catch { }
  return { ...l, name: l.src === 'url' ? decodeURIComponent(l.url.split('/').pop().split('?')[0]) : l.src === 'yt' ? 'Vídeo de YouTube' : 'Spotify', artist: l.src === 'sp' ? 'Spotify' : '', thumb: l.src === 'yt' ? `https://i.ytimg.com/vi/${l.vid}/mqdefault.jpg` : undefined };
}
async function saveRemote(t) {
  const u = t.dl || t.url; const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status);
  await putTrack({ id: uid(), name: t.name, artist: t.artist || '', thumb: t.thumb, blob: await r.blob(), added: Date.now() });
  await refreshLib();
}

/* ---------------------------- utilidades UI ---------------------------- */
function drag(handle, target, { onmove, onend, off = 0, min = 0 } = {}) {
  handle.addEventListener('pointerdown', ev => {
    if (ev.button !== 0 || ev.target.closest('button,input,textarea,select,.x')) return;
    const r = target.getBoundingClientRect(), ox = ev.clientX - r.left, oy = ev.clientY - r.top, sx = ev.clientX, sy = ev.clientY;
    let moved = false;
    const mv = e => {
      if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) < 5) return;
      if (!moved) { moved = true; target.style.pointerEvents = 'none'; target.style.right = 'auto'; target.style.bottom = 'auto'; }
      target.style.left = clamp(e.clientX - ox, 60 - r.width, innerWidth - 60) + 'px';
      target.style.top = clamp(e.clientY - oy - off, min, innerHeight - 40) + 'px';
      onmove && onmove(e);
    };
    const up = e => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      target.style.pointerEvents = ''; onend && onend(e, moved);
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
    ev.preventDefault();
  });
}
let lastTap = { id: null, t: 0 };
function tap(id, fn) { const n = Date.now(); if (lastTap.id === id && n - lastTap.t < 400) { lastTap = { id: null, t: 0 }; fn(); } else lastTap = { id, t: n }; }

const menu = $('#menu');
const hideMenu = () => { menu.hidden = true; };
function showMenu(x, y, entries) {
  menu.innerHTML = '';
  entries.forEach(e => { if (e === '-') { menu.append(el('hr')); return; } const d = el('div', '', esc(e[0])); d.onclick = () => { hideMenu(); e[1](); }; menu.append(d); });
  menu.hidden = false;
  menu.style.left = Math.min(x, innerWidth - menu.offsetWidth - 6) + 'px';
  menu.style.top = Math.min(y, innerHeight - menu.offsetHeight - 6) + 'px';
}
addEventListener('pointerdown', e => { if (!e.target.closest('#menu')) hideMenu(); });
addEventListener('blur', hideMenu);

function ask(title, fields, init = {}) {
  return new Promise(res => {
    const m = el('div', 'modal'), f = el('form', 'card', `<h3>${esc(title)}</h3>`);
    fields.forEach(([k, label, type = 'text']) => { const l = el('label', '', esc(label)), i = el('input'); i.type = type; i.name = k; i.value = init[k] || ''; l.append(i); f.append(l); });
    f.append(el('div', 'row2', '<button type="button" class="ghost">Cancelar</button><button class="pri">Aceptar</button>'));
    m.append(f); document.body.append(m);
    const first = f.querySelector('input'); first && first.focus();
    const close = v => { m.remove(); res(v); };
    $('.ghost', f).onclick = () => close(null);
    f.onsubmit = e => { e.preventDefault(); const o = {}; fields.forEach(([k]) => o[k] = f.elements[k].value.trim()); close(o); };
    m.addEventListener('pointerdown', e => { if (e.target === m) close(null); });
  });
}

/* ---------------------------- ventanas ---------------------------- */
const wins = new Map(); let zTop = 10;
function openWin(key, title, build, { w = 520, h = 420 } = {}) {
  if (wins.has(key)) { wins.get(key).el.style.zIndex = ++zTop; return wins.get(key); }
  w = Math.min(w, innerWidth - 16); h = Math.min(h, innerHeight - 90);
  const n = wins.size, e = el('div', 'win');
  e.style.cssText = `width:${w}px;height:${h}px;left:${Math.max(8, Math.min(innerWidth - w - 8, 150 + n * 28))}px;top:${60 + n * 28}px;z-index:${++zTop}`;
  const bar = el('div', 'bar', `<span class="dots"><i class="x" title="Cerrar"></i></span><b>${esc(title)}</b>`);
  const body = el('div', 'wbody'); e.append(bar, body); $('#windows').append(e);
  const o = { el: e, body, key, close() { e.remove(); wins.delete(key); o.onclose && o.onclose(); } };
  $('.x', bar).onclick = o.close;
  e.addEventListener('pointerdown', () => e.style.zIndex = ++zTop);
  drag(bar, e, { min: 26 });
  wins.set(key, o); build(body, o);
  return o;
}

/* ---------------------------- iconos de elementos ---------------------------- */
function tileEl(it) {
  const i = it.icon || { k: 'glyph', v: 'globe', bg: '#444' };
  const t = el('div', 'tile'); t.style.background = i.bg || '#333';
  if (i.k === 'img') { t.style.backgroundImage = `url("${i.v}")`; t.style.backgroundSize = i.fit === 'contain' ? '62%' : 'cover'; }
  else if (i.k === 'glyph') t.innerHTML = glyph(i.v); else { t.textContent = i.v; t.style.fontSize = '32px'; }
  return t;
}
function resizeImage(blob, size = 160) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(blob);
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const s = Math.max(size / img.width, size / img.height), w = img.width * s, h = img.height * s;
      c.getContext('2d').drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(url); res(c.toDataURL('image/png'));
    };
    img.onerror = rej; img.src = url;
  });
}
const svgData = txt => 'data:image/svg+xml;utf8,' + enc(txt);
function iconPicker(it) {
  const m = el('div', 'modal'), c = el('div', 'card wide');
  c.innerHTML = `<h3>Icono de “${esc(it.title)}”</h3>
    <div class="tabs"><button class="on" data-t="s">Buscar iconos</button><button data-t="u">Imagen / web</button><button data-t="g">Básicos y emoji</button></div>
    <div class="ipane"></div>
    <div class="colors">Fondo <input type="color" id="ibg" value="${/^#/.test((it.icon || {}).bg || '') ? it.icon.bg : '#3b82f6'}"> Icono <input type="color" id="ifg" value="#ffffff"></div>
    <div class="row2"><button class="ghost" data-c="1">Cerrar</button></div>`;
  m.append(c); document.body.append(m);
  const pane = $('.ipane', c), bg = () => $('#ibg', c).value, fg = () => $('#ifg', c).value;
  const done = icon => { it.icon = icon; save(); renderAll(); m.remove(); };
  const useImage = async (u, fit) => {
    try {
      const r = await fetch(u); if (!r.ok) throw 0; const b = await r.blob();
      if (b.type.includes('svg')) return done({ k: 'img', v: svgData(await b.text()), bg: bg(), fit: 'contain' });
      return done({ k: 'img', v: await resizeImage(b), bg: bg(), fit: fit || 'cover' });
    } catch { done({ k: 'img', v: u, bg: bg(), fit: fit || 'contain' }); }
  };
  const draw = tab => {
    $$('.tabs button', c).forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    if (tab === 's') {
      pane.innerHTML = `<div class="ibar"><input placeholder="Busca: music, game, heart…  (Iconify: +200 colecciones)"><button class="btn">Buscar</button></div><div class="igrid" style="margin-top:8px"></div>`;
      const inp = $('input', pane), grid = $('.igrid', pane);
      const go = async () => {
        const q = inp.value.trim(); if (!q) return; grid.textContent = 'Buscando…';
        try {
          const j = await (await fetch('https://api.iconify.design/search?limit=72&query=' + enc(q))).json();
          grid.innerHTML = (j.icons || []).map(n => { const [p, nm] = n.split(':'); return `<button data-n="${n}"><img loading="lazy" width="28" height="28" src="https://api.iconify.design/${p}/${nm}.svg?color=${enc(fg())}"></button>`; }).join('') || 'Sin resultados.';
        } catch { grid.textContent = 'No se pudo buscar (¿sin conexión?).'; }
      };
      $('button', pane).onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); };
      grid.onclick = async e => {
        const b = e.target.closest('button'); if (!b) return; const [p, nm] = b.dataset.n.split(':');
        try { const t = await (await fetch(`https://api.iconify.design/${p}/${nm}.svg?color=${enc(fg())}`)).text(); done({ k: 'img', v: svgData(t), bg: bg(), fit: 'contain' }); } catch { toast('No se pudo descargar el icono.'); }
      };
      inp.focus();
    } else if (tab === 'u') {
      pane.innerHTML = `<label>URL de una imagen o SVG (de cualquier web de iconos)<div class="ibar"><input id="iu" placeholder="https://…/icono.svg"><button class="btn" data-a="u">Usar</button></div></label>
        <label style="margin-top:8px">Web (usa su favicon)<div class="ibar"><input id="iw" placeholder="spotify.com"><button class="btn" data-a="w">Usar</button></div></label>
        <div style="margin-top:8px"><button class="btn" data-a="f">Subir imagen de tu equipo…</button></div>`;
      pane.onclick = e => {
        const a = e.target.dataset.a; if (!a) return;
        if (a === 'u') { const v = $('#iu', pane).value.trim(); if (v) useImage(v); }
        if (a === 'w') { const v = $('#iw', pane).value.trim().replace(/^https?:\/\//, '').split('/')[0]; if (v) useImage(`https://www.google.com/s2/favicons?domain=${enc(v)}&sz=128`, 'contain'); }
        if (a === 'f') { const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.onchange = async () => { if (!f.files[0]) return; const b = f.files[0]; if (b.type.includes('svg')) done({ k: 'img', v: svgData(await b.text()), bg: bg(), fit: 'contain' }); else done({ k: 'img', v: await resizeImage(b), bg: bg(), fit: 'cover' }); }; f.click(); }
      };
    } else {
      pane.innerHTML = `<div class="igrid">${Object.keys(GL).map(k => `<button data-g="${k}" style="background:${bg()}">${glyph(k, 26)}</button>`).join('')}</div>
        <div class="ibar" style="margin-top:8px"><input id="ie" placeholder="O escribe un emoji / letra"><button class="btn" data-a="e">Usar</button></div>`;
      pane.onclick = e => {
        const g = e.target.closest('[data-g]'); if (g) return done({ k: 'glyph', v: g.dataset.g, bg: bg() });
        if (e.target.dataset.a === 'e') { const v = $('#ie', pane).value.trim(); if (v) done({ k: 'emoji', v, bg: bg() }); }
      };
    }
  };
  c.onclick = e => { const t = e.target.dataset.t; if (t) { pane.onclick = null; draw(t); } if (e.target.dataset.c) m.remove(); };
  m.addEventListener('pointerdown', e => { if (e.target === m) m.remove(); });
  draw('s');
}

/* ---------------------------- elementos del escritorio ---------------------------- */
const inside = (id, anc) => { for (let p = byId(id); p; p = byId(p.parent)) { if (p.parent === anc) return true; } return false; };
const freeSpot = () => { const n = S.items.filter(i => !i.parent).length; return { x: 200 + (n % 6) * 110, y: 70 + Math.floor(n / 6) * 125 }; };
async function newItem(type, parent = null, pos) {
  pos = pos || freeSpot(); let it;
  if (type === 'folder') {
    const r = await ask('Nueva carpeta', [['title', 'Nombre']], { title: 'Carpeta' }); if (!r) return;
    it = { type, title: r.title || 'Carpeta', icon: { k: 'glyph', v: 'folder', bg: '#3b82f6' } };
  } else if (type === 'link') {
    const r = await ask('Nuevo enlace', [['title', 'Nombre'], ['url', 'Dirección (https://…)']]); if (!r || !r.url) return;
    const url = /^https?:\/\//i.test(r.url) ? r.url : 'https://' + r.url; let host = '';
    try { host = new URL(url).hostname; } catch { return; }
    it = { type, url, title: r.title || host, icon: { k: 'img', v: `https://www.google.com/s2/favicons?domain=${host}&sz=128`, bg: '#222', fit: 'contain' } };
  } else {
    const r = await ask('Nueva nota', [['title', 'Título']], { title: 'Nota' }); if (!r) return;
    it = { type: 'note', title: r.title || 'Nota', text: '', icon: { k: 'glyph', v: 'pen', bg: '#f59e0b' } };
  }
  Object.assign(it, { id: uid(), parent, x: pos.x, y: pos.y }); S.items.push(it); save(); renderAll();
}
function removeItem(it) {
  S.items.filter(i => i.parent === it.id).forEach(removeItem);
  S.items = S.items.filter(i => i.id !== it.id);
  const w = wins.get('f' + it.id) || wins.get('n' + it.id); w && w.close();
}
function openItem(it) {
  if (it.type === 'folder') openFolder(it);
  else if (it.type === 'link') window.open(it.url, '_blank', 'noopener');
  else if (it.type === 'note') openNote(it);
  else if (it.type === 'player') openPlayer();
  else if (it.type === 'favs') openPlayer('fav');
  else if (it.type === 'wall') openWallpaper();
}
function itemMenu(ev, it) {
  ev.preventDefault(); ev.stopPropagation();
  const folders = S.items.filter(f => f.type === 'folder' && f.id !== it.id && !inside(f.id, it.id) && f.id !== it.parent);
  const e = [['Abrir', () => openItem(it)],
    ['Renombrar…', async () => { const r = await ask('Renombrar', [['title', 'Nombre']], { title: it.title }); if (r && r.title) { it.title = r.title; save(); renderAll(); } }],
    ['Cambiar icono…', () => iconPicker(it)]];
  if (it.type === 'link') e.push(['Editar dirección…', async () => { const r = await ask('Enlace', [['url', 'Dirección']], { url: it.url }); if (r && r.url) { it.url = /^https?:\/\//i.test(r.url) ? r.url : 'https://' + r.url; save(); } }]);
  e.push('-');
  if (it.parent) e.push(['Sacar al escritorio', () => { Object.assign(it, { parent: null }, freeSpot()); save(); renderAll(); }]);
  folders.forEach(f => e.push(['Mover a: ' + f.title, () => { it.parent = f.id; save(); renderAll(); }]));
  e.push('-', ['Eliminar', () => { if (confirm('¿Eliminar "' + it.title + '"?')) { removeItem(it); save(); renderAll(); } }]);
  showMenu(ev.clientX, ev.clientY, e);
}
const createEntries = (parent, pos) => [['Nueva carpeta…', () => newItem('folder', parent, pos)], ['Nuevo enlace…', () => newItem('link', parent, pos)], ['Nueva nota…', () => newItem('note', parent, pos)]];

const hitFolder = ev => { const x = document.elementFromPoint(ev.clientX, ev.clientY); return x && (x.closest('.item[data-type="folder"]') || x.closest('.win[data-folder]')); };
function renderDesktop() {
  const d = $('#desktop'); d.innerHTML = '';
  S.items.filter(i => !i.parent).forEach(it => {
    const e = el('div', 'item'); e.dataset.id = it.id; e.dataset.type = it.type;
    e.style.left = it.x + 'px'; e.style.top = it.y + 'px';
    e.append(tileEl(it), el('span', 'lbl', esc(it.title)));
    e.oncontextmenu = ev => itemMenu(ev, it);
    drag(e, e, {
      off: 26,
      onmove: ev => { $$('.drop').forEach(x => x.classList.remove('drop')); const h = hitFolder(ev); if (h) h.classList.add('drop'); },
      onend: (ev, moved) => {
        $$('.drop').forEach(x => x.classList.remove('drop'));
        if (!moved) { tap(it.id, () => openItem(it)); return; }
        const h = hitFolder(ev), fid = h && (h.dataset.id || h.dataset.folder);
        if (fid && fid !== it.id && !inside(fid, it.id)) { it.parent = fid; save(); renderAll(); return; }
        it.x = parseInt(e.style.left); it.y = parseInt(e.style.top); save();
      },
    });
    d.append(e);
  });
}
const desk = $('#desktop');
desk.addEventListener('contextmenu', ev => {
  if (ev.target.closest('.item')) return; ev.preventDefault();
  const pos = { x: ev.clientX - 40, y: ev.clientY - 60 };
  showMenu(ev.clientX, ev.clientY, [...createEntries(null, pos), '-', ['Añadir música…', () => $('#filepick').click()], ['Cambiar fondo…', openWallpaper]]);
});
desk.addEventListener('dragover', e => e.preventDefault());
desk.addEventListener('drop', async e => {
  e.preventDefault();
  if (e.dataTransfer.files.length) { const n = await addFiles(e.dataTransfer.files); if (n) openPlayer(); return; }
  const txt = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || '').trim().split('\n')[0];
  if (/^https?:\/\//i.test(txt)) {
    let host = ''; try { host = new URL(txt).hostname; } catch { return; }
    S.items.push({ id: uid(), type: 'link', url: txt, title: host, parent: null, x: e.clientX - 40, y: e.clientY - 60, icon: { k: 'img', v: `https://www.google.com/s2/favicons?domain=${host}&sz=128`, bg: '#222', fit: 'contain' } });
    save(); renderAll();
  }
});
$('#filepick').onchange = async e => { const n = await addFiles(e.target.files); e.target.value = ''; if (n) openPlayer(); };
$('#dirpick').onchange = async e => { const n = await addFiles(e.target.files); e.target.value = ''; if (n) openPlayer(); };

function openFolder(f) {
  openWin('f' + f.id, f.title, (b, o) => {
    b.classList.add('folder'); o.el.dataset.folder = f.id;
    const tools = el('div', 'tools', '<button data-t="folder">Carpeta</button><button data-t="link">Enlace</button><button data-t="note">Nota</button>');
    const grid = el('div', 'grid'); b.append(tools, grid);
    tools.onclick = e => { const t = e.target.dataset.t; if (t) newItem(t, f.id); };
    grid.oncontextmenu = ev => { if (ev.target.closest('.item')) return; ev.preventDefault(); showMenu(ev.clientX, ev.clientY, createEntries(f.id)); };
    o.render = () => {
      grid.innerHTML = '';
      const kids = S.items.filter(i => i.parent === f.id);
      if (!kids.length) grid.append(el('div', 'empty', 'Carpeta vacía. Arrastra elementos aquí o créalos con los botones.'));
      kids.forEach(it => {
        const e = el('div', 'item small'); e.dataset.id = it.id; e.dataset.type = it.type;
        e.append(tileEl(it), el('span', 'lbl', esc(it.title)));
        e.oncontextmenu = ev => itemMenu(ev, it); e.onclick = () => tap(it.id, () => openItem(it)); grid.append(e);
      });
    };
    o.render();
  }, { w: 480, h: 360 });
}
function openNote(it) {
  openWin('n' + it.id, it.title, b => {
    b.innerHTML = `<div class="note"><input placeholder="Título"><textarea placeholder="Escribe aquí…"></textarea></div>`;
    const i = $('input', b), t = $('textarea', b); i.value = it.title; t.value = it.text || '';
    i.oninput = () => { it.title = i.value || 'Nota'; save(); renderDesktop(); };
    t.oninput = () => { it.text = t.value; save(); };
  }, { w: 440, h: 400 });
}
function renderAll() { renderDesktop(); wins.forEach(w => w.render && w.render()); }

/* ---------------------------- ventana música ---------------------------- */
function openPlayer(tab0) {
  const o = openWin('player', 'Música', (b, o) => {
    b.classList.add('pw');
    b.innerHTML = `<div class="tabs"><button data-t="lib">Biblioteca</button><button data-t="fav">Favoritos</button><button data-t="web">Buscar</button><button data-t="cfg">Fuentes</button></div><div class="pane"></div>`;
    const pane = $('.pane', b);
    let tab = 'lib', listRef = [], results = [], status = '', filter = '', lastQ = '', rowsEl = null, src = { yt: true, au: true, ja: true };

    const rowHTML = (t, i, ctx) => `<div class="row" data-i="${i}" data-k="${esc(keyOf(t))}">
      <div class="th" style="background:${cover(t)}"></div>
      <div class="n"><b>${esc(t.name)}</b><span>${esc(t.artist || '—')}<i class="badge">${esc(t.from || badgeOf(t))}</i></span></div>
      <button class="fav${isFav(t) ? ' on' : ''}" data-h title="Favorito">${ic('heart', 17)}</button>
      ${ctx === 'web' && t.src === 'url' ? `<button data-dl title="Guardar para escuchar sin conexión">${ic('dl', 17)}</button>` : ''}
      ${ctx === 'lib' ? `<button data-rm title="Quitar de la biblioteca">${ic('x', 15)}</button>` : ''}</div>`;
    const paintRows = () => {
      if (!rowsEl) return;
      if (tab === 'lib') { const f = filter.toLowerCase(); listRef = lib.filter(t => !f || (t.name + ' ' + t.artist).toLowerCase().includes(f)); }
      else if (tab === 'fav') listRef = favTracks(); else listRef = results;
      rowsEl.innerHTML = status ? `<div class="hint">${esc(status)}</div>` : listRef.map((t, i) => rowHTML(t, i, tab)).join('') ||
        `<div class="hint">${tab === 'lib' ? 'Aún no hay música.<br>Pulsa “+ Archivos” / “+ Carpeta” o suelta audios sobre el escritorio.' : tab === 'fav' ? 'Aún no tienes favoritos.<br>Pulsa el corazón en cualquier canción.' : 'Escribe una canción o pega un enlace de YouTube / Spotify / mp3.'}</div>`;
      markCur();
    };
    const markCur = () => { const k = P.cur ? keyOf(P.cur) : null; $$('.row', pane).forEach(r => r.classList.toggle('cur', r.dataset.k === k)); };
    const draw = () => {
      $$('.tabs button', b).forEach(x => x.classList.toggle('on', x.dataset.t === tab));
      if (tab === 'cfg') {
        rowsEl = null;
        pane.innerHTML = `<div class="cfg">
          <label>Clave de la API de YouTube (opcional, para buscar en YouTube con fiabilidad)<input id="kyt" value="${esc(S.keys.yt)}" placeholder="AIza…"><small>Gratis en Google Cloud → YouTube Data API v3. Sin clave se intenta una búsqueda alternativa que puede fallar.</small></label>
          <label>Jamendo client_id (opcional, música libre con descarga)<input id="kja" value="${esc(S.keys.jamendo)}" placeholder="client_id"><small>Gratis en developer.jamendo.com.</small></label>
          <div><button class="btn" data-x="savek">Guardar</button></div>
          <small>Las canciones de YouTube y Spotify se reproducen con sus reproductores oficiales y no se pueden descargar. Descargar (↓) solo funciona con fuentes que lo permiten (Audius, Jamendo, enlaces mp3) y con tus propios archivos.</small></div>`;
        return;
      }
      if (tab === 'lib') pane.innerHTML = `<div class="bar2"><button class="btn" data-x="files">+ Archivos</button><button class="btn" data-x="dir">+ Carpeta</button><input class="flt" placeholder="Filtrar…" value="${esc(filter)}"></div><div class="rows"></div>`;
      else if (tab === 'fav') pane.innerHTML = `<div class="rows"></div>`;
      else pane.innerHTML = `<div class="bar2"><input class="qs" placeholder="Canción, artista o enlace de YouTube / Spotify / mp3…" value="${esc(lastQ)}"><button class="btn" data-x="go">Buscar</button>
        <label class="chip"><input type="checkbox" data-s="yt" ${src.yt ? 'checked' : ''}>YouTube</label><label class="chip"><input type="checkbox" data-s="au" ${src.au ? 'checked' : ''}>Audius</label><label class="chip"><input type="checkbox" data-s="ja" ${src.ja ? 'checked' : ''}>Jamendo</label></div><div class="rows"></div>`;
      rowsEl = $('.rows', pane); paintRows();
      const fl = $('.flt', pane); if (fl) fl.oninput = e => { filter = e.target.value; paintRows(); };
      const qs = $('.qs', pane); if (qs) { qs.onkeydown = e => { if (e.key === 'Enter') go(); }; qs.oninput = () => lastQ = qs.value; }
    };
    const go = async () => {
      const q = (lastQ = $('.qs', pane).value.trim()); if (!q) return;
      status = 'Buscando…'; paintRows();
      const link = parseLink(q);
      if (link) { results = [await resolveLink(link)]; status = ''; paintRows(); return; }
      const jobs = []; if (src.yt) jobs.push(ytSearch(q)); if (src.au) jobs.push(audiusSearch(q)); if (src.ja && S.keys.jamendo) jobs.push(jamendoSearch(q));
      const res = await Promise.allSettled(jobs), lists = res.filter(r => r.status === 'fulfilled').map(r => r.value);
      results = []; for (let i = 0; lists.some(l => i < l.length); i++) lists.forEach(l => l[i] && results.push(l[i]));
      status = results.length ? '' : res.some(r => r.status === 'rejected') ? 'No se pudo buscar en alguna fuente. Prueba a pegar un enlace o revisa la pestaña Fuentes.' : 'Sin resultados.';
      paintRows();
    };
    pane.onchange = e => { if (e.target.dataset.s) src[e.target.dataset.s] = e.target.checked; };
    pane.onclick = async e => {
      const bt = e.target.closest('button'), r = e.target.closest('.row'), x = bt && bt.dataset.x;
      if (x === 'files') return $('#filepick').click(); if (x === 'dir') return $('#dirpick').click(); if (x === 'go') return go();
      if (x === 'savek') { S.keys.yt = $('#kyt', pane).value.trim(); S.keys.jamendo = $('#kja', pane).value.trim(); save(); toast('Guardado.'); return; }
      if (!r) return; const t = listRef[+r.dataset.i]; if (!t) return;
      if (bt && bt.dataset.h != null) return toggleFav(t);
      if (bt && bt.dataset.dl != null) { bt.style.opacity = .4; try { await saveRemote(t); toast('Guardada en tu biblioteca.'); } catch { toast('Esta fuente no permite descargar esta pista.'); } bt.style.opacity = ''; return; }
      if (bt && bt.dataset.rm != null) { await delTrack(t.id); S.favs = S.favs.filter(f => keyOf(f) !== keyOf(t)); save(); if (P.cur && keyOf(P.cur) === keyOf(t)) { stopAll(); P.cur = null; } await refreshLib(); emit(true); return; }
      play(listRef, +r.dataset.i);
    };
    b.querySelector('.tabs').onclick = e => { if (e.target.dataset.t) { tab = e.target.dataset.t; draw(); } };
    const sync = full => { if (full && rowsEl) paintRows(); else markCur(); };
    subs.add(sync); o.onclose = () => subs.delete(sync); o.setTab = t => { tab = t; draw(); };
    draw();
  }, { w: 680, h: 500 });
  if (tab0) o.setTab(tab0);
}

/* ---------------------------- ventana fondo ---------------------------- */
const GRADS = ['linear-gradient(135deg,#0f2027,#2c5364)', 'linear-gradient(135deg,#232526,#414345)', 'linear-gradient(135deg,#42275a,#734b6d)', 'linear-gradient(135deg,#141e30,#243b55)', 'radial-gradient(circle at 30% 20%,#3a1c71,#0b0b12 70%)'];
let wallURL = null;
async function applyWall() {
  const w = S.wall, box = $('#wall'); box.innerHTML = ''; box.style.background = ''; box.style.setProperty('--dim', w.dim);
  if (wallURL) { URL.revokeObjectURL(wallURL); wallURL = null; }
  let src = null, vid = false;
  if (w.type === 'color') box.style.background = w.value;
  else if (w.type === 'grad') box.style.background = w.value;
  else if (w.type === 'url') { src = w.value; vid = /\.(mp4|webm)(\?|$)/i.test(src); }
  else if (w.type === 'file') { const b = await tx('blobs', 'readonly', s => s.get('wall')); if (b) { wallURL = URL.createObjectURL(b); src = wallURL; vid = b.type.startsWith('video/'); } }
  if (src) {
    const m = document.createElement(vid ? 'video' : 'img'); m.src = src; m.style.objectFit = w.fit; m.draggable = false;
    if (vid) { m.muted = m.loop = m.autoplay = true; m.playsInline = true; m.play().catch(() => { }); }
    box.prepend(m);
  }
}
function openWallpaper() {
  openWin('wall', 'Fondo', b => {
    const W = S.wall; b.innerHTML = '<div class="set"></div>'; const root = $('.set', b);
    const set = async patch => { Object.assign(S.wall, patch); save(); await applyWall(); };
    root.innerHTML = `
      <div class="cols"><button class="btn" data-a="file">Subir imagen o vídeo…</button><input type="text" id="wu" placeholder="o pega una URL de imagen / gif / mp4" value="${W.type === 'url' ? esc(W.value) : ''}"><button class="btn" data-a="url">Aplicar</button></div>
      <div class="cols">Color <input type="color" id="wc" value="${W.type === 'color' ? W.value : '#0c0c10'}"> ${GRADS.map((g, i) => `<button class="gr" data-g="${i}" style="background:${g}"></button>`).join('')}</div>
      <label>Ajuste<select id="wf"><option value="cover">Rellenar</option><option value="contain">Contener</option><option value="fill">Estirar</option></select></label>
      <label>Oscurecer<input type="range" id="wd" min="0" max=".85" step=".05" value="${W.dim}"></label>
      <div class="cols"><button class="btn" data-a="reset">Quitar fondo</button></div>`;
    $('#wf', root).value = W.fit;
    root.onclick = e => {
      const a = e.target.dataset.a, g = e.target.dataset.g;
      if (g != null) set({ type: 'grad', value: GRADS[+g] });
      if (a === 'file') $('#wallpick').click();
      if (a === 'url') { const v = $('#wu', root).value.trim(); if (v) set({ type: 'url', value: v }); }
      if (a === 'reset') set({ type: 'color', value: '#0c0c10' });
    };
    $('#wc', root).oninput = e => set({ type: 'color', value: e.target.value });
    $('#wf', root).onchange = e => set({ fit: e.target.value });
    $('#wd', root).oninput = e => { S.wall.dim = +e.target.value; $('#wall').style.setProperty('--dim', S.wall.dim); save(); };
  }, { w: 440, h: 330 });
}
$('#wallpick').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  await tx('blobs', 'readwrite', s => s.put(f, 'wall')); S.wall.type = 'file'; save(); applyWall();
};

/* ---------------------------- mini reproductor ---------------------------- */
function buildMini() {
  const m = $('#mini');
  m.innerHTML = `
    <div class="mhead"><span class="mgrip"></span>
      <button class="mbtn" data-m="cfg" title="Personalizar">${ic('cog', 18)}</button>
      <button class="mbtn" data-m="pip" title="Ventana flotante fuera de la pestaña">${ic('pip', 18)}</button>
      <button class="mbtn" data-m="mode" title="Comprimir">${ic('down', 18)}</button></div>
    <div class="mcfg" hidden>
      <label>Mostrar portada <input type="checkbox" data-c="cover"></label>
      <label>Estilo <select data-c="style"><option value="glass">Cristal</option><option value="solid">Sólido</option><option value="neon">Neón</option></select></label>
      <label>Color <input type="color" data-c="accent"></label>
      <label>Opacidad <input type="range" min=".5" max="1" step=".02" data-c="op"></label>
      <label>Tamaño <input type="range" min=".8" max="1.4" step=".05" data-c="scale"></label></div>
    <div class="mbody">
      <div class="mcov"></div>
      <div class="minfo"><b class="mt">Nada sonando</b><span class="ma"></span></div>
      <input class="mseek" type="range" min="0" max="1000" value="0">
      <div class="mtm"><span class="mc">0:00</span><span class="md">0:00</span></div>
      <div class="mctl">
        <button class="mbtn" data-m="shuf" title="Aleatorio">${ic('shuf')}</button>
        <button class="mbtn" data-m="prev">${ic('prev', 22)}</button>
        <button class="mbtn mplay" data-m="play">${ic('play', 24)}</button>
        <button class="mbtn" data-m="next">${ic('next', 22)}</button>
        <button class="mbtn fav" data-m="fav" title="Favorito">${ic('heart')}</button></div></div>
    <div class="mdot"><div class="mdcov"></div><button class="mbtn mplay" data-m="play" style="width:38px;height:38px">${ic('play', 20)}</button><button class="mbtn" data-m="mode" title="Expandir">${ic('up', 18)}</button></div>`;
  m.onclick = e => {
    const b = e.target.closest('[data-m]'); if (!b) return; const a = b.dataset.m;
    if (a === 'play') toggle(); else if (a === 'next') next(); else if (a === 'prev') prev();
    else if (a === 'shuf') { P.shuf = !P.shuf; syncMini(); }
    else if (a === 'fav') toggleFav(P.cur);
    else if (a === 'cfg') { const c = $('.mcfg', m); c.hidden = !c.hidden; }
    else if (a === 'pip') popOut();
    else if (a === 'mode') { S.mini.mode = { full: 'compact', compact: 'dot', dot: 'full' }[S.mini.mode]; save(); applyMini(); }
  };
  m.oninput = e => {
    if (e.target.classList.contains('mseek')) return seekTo(e.target.value / 1000);
    const k = e.target.dataset.c; if (!k) return;
    S.mini[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? +e.target.value : e.target.value; save(); applyMini();
  };
  drag($('.mhead', m), m, { onend: (e, moved) => { if (moved) { S.mini.x = parseInt(m.style.left); S.mini.y = parseInt(m.style.top); save(); } } });
  drag($('.mdcov', m), m, { onend: (e, moved) => { if (moved) { S.mini.x = parseInt(m.style.left); S.mini.y = parseInt(m.style.top); save(); } } });
  subs.add(syncMini); tsubs.add(tickMini);
  applyMini(); syncMini();
}
function applyMini() {
  const m = $('#mini'), c = S.mini;
  m.hidden = !c.visible;
  m.className = `st-${c.style} m-${c.mode}` + (c.cover ? '' : ' no-cover') + (m.classList.contains('in-pip') ? ' in-pip' : '');
  m.style.setProperty('--ac', c.accent); m.style.setProperty('--op', c.op);
  m.style.zoom = m.classList.contains('in-pip') ? '' : c.scale;
  if (c.x != null && !m.classList.contains('in-pip')) { m.style.left = clamp(c.x, 0, innerWidth - 80) + 'px'; m.style.top = clamp(c.y, 0, innerHeight - 60) + 'px'; m.style.right = 'auto'; m.style.bottom = 'auto'; }
  $$('[data-c]', m).forEach(i => { const v = c[i.dataset.c]; if (i.type === 'checkbox') i.checked = v; else i.value = v; });
}
function syncMini() {
  const m = $('#mini'), t = P.cur;
  $('.mt', m).textContent = t ? t.name : 'Nada sonando'; $('.ma', m).textContent = t ? (t.artist || '') : 'Elige una canción';
  $('.mcov', m).style.background = t ? cover(t) : cover(null); $('.mdcov', m).style.background = t ? cover(t) : cover(null);
  $$('[data-m=play]', m).forEach(b => b.innerHTML = ic(isPaused() ? 'play' : 'pause', 24));
  $('[data-m=shuf]', m).classList.toggle('on', P.shuf);
  $('[data-m=fav]', m).classList.toggle('on', isFav(t));
  tickMini();
}
function tickMini() {
  const m = $('#mini'), d = durTime(), c = curTime(), s = $('.mseek', m);
  $('.mc', m).textContent = fmt(c); $('.md', m).textContent = fmt(d);
  if (!s.matches(':active') && d) s.value = c / d * 1000;
}
async function popOut() {
  const m = $('#mini');
  if (P.pip) { P.pip.close(); return; }
  if (!('documentPictureInPicture' in window)) { toast('Tu navegador no admite la ventana flotante (usa Chrome o Edge). Aun así puedes controlar la música desde las teclas multimedia y el panel de medios del sistema.'); return; }
  try {
    const w = await documentPictureInPicture.requestWindow({ width: 340, height: S.mini.mode === 'full' ? 400 : 150 });
    P.pip = w;
    const l = w.document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('style.css', location.href).href; w.document.head.append(l);
    w.document.body.style.cssText = 'margin:0;background:#0c0c10;overflow:hidden';
    m.classList.add('in-pip'); m.style.zoom = ''; w.document.body.append(m);
    w.addEventListener('pagehide', () => { m.classList.remove('in-pip'); document.body.append(m); P.pip = null; applyMini(); });
    applyMini();
  } catch (e) { toast('No se pudo abrir la ventana flotante.'); }
}

/* ---------------------------- barra de menú, dock y arranque ---------------------------- */
function buildMenubar() {
  const m = $('#menubar');
  m.innerHTML = '<b>loopdesk</b><button data-m="new">Nuevo ▾</button><button data-m="music">Música</button><button data-m="fav">Favoritos</button><button data-m="bg">Fondo</button><span class="sp"></span><span class="clock"></span>';
  m.onclick = e => {
    const k = e.target.dataset.m; if (!k) return;
    if (k === 'new') { const r = e.target.getBoundingClientRect(); showMenu(r.left, r.bottom + 4, [...createEntries(null), '-', ['Añadir música…', () => $('#filepick').click()]]); }
    if (k === 'music') openPlayer(); if (k === 'fav') openPlayer('fav'); if (k === 'bg') openWallpaper();
  };
  const tickC = () => $('.clock', m).textContent = new Date().toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  tickC(); setInterval(tickC, 20000);
}
function buildDock() {
  const d = $('#dock');
  const mk = (k, g, bg, title) => `<button data-d="${k}" title="${title}"><div class="tile" style="background:${bg}">${glyph(g, 22)}</div></button>`;
  d.innerHTML = mk('music', 'music', '#1db954', 'Música') + mk('fav', 'heart', '#e11d48', 'Favoritos') + mk('mini', 'play', '#3b82f6', 'Mostrar / ocultar mini reproductor') + mk('add', 'star', '#f59e0b', 'Nuevo') + mk('bg', 'image', '#6d5cff', 'Fondo');
  d.onclick = e => {
    const k = e.target.closest('[data-d]'); if (!k) return;
    const a = k.dataset.d;
    if (a === 'music') openPlayer(); if (a === 'fav') openPlayer('fav'); if (a === 'bg') openWallpaper();
    if (a === 'mini') { S.mini.visible = !S.mini.visible; save(); applyMini(); }
    if (a === 'add') { const r = k.getBoundingClientRect(); showMenu(r.left, r.top - 120, createEntries(null)); }
  };
}
addEventListener('keydown', e => { if (e.code === 'Space' && !e.target.closest('input,textarea,select')) { e.preventDefault(); toggle(); } });
addEventListener('resize', () => applyMini());

buildMenubar(); buildDock(); buildMini(); renderAll(); applyWall(); refreshLib();
