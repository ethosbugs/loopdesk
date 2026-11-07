'use strict';
/* =====================================================================
   Loopdesk — escritorio + reproductor + fondo vectorial reactivo al tono
   Todo en el navegador. Datos: localStorage (escritorio) + IndexedDB (audio)
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------------------------- estado ---------------------------- */
const PALETTES = {
  Neón:   ['#ff3d6e', '#7a5cff', '#22d3ee'],
  Fuego:  ['#ff2d2d', '#ff8a00', '#ffe14d'],
  Océano: ['#0ea5e9', '#22d3ee', '#a7f3d0'],
  Bosque: ['#16a34a', '#a3e635', '#fde68a'],
  Mono:   ['#ffffff', '#9ca3af', '#4b5563'],
};
const DEF = {
  bg: { lines: 34, speed: .6, amp: 1, thick: 1.3, loops: 2.2, sens: 1.2, glow: 6, spread: 70, reactive: true,
        colors: [...PALETTES.Neón], base: '#08080b' },
  items: [
    { id: 'player', type: 'player', title: 'Música', icon: { k: 'emoji', v: '🎧', bg: '#1db954' }, x: 70, y: 70, parent: null },
    { id: 'fondo', type: 'settings', title: 'Fondo', icon: { k: 'emoji', v: '🌀', bg: '#6d5cff' }, x: 70, y: 200, parent: null },
    { id: 'n1', type: 'note', title: 'Bienvenida', icon: { k: 'emoji', v: '📝', bg: '#f5d547' }, x: 70, y: 330, parent: null,
      text: 'Doble clic para abrir.\nClic derecho para crear, renombrar, cambiar icono o borrar.\nArrastra un elemento sobre una carpeta para guardarlo dentro.\nSuelta aquí archivos de audio o enlaces.' },
  ],
};
let S; try { S = JSON.parse(localStorage.getItem('ld')); } catch { }
S = S || structuredClone(DEF);
S.bg = { ...DEF.bg, ...S.bg };
const save = () => localStorage.setItem('ld', JSON.stringify(S));
const byId = id => S.items.find(i => i.id === id);

/* ---------------------------- IndexedDB (audio) ---------------------------- */
const dbp = new Promise((res, rej) => {
  const r = indexedDB.open('loopdesk', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('tracks', { keyPath: 'id' });
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const tx = async (mode, fn) => {
  const d = await dbp;
  return new Promise((res, rej) => {
    const t = d.transaction('tracks', mode); const r = fn(t.objectStore('tracks'));
    t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error);
  });
};
let lib = [];
const refreshLib = async () => { lib = ((await tx('readonly', s => s.getAll())) || []).sort((a, b) => a.added - b.added); emit(); };
const putTrack = t => tx('readwrite', s => s.put(t));
const delTrack = id => tx('readwrite', s => s.delete(id));

async function addFiles(files) {
  const list = [...files].filter(f => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|ogg|opus|wav|flac|weba)$/i.test(f.name));
  for (const f of list) {
    const base = f.name.replace(/\.[^.]+$/, '');
    const m = base.split(/\s+-\s+/);
    await putTrack({ id: uid(), name: m.length > 1 ? m.slice(1).join(' - ') : base, artist: m.length > 1 ? m[0] : '', blob: f, added: Date.now() });
  }
  await refreshLib();
  return list.length;
}

/* ---------------------------- audio ---------------------------- */
const audio = new Audio(); audio.preload = 'metadata';
let actx, analyser, freq;
function initAudio() {
  if (actx) return;
  actx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = actx.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = .8;
  const src = actx.createMediaElementSource(audio);
  src.connect(analyser); analyser.connect(actx.destination);
  freq = new Uint8Array(analyser.frequencyBinCount);
}
const P = { queue: [], i: -1, cur: null, url: null, shuf: false, rep: false };
const listeners = new Set();
const emit = () => listeners.forEach(f => f());
['play', 'pause', 'timeupdate', 'loadedmetadata'].forEach(e => audio.addEventListener(e, emit));
audio.addEventListener('ended', () => next(true));

async function play(list, i) {
  const t = list[i]; if (!t) return;
  initAudio(); actx.resume();
  P.queue = list; P.i = i; P.cur = t;
  if (P.url) { URL.revokeObjectURL(P.url); P.url = null; }
  if (t.blob) { P.url = URL.createObjectURL(t.blob); audio.removeAttribute('crossorigin'); audio.src = P.url; }
  else { audio.crossOrigin = 'anonymous'; audio.src = t.url; }
  try { await audio.play(); } catch (e) { console.warn(e); }
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.name || t.title, artist: t.artist || '' });
    navigator.mediaSession.setActionHandler('previoustrack', prev);
    navigator.mediaSession.setActionHandler('nexttrack', () => next());
  }
  emit();
}
function toggle() {
  if (!P.cur) { if (lib.length) play(lib, 0); return; }
  initAudio(); actx.resume(); audio.paused ? audio.play() : audio.pause();
}
function next(auto) {
  if (!P.queue.length) return;
  let i;
  if (P.shuf) i = Math.floor(Math.random() * P.queue.length);
  else { i = P.i + 1; if (i >= P.queue.length) { if (P.rep || !auto) i = 0; else { audio.pause(); return; } } }
  play(P.queue, i);
}
function prev() {
  if (!P.queue.length) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  play(P.queue, (P.i - 1 + P.queue.length) % P.queue.length);
}
const fmt = s => isFinite(s) ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '0:00';

