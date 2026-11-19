// OOP shape editor showcase: the painting app of labs 2-5, each version running from its own
// C++ sources, compiled to WebAssembly with a small Win32 shim (win32/ + host.js). This file
// lays out the tabs, starts the processes, and adds demos, file transfer for lab 5 and copy actions.
import { Process, decodeCp1251, encodeCp1251 } from './host.js';

const REPO = 'https://github.com/Andrew1407/OOP';
const SRC = `${REPO}/blob/main`;
const $ = (s, root = document) => root.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WM_COMMAND = 0x111, WM_LBUTTONDOWN = 0x201, WM_LBUTTONUP = 0x202, WM_MOUSEMOVE = 0x200;

// --------------------------------------------------------------- English --
const EN = {
  "&Об'єкти": '&Objects', "Об'єкти": 'Objects', 'Точка': 'Point', 'Лінія': 'Line', 'Прямокутник': 'Rectangle', 'Еліпс': 'Ellipse',
  'Пряма з кружечками': 'Line with circles', 'Лінія з кружечками': 'Line with circles', 'Куб': 'Cube',
  '&Файл': '&File', 'Вы&ход': 'E&xit', 'Вихід': 'Exit', '&Справка': '&Help', '&О программе...': '&About...',
  'Очистити': 'Clear', 'Зчитати файл': 'Read file', 'Список фігур': 'Shape list', 'Видалити': 'Delete',
  'Виділити/зняти виділення': 'Select / deselect', 'Закрити': 'Close', 'ОК': 'OK',
};
function tr(s) {
  if (EN[s]) return { en: EN[s], orig: s };
  let m;
  if ((m = s.match(/^О программе (.+)$/))) return { en: `About ${m[1]}`, orig: s };
  if ((m = s.match(/^(.+), Версия (.+)$/))) return { en: `${m[1]}, Version ${m[2]}`, orig: s };
  return { en: s, orig: '' };
}
const TOOLS = { IDM_POINT: 'Point', IDM_LINE: 'Line', IDM_RECT: 'Rectangle', IDM_ELLIPSE: 'Ellipse', IDM_OOLINE: 'Line with circles', IDM_CUBE: 'Cube' };
const SHAPE_EN = { 'Точка': 'Point', 'Лінія': 'Line', 'Прямокутник': 'Rectangle', 'Еліпс': 'Ellipse', 'Лінія з кружечками': 'Line with circles', 'Куб': 'Cube' };

// ------------------------------------------------------------------- labs --
const src = (p) => `${SRC}/${p}`;
const exeCfg = (dir, exe, mod, extra = {}) => ({
  exe, module: `./wasm/${mod}.mjs`, icon: `../${dir}/small.ico`, client: [800, 450], max: [800, 450], ...extra,
});
const NATIVE = (files) => `<b>Runs natively.</b> ${files} are compiled to WebAssembly with emscripten, including <code>wWinMain</code> and its message loop. The Win32 calls go to a small shim (<a href="${SRC}/web/win32/windows.h"><code>web/win32</code></a>): windows, messages and dialog loops are emulated in C++, and GDI drawing goes to this page's canvas with the same pens, brushes and <code>R2_NOTXORPEN</code> raster mode. Menus, dialogs and string tables are read from the lab's own <code>.rc</code> file.`;

const DRAW_DEMO = {
  lab2: [['IDM_POINT', [90, 90], [90, 90]], ['IDM_LINE', [160, 70], [330, 190]], ['IDM_RECT', [470, 130], [560, 190]], ['IDM_ELLIPSE', [620, 60], [760, 190]],
    ['IDM_POINT', [130, 300], [130, 300]], ['IDM_LINE', [210, 380], [420, 260]], ['IDM_RECT', [560, 320], [640, 390]]],
  lab3: [['IDM_POINT', [80, 80], [80, 80]], ['IDM_LINE', [140, 60], [320, 170]], ['IDM_RECT', [380, 60], [520, 170]], ['IDM_ELLIPSE', [660, 130], [750, 190]],
    ['IDM_RECT', [120, 250], [300, 380]], ['IDM_ELLIPSE', [470, 320], [580, 390]], ['IDM_LINE', [620, 260], [760, 400]]],
  lab4: [['IDM_POINT', [70, 70], [70, 70]], ['IDM_LINE', [120, 50], [280, 150]], ['IDM_RECT', [330, 50], [470, 150]], ['IDM_ELLIPSE', [620, 110], [720, 170]],
    ['IDM_OOLINE', [90, 250], [300, 360]], ['IDM_CUBE', [380, 230], [520, 340]], ['IDM_CUBE', [600, 260], [680, 330]]],
};
DRAW_DEMO.lab5 = DRAW_DEMO.lab4.slice(0, 6);

// The editor grows lab by lab: lab 5 is the complete app, labs 4, 3 and 2 are its earlier versions.
const LABS = [
  {
    id: 'lab5', tab: '5', name: 'Shape editor', dir: '5-lab', file: '5-lab/my_table.cpp', main: true,
    intro: 'The complete editor. Pick a tool on the toolbar or in <b>Objects</b> and drag on the canvas: point, line, rectangle, ellipse, a line with circles at its ends, or a cube. The editor is a singleton (<code>MyEditor::GetInstance</code>). Every shape you draw is appended to <code>shapes.txt</code> and to the modeless <b>Shape list</b> window (<b>Help → Shape list</b>), where you can select a shape to highlight it in red, or delete it. <b>File → Read file</b> loads the shapes in <code>shapesRead.txt</code> onto the canvas and into the list. The files live in the module\'s memory file system and use the same Windows-1251 text format as the lab, so you can download what it wrote or upload your own file to read.',
    native: NATIVE('<code>Lab5.cpp</code>, <code>my_editor.cpp</code>, <code>my_table.cpp</code>, <code>editor.cpp</code>, <code>shape.cpp</code> and <code>toolbar.cpp</code>'),
    procs: [{ ...exeCfg('5-lab', 'Lab5.exe', 'lab5'), rc: ['../5-lab/Lab5.rc', '../5-lab/my_table.rc'], defs: ['../5-lab/resource.h', '../5-lab/resource1.h'], bitmaps: { 129: '../5-lab/bitmap1.bmp' }, unicode: false }],
    demo: demoLab5,
    extra: lab5Extra,
  },
  {
    id: 'lab4', tab: '4', name: 'Line with circles and cube', dir: '4-lab', file: '4-lab/shape.h',
    intro: 'The version before the shape list and files. It adds two shapes through virtual and multiple inheritance: <code>LineOOShape : public EllipseShape, public LineShape</code> draws a line with a circle at each end, and <code>CubeShape</code> is a composite of twelve <code>LineShape</code> edges. Each editor class creates the matching shape to show itself.',
    native: NATIVE('<code>Lab4.cpp</code>, <code>shape.cpp</code>, <code>editor.cpp</code>, <code>shape_editor.cpp</code> and <code>toolbar.cpp</code>'),
    procs: [{ ...exeCfg('4-lab', 'Lab4.exe', 'lab4'), rc: ['../4-lab/Lab4.rc'], defs: ['../4-lab/Resource.h'], bitmaps: { 129: '../4-lab/bitmap1.bmp' }, unicode: true }],
    demo: (lab) => demoDraw(lab, DRAW_DEMO.lab4),
  },
  {
    id: 'lab3', tab: '3', name: 'Toolbar and menu', dir: '3-lab', file: '3-lab/editor.cpp',
    intro: 'The first version with a toolbar, built by <code>CreateToolbarEx</code> from the lab\'s <code>bitmap1.bmp</code>. The toolbar keeps the current tool pressed, hovering a button shows its tooltip, and the <b>Objects</b> menu shows a check mark, set by the lab in <code>WM_INITMENUPOPUP</code>. Rubber bands are blue and dotted, with sky-blue rectangles, khaki final rectangles and grey ellipses.',
    native: NATIVE('<code>Lab3.cpp</code>, <code>shape.cpp</code>, <code>editor.cpp</code>, <code>shape_editor.cpp</code> and <code>toolbar.cpp</code>'),
    procs: [{ ...exeCfg('3-lab', 'Lab3.exe', 'lab3'), rc: ['../3-lab/Lab3.rc'], defs: ['../3-lab/resource.h'], bitmaps: { 130: '../3-lab/bitmap1.bmp' }, unicode: true }],
    demo: (lab) => demoDraw(lab, DRAW_DEMO.lab3),
  },
  {
    id: 'lab2', tab: '2', name: 'First shapes', dir: '2-lab', file: '2-lab/shape.cpp',
    intro: 'The first version: an abstract <code>Shape</code> with a pure virtual <code>Show</code> and <code>Point</code>, <code>Line</code>, <code>Rect</code> and <code>Ellipse</code> subclasses, plus a parallel <code>Editor</code> hierarchy that rubber-bands each shape with a dotted red <code>R2_NOTXORPEN</code> pen. Pick a shape in <b>Objects</b> and drag on the canvas. Rectangles grow out from the point you press (mirrored around it), ellipses from a corner. The editor keeps up to 105 shapes.',
    native: NATIVE('<code>Lab2.cpp</code>, <code>shape.cpp</code>, <code>editor.cpp</code> and <code>shape_editor.cpp</code>'),
    procs: [{ ...exeCfg('2-lab', 'Lab2.exe', 'lab2'), rc: ['../2-lab/Lab2.rc'], defs: ['../2-lab/resource.h'], unicode: true }],
    demo: (lab) => demoDraw(lab, DRAW_DEMO.lab2),
  },
];