/* búsqueda online (Audius: catálogo abierto con permiso de streaming) */
async function searchOnline(q) {
  const r = await fetch('https://api.audius.co/v1/tracks/search?query=' + encodeURIComponent(q) + '&limit=25&app_name=loopdesk');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  return (j.data || []).map(d => ({
    id: d.id, name: d.title, artist: d.user && d.user.name,
    url: `https://api.audius.co/v1/tracks/${d.id}/stream?app_name=loopdesk`,
  }));
}
async function saveRemote(t) {
  const r = await fetch(t.url); if (!r.ok) throw new Error('HTTP ' + r.status);
  await putTrack({ id: uid(), name: t.name, artist: t.artist || '', blob: await r.blob(), added: Date.now() });
  await refreshLib();
}

/* ---------------------------- utilidades UI ---------------------------- */
function drag(handle, target, { onmove, onend } = {}) {
  handle.addEventListener('pointerdown', ev => {
    if (ev.button !== 0 || ev.target.closest('button,input,textarea,.x')) return;
    const r = target.getBoundingClientRect(), ox = ev.clientX - r.left, oy = ev.clientY - r.top, sx = ev.clientX, sy = ev.clientY;
    let moved = false;
    const mv = e => {
      if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) < 5) return;
      if (!moved) { moved = true; target.style.pointerEvents = 'none'; }
      const top = target.classList.contains('item') ? 0 : 26;
      target.style.left = (e.clientX - ox) + 'px';
      target.style.top = Math.max(top, e.clientY - oy - (target.classList.contains('item') ? 26 : 0)) + 'px';
      onmove && onmove(e);
    };
    const up = e => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      target.style.pointerEvents = '';
      onend && onend(e, moved);
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
    ev.preventDefault();
  });
}
let lastTap = { id: null, t: 0 };
function tap(id, fn) {
  const n = Date.now();
  if (lastTap.id === id && n - lastTap.t < 400) { lastTap = { id: null, t: 0 }; fn(); } else lastTap = { id, t: n };
}

const menu = $('#menu');
function showMenu(x, y, entries) {
  menu.innerHTML = '';
  entries.forEach(e => {
    if (e === '-') { menu.append(el('hr')); return; }
    const d = el('div', '', esc(e[0])); d.onclick = () => { hideMenu(); e[1](); }; menu.append(d);
  });
  menu.hidden = false;
  const w = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = Math.min(x, innerWidth - w - 6) + 'px';
  menu.style.top = Math.min(y, innerHeight - h - 6) + 'px';
}
const hideMenu = () => { menu.hidden = true; };
addEventListener('pointerdown', e => { if (!e.target.closest('#menu')) hideMenu(); });
addEventListener('blur', hideMenu);