// ------------------------------------------------------------------ demos --
const frameOf = (p) => [...p.frames.entries()].find(([, e]) => e.kind === 'frame');
async function waitFor(fn, ms = 4000) { const t = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t > ms) throw new Error('The demo timed out'); await sleep(40); } }
const visibleDialog = (slot) => [...slot.querySelectorAll('.w32-dialog')].find((d) => !d.hidden);
const btnByOrig = (root, orig) => [...root.querySelectorAll('button')].find((b) => b.title === `Original: ${orig}` || b.textContent.trim() === orig);

async function drag(p, h, [x0, y0], [x1, y1], steps = 14) {
  p.input(h, WM_LBUTTONDOWN, x0, y0);
  for (let i = 1; i <= steps; i++) { await sleep(22); p.input(h, WM_MOUSEMOVE, Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps)); }
  await sleep(30);
  p.input(h, WM_LBUTTONUP, x1, y1);
  await sleep(90);
}
async function demoDraw(lab, shapes) {
  const p = lab.procs[0];
  const [h] = frameOf(p);
  for (const [cmd, a, b] of shapes) {
    p.post(h, WM_COMMAND, p.res.defs[cmd], 0);
    await sleep(60);
    await drag(p, h, a, b, cmd === 'IDM_POINT' ? 5 : 14);
  }
}
async function demoLab5(lab) {
  const p = lab.procs[0], slot = lab.slots[0];
  const [h] = frameOf(p);
  if (!slot.querySelector('.w32-dialog:not([hidden])')) { p.post(h, WM_COMMAND, p.res.defs.ID_SHAPES_LIST, 0); await sleep(150); }
  await demoDraw(lab, DRAW_DEMO.lab5);
  const list = await waitFor(() => slot.querySelector('.w32-dialog .w32-list'));
  await sleep(200);
  list.querySelector('[data-i="2"]')?.click();
  await sleep(250);
  btnByOrig(list.closest('.w32-dialog'), 'Виділити/зняти виділення').click();
}
// ---------------------------------------------------------- lab 5 extras --
let lab5Sample = null;
async function lab5Extra(lab, sec) {
  const box = $('.extra', sec);
  box.innerHTML = `<div class="two-col">
      <div class="panel inner" data-copyable data-title="shapes.txt">
        <div class="copy-head"><h2>shapes.txt <small>written by the lab</small></h2><span class="copy-actions"><button type="button" class="mini" data-dl>Download</button>${actionBtn('table')}</span></div>
        <div class="table-wrap"><table><thead><tr><th class="num">#</th><th>Shape</th><th class="num">x1</th><th class="num">y1</th><th class="num">x2</th><th class="num">y2</th></tr></thead><tbody class="rows"></tbody></table></div>
        <p class="hint empty">Draw a shape to write a line.</p>
      </div>
      <div class="panel inner" data-copyable data-title="shapesRead.txt">
        <div class="copy-head"><h2>shapesRead.txt <small>read by File → Read file</small></h2><span class="copy-actions"><label class="mini file">Upload<input type="file" accept=".txt,text/plain" hidden></label><button type="button" class="mini" data-reset>Lab sample</button>${actionBtn('text')}</span></div>
        <pre class="text read"></pre>
        <p class="hint">Text in the lab's format, Windows-1251: <code>Куб:  x1: 189; y1: 171; x2: 279; y2: 250;</code>. A UTF-8 file is converted.</p>
      </div></div>`;
  const p = lab.procs[0];
  const showRead = (bytes) => { $('.read', box).textContent = decodeCp1251(bytes) || '(empty)'; };
  const setRead = (bytes) => { p.files['/shapesRead.txt'] = bytes; try { p.mod?.FS.writeFile('/shapesRead.txt', bytes); } catch {} showRead(bytes); };
  showRead(p.files['/shapesRead.txt']);
  $('[data-reset]', box).onclick = () => setRead(lab5Sample);
  $('input[type=file]', box).onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const buf = new Uint8Array(await f.arrayBuffer());
    let bytes = buf;
    try { bytes = encodeCp1251(new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '')); } catch {}
    setRead(bytes);
    e.target.value = '';
  };
  $('[data-dl]', box).onclick = () => {
    const bytes = readFile(p, '/shapes.txt') || new Uint8Array();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: 'text/plain' }));
    a.download = 'shapes.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  let last = null;
  lab.refresh = () => {
    const bytes = readFile(p, '/shapes.txt');
    const text = bytes ? decodeCp1251(bytes) : '';
    if (text === last) return;
    last = text;
    const rows = text.split(/\r?\n/).filter(Boolean).map((line) => {
      const [type, rest = ''] = line.split(/:(.*)/s);
      const v = Object.fromEntries([...rest.matchAll(/(x1|y1|x2|y2):\s*(-?\d+);/g)].map((m) => [m[1], m[2]]));
      return [type, v];
    });
    $('.rows', box).innerHTML = rows.map(([t, v], i) => `<tr><td class="num">${i}</td><td title="${esc(t)}">${esc(SHAPE_EN[t] || t)} <span class="muted">${esc(t)}</span></td>${['x1', 'y1', 'x2', 'y2'].map((k) => `<td class="num">${v[k] ?? ''}</td>`).join('')}</tr>`).join('');
    $('.empty', box).hidden = rows.length > 0;
  };
}
function readFile(p, path) { try { return p.mod?.FS.analyzePath(path).exists ? p.mod.FS.readFile(path) : null; } catch { return null; } }