function ask(title, fields, init = {}) {
  return new Promise(res => {
    const m = el('div', 'modal'), f = el('form', 'card', `<h3>${esc(title)}</h3>`);
    fields.forEach(([k, label, type = 'text']) => {
      const l = el('label', '', esc(label)), i = el('input'); i.type = type; i.name = k; i.value = init[k] || ''; l.append(i); f.append(l);
    });
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
  drag(bar, e);
  wins.set(key, o); build(body, o);
  return o;
}

/* ---------------------------- iconos ---------------------------- */
function tileEl(it) {
  const i = it.icon || { k: 'emoji', v: '📄', bg: '#444' };
  const t = el('div', 'tile'); t.style.background = i.bg || '#333';
  if (i.k === 'img') { t.style.backgroundImage = `url("${i.v}")`; t.textContent = ''; }
  else t.textContent = i.v;
  return t;
}
function resizeImage(file, size = 160) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const s = Math.max(size / img.width, size / img.height), w = img.width * s, h = img.height * s;
      c.getContext('2d').drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(url); res(c.toDataURL('image/png'));
    };
    img.onerror = rej; img.src = url;
  });
}
function pickIconImage(it) {
  const inp = $('#iconpick'); inp.value = '';
  inp.onchange = async () => {
    if (!inp.files[0]) return;
    it.icon = { k: 'img', v: await resizeImage(inp.files[0]), bg: '#222' }; save(); renderAll();
  };
  inp.click();
}
async function editIcon(it) {
  const cur = it.icon || {};
  const r = await ask('Icono', [['v', 'Emoji o texto corto'], ['bg', 'Color de fondo', 'color']],
    { v: cur.k === 'emoji' ? cur.v : '', bg: /^#/.test(cur.bg || '') ? cur.bg : '#444444' });
  if (!r) return;
  it.icon = { k: 'emoji', v: r.v || '📄', bg: r.bg }; save(); renderAll();
}

/* ---------------------------- items ---------------------------- */
const inside = (id, anc) => { for (let p = byId(id); p; p = byId(p.parent)) { if (p.parent === anc) return true; } return false; };
const freeSpot = () => {
  const n = S.items.filter(i => !i.parent).length;
  return { x: 200 + (n % 6) * 110, y: 70 + Math.floor(n / 6) * 125 };
};
async function newItem(type, parent = null, pos) {
  pos = pos || freeSpot();
  let it;
  if (type === 'folder') {
    const r = await ask('Nueva carpeta', [['title', 'Nombre']], { title: 'Carpeta' }); if (!r) return;
    it = { type, title: r.title || 'Carpeta', icon: { k: 'emoji', v: '📁', bg: '#3b82f6' } };
  } else if (type === 'link') {
    const r = await ask('Nuevo enlace', [['title', 'Nombre'], ['url', 'Dirección (https://…)']]); if (!r || !r.url) return;
    let url = /^https?:\/\//i.test(r.url) ? r.url : 'https://' + r.url, host = '';
    try { host = new URL(url).hostname; } catch { return; }
    it = { type, url, title: r.title || host, icon: { k: 'img', v: `https://www.google.com/s2/favicons?domain=${host}&sz=128`, bg: '#222' } };
  } else {
    const r = await ask('Nueva nota', [['title', 'Título']], { title: 'Nota' }); if (!r) return;
    it = { type: 'note', title: r.title || 'Nota', text: '', icon: { k: 'emoji', v: '📝', bg: '#f5d547' } };
  }
  Object.assign(it, { id: uid(), parent, x: pos.x, y: pos.y });
  S.items.push(it); save(); renderAll();
}
function removeItem(it) {
  S.items.filter(i => i.parent === it.id).forEach(removeItem);
  S.items = S.items.filter(i => i.id !== it.id);
  const w = wins.get(it.id) || wins.get('f' + it.id) || wins.get('n' + it.id); w && w.close();
}
function openItem(it) {
  if (it.type === 'folder') openFolder(it);
  else if (it.type === 'link') window.open(it.url, '_blank', 'noopener');
  else if (it.type === 'note') openNote(it);
  else if (it.type === 'player') openPlayer();
  else if (it.type === 'settings') openSettings();
}
function itemMenu(ev, it) {
  ev.preventDefault(); ev.stopPropagation();
  const folders = S.items.filter(f => f.type === 'folder' && f.id !== it.id && !inside(f.id, it.id) && f.id !== it.parent);
  const e = [
    ['Abrir', () => openItem(it)],
    ['Renombrar…', async () => { const r = await ask('Renombrar', [['title', 'Nombre']], { title: it.title }); if (r && r.title) { it.title = r.title; save(); renderAll(); } }],
    ['Icono: emoji y color…', () => editIcon(it)],
    ['Icono: subir imagen…', () => pickIconImage(it)],
  ];
  if (it.type === 'link') e.push(['Editar dirección…', async () => {
    const r = await ask('Enlace', [['url', 'Dirección']], { url: it.url }); if (r && r.url) { it.url = /^https?:\/\//i.test(r.url) ? r.url : 'https://' + r.url; save(); }
  }]);
  e.push('-');
  if (it.parent) e.push(['Sacar al escritorio', () => { Object.assign(it, { parent: null }, freeSpot()); save(); renderAll(); }]);
  folders.forEach(f => e.push(['Mover a: ' + f.title, () => { it.parent = f.id; save(); renderAll(); }]));
  e.push('-', ['Eliminar', () => { if (confirm('¿Eliminar "' + it.title + '"?')) { removeItem(it); save(); renderAll(); } }]);
  showMenu(ev.clientX, ev.clientY, e);
}
const createEntries = (parent, pos) => [
  ['Nueva carpeta…', () => newItem('folder', parent, pos)],
  ['Nuevo enlace…', () => newItem('link', parent, pos)],
  ['Nueva nota…', () => newItem('note', parent, pos)],
];

/* ---------------------------- escritorio ---------------------------- */
const hitFolder = ev => {
  const x = document.elementFromPoint(ev.clientX, ev.clientY);
  return x && (x.closest('.item[data-type="folder"]') || x.closest('.win[data-folder]'));
};
function renderDesktop() {
  const d = $('#desktop'); d.innerHTML = '';
  S.items.filter(i => !i.parent).forEach(it => {
    const e = el('div', 'item'); e.dataset.id = it.id; e.dataset.type = it.type;
    e.style.left = it.x + 'px'; e.style.top = it.y + 'px';
    e.append(tileEl(it), el('span', 'lbl', esc(it.title)));
    e.oncontextmenu = ev => itemMenu(ev, it);
    drag(e, e, {
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
$('#desktop').addEventListener('contextmenu', ev => {
  if (ev.target.closest('.item')) return;
  ev.preventDefault();
  const pos = { x: ev.clientX - 40, y: ev.clientY - 60 };
  showMenu(ev.clientX, ev.clientY, [...createEntries(null, pos), '-', ['Añadir música…', () => $('#filepick').click()], ['Ajustes del fondo', openSettings]]);
});
const desk = $('#desktop');
desk.addEventListener('dragover', e => e.preventDefault());
desk.addEventListener('drop', async e => {
  e.preventDefault();
  if (e.dataTransfer.files.length) { const n = await addFiles(e.dataTransfer.files); if (n) openPlayer(); return; }
  const txt = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || '').trim().split('\n')[0];
  if (/^https?:\/\//i.test(txt)) {
    let host = ''; try { host = new URL(txt).hostname; } catch { return; }
    S.items.push({ id: uid(), type: 'link', url: txt, title: host, parent: null, x: e.clientX - 40, y: e.clientY - 60,
      icon: { k: 'img', v: `https://www.google.com/s2/favicons?domain=${host}&sz=128`, bg: '#222' } });
    save(); renderAll();
  }
});
$('#filepick').onchange = async e => { const n = await addFiles(e.target.files); e.target.value = ''; if (n) openPlayer(); };
$('#dirpick').onchange = async e => { const n = await addFiles(e.target.files); e.target.value = ''; if (n) openPlayer(); };

/* ---------------------------- ventanas: carpeta, nota ---------------------------- */
function openFolder(f) {
  openWin('f' + f.id, f.title, (b, o) => {
    b.classList.add('folder'); o.el.dataset.folder = f.id;
    const tools = el('div', 'tools', '<button data-t="folder">📁 Carpeta</button><button data-t="link">🔗 Enlace</button><button data-t="note">📝 Nota</button>');
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
        e.oncontextmenu = ev => itemMenu(ev, it);
        e.onclick = () => tap(it.id, () => openItem(it));
        grid.append(e);
      });
    };
    o.render();
  }, { w: 480, h: 360 });
}
function openNote(it) {
  openWin('n' + it.id, it.title, b => {
    b.innerHTML = `<div class="note"><input placeholder="Título"><textarea placeholder="Escribe aquí…"></textarea></div>`;
    const i = $('input', b), t = $('textarea', b); i.value = it.title; t.value = it.text || '';
    i.oninput = () => { it.title = i.value || 'Nota'; save(); renderDesktop(); $$('.win').forEach(() => { }); };
    t.oninput = () => { it.text = t.value; save(); };
  }, { w: 440, h: 400 });
}
function renderAll() { renderDesktop(); wins.forEach(w => w.render && w.render()); }

/* ---------------------------- ventana: reproductor ---------------------------- */
function openPlayer() {
  openWin('player', 'Música', (b, o) => {
    b.classList.add('pl');
    b.innerHTML = `
      <div class="np">
        <div class="art">♪</div>
        <div class="meta"><b class="t">Nada sonando</b><span class="a"></span></div>
        <input type="range" class="seek" min="0" max="1000" value="0">
        <div class="tm"><span class="c">0:00</span><span class="d">0:00</span></div>
        <div class="ctl">
          <button data-a="shuf" title="Aleatorio">🔀</button><button data-a="prev">⏮</button>
          <button data-a="play" class="big">▶</button><button data-a="next">⏭</button>
          <button data-a="rep" title="Repetir">🔁</button>
        </div>
        <input type="range" class="vol" min="0" max="1" step=".01" title="Volumen">
      </div>
      <div class="side">
        <div class="tabs"><button class="on" data-tab="lib">Biblioteca</button><button data-tab="web">Buscar online</button></div>
        <div class="pane"></div>
      </div>`;
    const q = s => $(s, b), pane = q('.pane');
    let tab = 'lib', results = [], filter = '', status = '';

    const seek = q('.seek'), vol = q('.vol'); vol.value = audio.volume;
    seek.oninput = () => { if (isFinite(audio.duration)) audio.currentTime = audio.duration * seek.value / 1000; };
    vol.oninput = () => { audio.volume = vol.value; };
    b.onclick = e => {
      const a = e.target.dataset.a, tb = e.target.dataset.tab;
      if (a === 'play') toggle(); else if (a === 'next') next(); else if (a === 'prev') prev();
      else if (a === 'shuf') { P.shuf = !P.shuf; sync(); } else if (a === 'rep') { P.rep = !P.rep; sync(); }
      if (tb) { tab = tb; $$('.tabs button', b).forEach(x => x.classList.toggle('on', x.dataset.tab === tb)); drawPane(); }
    };

    function rowHTML(t, i, cur, web) {
      return `<div class="row${cur ? ' cur' : ''}" data-i="${i}"><div class="n"><b>${esc(t.name)}</b><span>${esc(t.artist || '—')}</span></div>` +
        (web ? `<button data-dl="${i}" title="Guardar en mi biblioteca (offline)">⬇</button>` : `<button data-rm="${i}" title="Quitar">✕</button>`) + `</div>`;
    }
    function drawPane() {
      if (tab === 'lib') {
        pane.innerHTML = `<div class="bar2"><button class="btn" data-x="files">+ Archivos</button><button class="btn" data-x="dir">+ Carpeta</button>
          <input class="flt" placeholder="Filtrar…" value="${esc(filter)}"></div><div class="rows"></div>`;
        const rows = $('.rows', pane);
        const paint = () => {
          const f = filter.toLowerCase();
          const h = lib.map((t, i) => [t, i]).filter(([t]) => !f || (t.name + ' ' + t.artist).toLowerCase().includes(f))
            .map(([t, i]) => rowHTML(t, i, P.cur && P.cur.id === t.id)).join('');
          rows.innerHTML = h || `<div class="hint">Aún no hay música.<br>Pulsa “+ Archivos”, “+ Carpeta” o suelta audios sobre el escritorio.</div>`;
        };
        paint(); pane._paint = paint;
        $('.flt', pane).oninput = e => { filter = e.target.value; paint(); };
        pane.onclick = async e => {
          const x = e.target.dataset.x; if (x === 'files') $('#filepick').click(); if (x === 'dir') $('#dirpick').click();
          if (e.target.dataset.rm != null) { e.stopPropagation(); const t = lib[+e.target.dataset.rm]; await delTrack(t.id); if (P.cur && P.cur.id === t.id) { audio.pause(); } await refreshLib(); return; }
          const r = e.target.closest('.row'); if (r) play(lib, +r.dataset.i);
        };
      } else {
        pane.innerHTML = `<div class="bar2"><input class="qs" placeholder="Buscar canciones en Audius…"><button class="btn" data-x="go">Buscar</button></div>
          <div class="rows"></div>`;
        const rows = $('.rows', pane), qs = $('.qs', pane);
        const paint = () => {
          rows.innerHTML = status ? `<div class="hint">${esc(status)}</div>` :
            results.map((t, i) => rowHTML(t, i, P.cur && P.cur.url === t.url, true)).join('') ||
            `<div class="hint">Busca música con licencia de streaming abierta.<br>Con ⬇ la guardas en tu biblioteca para escucharla sin conexión.</div>`;
        };
        paint(); pane._paint = paint;
        const go = async () => {
          if (!qs.value.trim()) return; status = 'Buscando…'; paint();
          try { results = await searchOnline(qs.value.trim()); status = results.length ? '' : 'Sin resultados.'; }
          catch (err) { status = 'No se pudo buscar (¿sin conexión?).'; }
          paint();
        };
        qs.onkeydown = e => { if (e.key === 'Enter') go(); };
        pane.onclick = async e => {
          if (e.target.dataset.x === 'go') return go();
          if (e.target.dataset.dl != null) {
            e.stopPropagation(); const btn = e.target; btn.textContent = '…';
            try { await saveRemote(results[+btn.dataset.dl]); btn.textContent = '✓'; } catch { btn.textContent = '⚠'; btn.title = 'El servidor no permite descargar esta pista'; }
            return;
          }
          const r = e.target.closest('.row'); if (r) play(results, +r.dataset.i);
        };
      }
    }
    function sync() {
      const t = P.cur;
      q('.t').textContent = t ? (t.name || t.title) : 'Nada sonando';
      q('.a').textContent = t ? (t.artist || '') : '';
      q('[data-a=play]').textContent = audio.paused ? '▶' : '⏸';
      q('[data-a=shuf]').classList.toggle('on', P.shuf); q('[data-a=rep]').classList.toggle('on', P.rep);
      q('.c').textContent = fmt(audio.currentTime); q('.d').textContent = fmt(audio.duration);
      if (document.activeElement !== seek && isFinite(audio.duration)) seek.value = audio.currentTime / audio.duration * 1000;
      const key = (t && (t.id || '')) + '|' + lib.length;
      if (sync.key !== key) { sync.key = key; pane._paint && pane._paint(); }
    }
    listeners.add(sync); o.onclose = () => listeners.delete(sync);
    drawPane(); sync();
  }, { w: 640, h: 440 });
}

/* ---------------------------- ventana: ajustes de fondo ---------------------------- */
function openSettings() {
  openWin('settings', 'Fondo', b => {
    const B = S.bg;
    const sliders = [['lines', 'Líneas', 4, 80, 1], ['speed', 'Velocidad', 0, 2, .05], ['amp', 'Amplitud', .2, 2, .05], ['loops', 'Lazos', .5, 6, .1],
      ['thick', 'Grosor', .4, 5, .1], ['spread', 'Dispersión color', 0, 180, 1], ['sens', 'Sensibilidad audio', 0, 3, .05], ['glow', 'Brillo', 0, 20, 1]];
    b.innerHTML = '<div class="set"></div>'; const root = $('.set', b);
    const draw = () => {
      root.innerHTML = '';
      sliders.forEach(([k, l, mn, mx, st]) => {
        const lab = el('label', '', `${l}<input type="range" min="${mn}" max="${mx}" step="${st}"><span>${B[k]}</span>`);
        const i = $('input', lab), s = $('span', lab); i.value = B[k];
        i.oninput = () => { B[k] = +i.value; s.textContent = B[k]; save(); if (k === 'lines') buildPaths(); if (k === 'glow') applyGlow(); };
        root.append(lab);
      });
      const rc = el('label', '', `Color según el tono<input type="checkbox"><span></span>`);
      $('input', rc).checked = B.reactive; $('input', rc).onchange = e => { B.reactive = e.target.checked; save(); };
      root.append(rc);
      const cols = el('div', 'cols', 'Colores:');
      [...B.colors, B.base].forEach((c, idx) => {
        const i = el('input'); i.type = 'color'; i.value = c;
        i.oninput = () => { if (idx < 3) B.colors[idx] = i.value; else { B.base = i.value; applyBase(); } save(); };
        cols.append(i);
      });
      cols.append(el('span', '', '<small style="opacity:.55">(3 líneas + fondo)</small>'));
      root.append(cols);
      const pal = el('div', 'pal');
      Object.entries(PALETTES).forEach(([n, c]) => {
        const p = el('button', '', n); p.style.background = `linear-gradient(90deg,${c.join(',')})`; p.style.color = '#fff'; p.style.textShadow = '0 1px 3px #000'; p.style.width = 'auto'; p.style.padding = '0 10px';
        p.onclick = () => { B.colors = [...c]; B.reactive = false; save(); draw(); };
        pal.append(p);
      });
      root.append(pal);
      const acts = el('div', 'cols', '<button class="btn" data-a="rand">🎲 Aleatorio</button><button class="btn" data-a="svg">⬇ Exportar SVG</button><button class="btn" data-a="reset">Restablecer</button>');
      acts.onclick = e => {
        const a = e.target.dataset.a;
        if (a === 'rand') { const h = Math.random() * 360; B.colors = [0, 50, 110].map(d => `#${hsl2hex((h + d) % 360, .85, .6)}`); B.reactive = false; B.loops = +(1 + Math.random() * 4).toFixed(1); save(); draw(); }
        if (a === 'svg') exportSVG();
        if (a === 'reset') { S.bg = structuredClone(DEF.bg); Object.assign(B, S.bg); save(); buildPaths(); applyGlow(); applyBase(); draw(); }
      };
      root.append(acts);
    };
    draw();
  }, { w: 440, h: 560 });
}

/* ---------------------------- fondo vectorial ---------------------------- */
const svg = $('#bg'), NS = 'http://www.w3.org/2000/svg';
let paths = [];
const applyBase = () => { document.body.style.background = S.bg.base; document.documentElement.style.background = S.bg.base; };
const applyGlow = () => { svg.style.filter = S.bg.glow > 0 ? `drop-shadow(0 0 ${S.bg.glow}px rgba(255,255,255,.22))` : 'none'; };
function buildPaths() {
  svg.innerHTML = '';
  const g = document.createElementNS(NS, 'g'); g.setAttribute('fill', 'none'); g.setAttribute('stroke-linecap', 'round'); svg.append(g);
  paths = [];
  for (let i = 0; i < S.bg.lines; i++) { const p = document.createElementNS(NS, 'path'); g.append(p); paths.push(p); }
}
const resizeBg = () => svg.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`);
addEventListener('resize', resizeBg);

const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lerp = (a, b, t) => a + (b - a) * t;
function palColor(t) {
  const c = S.bg.colors.map(hex2rgb), s = t * 2, i = Math.min(1, Math.floor(s)), f = s - i;
  return `rgb(${[0, 1, 2].map(k => Math.round(lerp(c[i][k], c[i + 1][k], f))).join(',')})`;
}
function hsl2hex(h, s, l) {
  const a = s * Math.min(l, 1 - l), f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); };
  return f(0) + f(8) + f(4);
}

const lv = { bass: 0, mid: 0, tre: 0, e: 0, cen: .05, hue: 280 };
function analyse() {
  if (!analyser || audio.paused) { ['bass', 'mid', 'tre', 'e'].forEach(k => lv[k] *= .93); return; }
  analyser.getByteFrequencyData(freq);
  const n = freq.length, nb = Math.floor(n * .04), nm = Math.floor(n * .25);
  let b = 0, m = 0, t = 0, sum = 0, w = 0;
  for (let i = 0; i < n; i++) {
    const v = freq[i] / 255;
    if (i < nb) b += v; else if (i < nm) m += v; else t += v;
    sum += v; w += v * i;
  }
  b /= nb; m /= (nm - nb); t /= (n - nm);
  const k = .3;
  lv.bass += (b - lv.bass) * k; lv.mid += (m - lv.mid) * k; lv.tre += (t * 2.5 - lv.tre) * k;
  lv.e = (lv.bass + lv.mid) / 2;
  if (sum > 1) lv.cen += ((w / sum / n) - lv.cen) * .04;           // centroide espectral ≈ “brillo” / tono
  const target = clamp(Math.sqrt(lv.cen) * 2.4, 0, 1) * 300;
  lv.hue += (target - lv.hue) * .06;
}
let tm = 0, last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  analyse();
  const B = S.bg, W = innerWidth, H = innerHeight, N = paths.length, K = 64;
  tm += dt * B.speed * (1 + lv.e * B.sens * 1.5);
  const bass = lv.bass * B.sens, mid = lv.mid * B.sens, tre = lv.tre * B.sens;
  const xs = new Array(K + 1), ys = new Array(K + 1);
  for (let i = 0; i < N; i++) {
    const t = N > 1 ? i / (N - 1) : .5, ph = t * 2.4 + tm, mid_ = 1 - Math.abs(t - .5) * 2;
    for (let k = 0; k <= K; k++) {
      const u = k / K, env = Math.pow(Math.sin(Math.PI * u), .7);
      xs[k] = W * u + Math.cos(u * 6.283 * B.loops + ph * 1.3) * W * .07 * (1 + bass * 1.5) * env;
      ys[k] = H * .5 + (t - .5) * H * .32 * (1 + mid) +
        env * H * .2 * B.amp * (Math.sin(u * 6.283 * 1.1 + ph) * (.7 + bass) + Math.sin(u * 6.283 * 2.3 - ph * .8 + t * 3) * .35 * (1 + tre * 2));
    }
    let d = `M${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
    for (let k = 1; k < K; k++) d += `Q${xs[k].toFixed(1)} ${ys[k].toFixed(1)} ${((xs[k] + xs[k + 1]) / 2).toFixed(1)} ${((ys[k] + ys[k + 1]) / 2).toFixed(1)}`;
    d += `L${xs[K].toFixed(1)} ${ys[K].toFixed(1)}`;
    const p = paths[i];
    p.setAttribute('d', d);
    p.setAttribute('stroke', B.reactive ? `hsl(${(lv.hue + t * B.spread) % 360} 85% 62%)` : palColor(t));
    p.setAttribute('stroke-width', (B.thick * (.5 + mid_ * .9 + bass * 1.6)).toFixed(2));
    p.setAttribute('stroke-opacity', (.28 + .5 * mid_).toFixed(2));
  }
  requestAnimationFrame(frame);
}
function exportSVG() {
  const c = svg.cloneNode(true); c.style.filter = ''; c.setAttribute('width', innerWidth); c.setAttribute('height', innerHeight);
  const r = document.createElementNS(NS, 'rect'); r.setAttribute('width', '100%'); r.setAttribute('height', '100%'); r.setAttribute('fill', S.bg.base);
  c.insertBefore(r, c.firstChild);
  const a = document.createElement('a'); a.download = 'loopdesk-fondo.svg';
  a.href = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(c)], { type: 'image/svg+xml' })); a.click();
}

/* ---------------------------- barra de menú y dock ---------------------------- */
function buildMenubar() {
  const m = $('#menubar');
  m.innerHTML = '<b>loopdesk</b><button data-m="new">Nuevo ▾</button><button data-m="music">Música</button><button data-m="bg">Fondo</button><span class="sp"></span><span class="clock"></span>';
  m.onclick = e => {
    const k = e.target.dataset.m; if (!k) return;
    if (k === 'new') { const r = e.target.getBoundingClientRect(); showMenu(r.left, r.bottom + 4, [...createEntries(null), '-', ['Añadir música…', () => $('#filepick').click()]]); }
    if (k === 'music') openPlayer(); if (k === 'bg') openSettings();
  };
  const tick = () => $('.clock', m).textContent = new Date().toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  tick(); setInterval(tick, 20000);
}
function buildDock() {
  const d = $('#dock');
  d.innerHTML = '<div class="mini"><button data-d="open" title="Abrir reproductor">🎧</button><span class="t">Nada sonando</span></div>' +
    '<button data-d="prev">⏮</button><button data-d="play">▶</button><button data-d="next">⏭</button><span class="sep"></span>' +
    '<button data-d="add" title="Nuevo">＋</button><button data-d="bg" title="Fondo">🌀</button>';
  d.onclick = e => {
    const k = e.target.dataset.d; if (!k) return;
    if (k === 'open') openPlayer(); if (k === 'play') toggle(); if (k === 'next') next(); if (k === 'prev') prev(); if (k === 'bg') openSettings();
    if (k === 'add') { const r = e.target.getBoundingClientRect(); showMenu(r.left, r.top - 130, createEntries(null)); }
  };
  listeners.add(() => {
    $('.t', d).textContent = P.cur ? (P.cur.name || P.cur.title) : 'Nada sonando';
    $('[data-d=play]', d).textContent = audio.paused ? '▶' : '⏸';
  });
}
addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.target.closest('input,textarea')) { e.preventDefault(); toggle(); }
});

/* ---------------------------- arranque ---------------------------- */
applyBase(); applyGlow(); resizeBg(); buildPaths();
buildMenubar(); buildDock(); renderAll(); refreshLib();
requestAnimationFrame(frame);