// ------------------------------------------------------------------ copying --
const ACTION_LABEL = { png: 'Copy image', table: 'Copy table', text: 'Copy text', results: 'Copy log' };
const ACTION_TIP = { png: 'Copy the client area as a PNG image (downloads it if the clipboard is unavailable)', table: 'Copy the table as tab-separated text, pastes into spreadsheets', text: 'Copy the text', results: 'Copy the message log as text' };
const actionBtn = (k) => `<button type="button" class="mini" data-act="${k}" title="${ACTION_TIP[k]}">${ACTION_LABEL[k]}</button>`;
const actions = (...kinds) => `<span class="copy-actions">${kinds.map(actionBtn).join('')}</span>`;
const tableTsv = (table) => [...table.rows].map((r) => [...r.cells].map((c) => c.innerText.trim().replace(/\s+/g, ' ')).join('\t')).join('\n');
const canvasPng = (canvas) => new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('PNG encoding failed'))), 'image/png'));

async function copyAction(btn) {
  const kind = btn.dataset.act, box = btn.closest('[data-copyable]');
  const done = (text) => { btn.textContent = text; setTimeout(() => (btn.textContent = ACTION_LABEL[kind]), 1400); };
  const name = (box?.dataset.title || 'image').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  try {
    if (kind === 'png') {
      const canvas = box.querySelector('.w32-frame canvas');
      if (!canvas) return done('No window');
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': canvasPng(canvas) })]);
        return done('Copied');
      } catch {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(await canvasPng(canvas));
        a.download = `${name}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        return done('Downloaded');
      }
    }
    const text = kind === 'table' ? tableTsv(box.querySelector('table')) : kind === 'text' ? box.querySelector('pre').innerText : logText(btn.closest('section.panel'));
    await navigator.clipboard.writeText(text);
    done('Copied');
  } catch (e) { console.error(e); done('Failed'); }
}
document.addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (b) copyAction(b); });

function logText(sec) {
  const lab = LABS.find((l) => `panel-${l.id}` === sec.id);
  const out = lab.procs.flatMap((p) => p.outputs.map((o) => `${p.exe} TextOut(${o.x}, ${o.y}): ${o.s}`));
  return [`Lab ${lab.tab}: ${lab.name}`, ...(out.length ? ['', 'Text drawn:', ...out.slice(-40)] : []), '', 'Message log:', ...lab.log.map((l) => l.text + (l.n > 1 ? ` ×${l.n}` : ''))].join('\n');
}

// --------------------------------------------------------------- framework --
const nav = $('#nav'), main = $('#labs');

function build() {
  for (const lab of LABS) {
    const b = document.createElement('button');
    b.type = 'button'; b.role = 'tab'; b.dataset.lab = lab.id;
    b.setAttribute('aria-controls', `panel-${lab.id}`);
    if (lab.main) {
      b.className = 'main';
      b.innerHTML = `<span class="lang cpp">C++</span>${esc(lab.name)}<span class="muted" style="font-weight:400">· lab ${lab.tab}</span>`;
    } else b.innerHTML = `Lab ${lab.tab}<span class="long muted" style="font-weight:400">· ${esc(lab.name)}</span>`;
    b.onclick = () => select(lab.id, true);
    if (lab === LABS[1]) nav.insertAdjacentHTML('beforeend', '<span class="nav-sep">Earlier versions</span>');
    nav.appendChild(b);

    const sec = document.createElement('section');
    sec.className = 'panel'; sec.id = `panel-${lab.id}`; sec.role = 'tabpanel'; sec.hidden = true;
    sec.innerHTML = `<div class="lab-head"><span class="lang cpp">C++ → Wasm</span><h3>${lab.main ? esc(lab.name) : `Lab ${lab.tab}: ${esc(lab.name)}`}${lab.main ? ` <span class="muted">· lab ${lab.tab}</span>` : ''}</h3><a href="${REPO}/tree/main/${lab.dir}" target="_blank" rel="noopener">View source</a></div>
      <p class="intro">${lab.intro}</p>
      <p class="note native">${lab.native}</p>
      <div class="controls"><button class="run" type="button" data-demo>Run demo</button><button class="ghost" type="button" data-restart>Restart</button>
        <span class="hint status">Starting…</span></div>
      <div class="desktop${lab.procs.length > 1 ? ' multi' : ''}"></div>
      <div class="extra"></div>
      <div class="panel inner log-panel" data-copyable data-title="Message log">
        <div class="copy-head"><h2>Message log <small>messages the lab's windows received, and what the processes did</small></h2>${actions('results')}</div>
        <ol class="log"></ol>
      </div>`;
    main.appendChild(sec);
    lab.sec = sec;
    lab.log = [];
    lab.started = false;
  }
}

function addLog(lab, text, proc, opts) {
  const line = lab.procs.length > 1 ? `[${proc.exe}] ${text}` : text;
  const last = lab.log[lab.log.length - 1];
  if (opts?.coalesce && last?.coalesce && last.text.split(' (')[0] === line.split(' (')[0]) { last.text = line; last.n++; }
  else { lab.log.push({ text: line, n: 1, coalesce: !!opts?.coalesce }); if (lab.log.length > 400) lab.log.shift(); }
  renderLog(lab);
}
function renderLog(lab) {
  if (lab.logQueued) return;
  lab.logQueued = true;
  requestAnimationFrame(() => {
    lab.logQueued = false;
    const ol = $('.log', lab.sec);
    ol.innerHTML = lab.log.slice(-120).map((l) => `<li>${esc(l.text)}${l.n > 1 ? ` <span class="muted">×${l.n}</span>` : ''}</li>`).join('');
    ol.scrollTop = ol.scrollHeight;
    lab.refresh?.();
  });
}

async function startLab(lab) {
  if (lab.started) return;
  lab.started = true;
  const sec = lab.sec, desk = $('.desktop', sec), status = $('.status', sec);
  lab.slots = lab.procs.map((cfg) => {
    const fig = document.createElement('figure');
    fig.className = 'w32-slot'; fig.dataset.copyable = ''; fig.dataset.title = `Lab ${lab.tab} ${cfg.exe.replace('.exe', '')}`;
    fig.innerHTML = `<figcaption><code>${esc(cfg.exe)}</code>${actions('png')}</figcaption><div class="slot"></div>`;
    desk.appendChild(fig);
    return $('.slot', fig);
  });
  try {
    if (lab.id === 'lab5') {
      const r = await fetch('../5-lab/shapesRead.txt');
      lab5Sample = new Uint8Array(await r.arrayBuffer());
      lab.procs[0].files = { '/shapesRead.txt': lab5Sample };
    }
    lab.procs = lab.procs.map((cfg, i) => new Process({
      ...cfg, slot: lab.slots[i], tr, toolNames: TOOLS,
      log: (text, p, opts) => addLog(lab, text, p, opts),
      onText: (p) => lab.onText?.(p),
      onState: () => updateStatus(lab),
    }));
    await Promise.all(lab.procs.map((p) => p.prepare()));
    await lab.extra?.(lab, sec);
    lab.procs.slice(0, lab.autostart ?? lab.procs.length).forEach((p) => p.start());
    updateStatus(lab);
    $('[data-restart]', sec).onclick = async () => { for (const p of lab.procs) p.kill(); lab.log = []; renderLog(lab); for (const p of lab.procs) { await p.prepare(); p.idleCard(); } lab.procs.slice(0, lab.autostart ?? lab.procs.length).forEach((p) => p.start()); updateStatus(lab); };
    $('[data-demo]', sec).onclick = async (e) => {
      const btn = e.currentTarget;
      if (btn.disabled) return;
      btn.disabled = true; btn.textContent = 'Running…';
      try {
        if (lab.procs[0].state !== 'running') { await lab.procs[0].prepare(); lab.procs[0].start(); await sleep(100); }
        await lab.demo(lab);
      } catch (err) { console.error(err); status.textContent = err.message; }
      finally { btn.disabled = false; btn.textContent = 'Run demo'; }
    };
  } catch (e) {
    console.error(e);
    status.innerHTML = `<span class="bad">${esc(e.message || e)}</span>`;
  }
}
function updateStatus(lab) {
  const st = $('.status', lab.sec);
  st.innerHTML = lab.procs.map((p) => `<span class="pill ${p.state}">${esc(p.exe)}: ${p.state === 'running' ? 'running' : p.state}</span>`).join(' ');
}

function select(id, push) {
  const lab = LABS.find((l) => l.id === id) || LABS[0];
  nav.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', b.dataset.lab === lab.id));
  main.querySelectorAll('section.panel[role="tabpanel"]').forEach((s) => (s.hidden = s.id !== `panel-${lab.id}`));
  if (push) try { history.replaceState(null, '', `#${lab.id}`); } catch {}
  document.title = lab.main ? 'Shape Editor · OOP Labs' : `Lab ${lab.tab} · Shape Editor`;
  startLab(lab);
}

build();
select(location.hash.slice(1), false);
window.addEventListener('hashchange', () => select(location.hash.slice(1), false));
