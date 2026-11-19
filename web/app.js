// OOP shape editor showcase: the lab 5 painting app, running from its own C++ sources compiled
// to WebAssembly with a small Win32 shim (win32/ + host.js). This file starts the process and adds
// a demo, shapes.txt / shapesRead.txt transfer and copy actions.
import { Process, decodeCp1251, encodeCp1251 } from './host.js';

const REPO = 'https://github.com/Andrew1407/OOP';
const SRC = `${REPO}/blob/main`;
const $ = (s, root = document) => root.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WM_COMMAND = 0x111, WM_LBUTTONDOWN = 0x201, WM_LBUTTONUP = 0x202, WM_MOUSEMOVE = 0x200;

const TOOLS = { IDM_POINT: 'Point', IDM_LINE: 'Line', IDM_RECT: 'Rectangle', IDM_ELLIPSE: 'Ellipse', IDM_OOLINE: 'Line with circles', IDM_CUBE: 'Cube' };

// -------------------------------------------------------------------- app --
const APP = {
  exe: 'Lab5.exe', module: './wasm/lab5.mjs', icon: '../5-lab/small.ico', client: [800, 450], max: [800, 450],
  rc: ['../5-lab/Lab5.rc', '../5-lab/my_table.rc'], defs: ['../5-lab/resource.h', '../5-lab/resource1.h'],
  bitmaps: { 129: '../5-lab/bitmap1.bmp' }, unicode: false,
};
const DEMO = [['IDM_POINT', [70, 70], [70, 70]], ['IDM_LINE', [120, 50], [280, 150]], ['IDM_RECT', [330, 50], [470, 150]],
  ['IDM_ELLIPSE', [620, 110], [720, 170]], ['IDM_OOLINE', [90, 250], [300, 360]], ['IDM_CUBE', [380, 230], [520, 340]]];
const app = { proc: null, slot: null, refresh: null };

// ------------------------------------------------------------------ demos --
const frameOf = (p) => [...p.frames.entries()].find(([, e]) => e.kind === 'frame');
async function waitFor(fn, ms = 4000) { const t = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t > ms) throw new Error('The demo timed out'); await sleep(40); } }
const visibleDialog = (slot) => [...slot.querySelectorAll('.w32-dialog')].find((d) => !d.hidden);
const btnByText = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === text);

async function drag(p, h, [x0, y0], [x1, y1], steps = 14) {
  p.input(h, WM_LBUTTONDOWN, x0, y0);
  for (let i = 1; i <= steps; i++) { await sleep(22); p.input(h, WM_MOUSEMOVE, Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps)); }
  await sleep(30);
  p.input(h, WM_LBUTTONUP, x1, y1);
  await sleep(90);
}
async function runDemo() {
  const p = app.proc, slot = app.slot;
  const [h] = frameOf(p);
  if (!slot.querySelector('.w32-dialog:not([hidden])')) { p.post(h, WM_COMMAND, p.res.defs.ID_SHAPES_LIST, 0); await sleep(150); }
  for (const [cmd, a, b] of DEMO) {
    p.post(h, WM_COMMAND, p.res.defs[cmd], 0);
    await sleep(60);
    await drag(p, h, a, b, cmd === 'IDM_POINT' ? 5 : 14);
  }
  const list = await waitFor(() => slot.querySelector('.w32-dialog .w32-list'));
  await sleep(200);
  list.querySelector('[data-i="2"]')?.click();
  await sleep(250);
  btnByText(list.closest('.w32-dialog'), 'Select/deselect').click();
}
// ---------------------------------------------------------- lab 5 extras --
let lab5Sample = null;
function filesPanel(box) {
  box.innerHTML = `<div class="two-col">
      <div class="panel inner" data-copyable data-title="shapes.txt">
        <div class="copy-head"><h2>shapes.txt <small>written by the lab</small></h2><span class="copy-actions"><button type="button" class="mini" data-dl>Download</button>${actionBtn('table')}</span></div>
        <div class="table-wrap"><table><thead><tr><th class="num">#</th><th>Shape</th><th class="num">x1</th><th class="num">y1</th><th class="num">x2</th><th class="num">y2</th></tr></thead><tbody class="rows"></tbody></table></div>
        <p class="hint empty">Draw a shape to write a line.</p>
      </div>
      <div class="panel inner" data-copyable data-title="shapesRead.txt">
        <div class="copy-head"><h2>shapesRead.txt <small>read by File → Read file</small></h2><span class="copy-actions"><label class="mini file">Upload<input type="file" accept=".txt,text/plain" hidden></label><button type="button" class="mini" data-reset>Lab sample</button>${actionBtn('text')}</span></div>
        <pre class="text read"></pre>
        <p class="hint">Text in the lab's format: <code>Cube:  x1: 189; y1: 171; x2: 279; y2: 250;</code></p>
      </div></div>`;
  const p = app.proc;
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
  app.refresh = () => {
    const bytes = readFile(p, '/shapes.txt');
    const text = bytes ? decodeCp1251(bytes) : '';
    if (text === last) return;
    last = text;
    const rows = text.split(/\r?\n/).filter(Boolean).map((line) => {
      const [type, rest = ''] = line.split(/:(.*)/s);
      const v = Object.fromEntries([...rest.matchAll(/(x1|y1|x2|y2):\s*(-?\d+);/g)].map((m) => [m[1], m[2]]));
      return [type, v];
    });
    $('.rows', box).innerHTML = rows.map(([t, v], i) => `<tr><td class="num">${i}</td><td>${esc(t)}</td>${['x1', 'y1', 'x2', 'y2'].map((k) => `<td class="num">${v[k] ?? ''}</td>`).join('')}</tr>`).join('');
    $('.empty', box).hidden = rows.length > 0;
  };
}
function readFile(p, path) { try { return p.mod?.FS.analyzePath(path).exists ? p.mod.FS.readFile(path) : null; } catch { return null; } }

// ------------------------------------------------------------------ copying --
const ACTION_LABEL = { png: 'Copy image', table: 'Copy table', text: 'Copy text' };
const ACTION_TIP = { png: 'Copy the client area as a PNG image (downloads it if the clipboard is unavailable)', table: 'Copy the table as tab-separated text, pastes into spreadsheets', text: 'Copy the text' };
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
    const text = kind === 'table' ? tableTsv(box.querySelector('table')) : box.querySelector('pre').innerText;
    await navigator.clipboard.writeText(text);
    done('Copied');
  } catch (e) { console.error(e); done('Failed'); }
}
document.addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (b) copyAction(b); });

// -------------------------------------------------------------------- run --
const status = $('#status');
let refreshQueued = false;
function queueRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => { refreshQueued = false; app.refresh?.(); });
}
function updateStatus() {
  const p = app.proc;
  status.innerHTML = p ? `<span class="pill ${p.state}">${esc(p.exe)}: ${esc(p.state)}</span>` : 'Starting…';
}

async function start() {
  const fig = $('#editor');
  fig.innerHTML = `<figcaption><code>${esc(APP.exe)}</code>${actions('png')}</figcaption><div class="slot"></div>`;
  app.slot = $('.slot', fig);
  try {
    const r = await fetch('../5-lab/shapesRead.txt');
    lab5Sample = new Uint8Array(await r.arrayBuffer());
    app.proc = new Process({
      ...APP, files: { '/shapesRead.txt': lab5Sample }, slot: app.slot, toolNames: TOOLS,
      log: queueRefresh, onText: () => {}, onState: updateStatus,
    });
    await app.proc.prepare();
    filesPanel($('#files'));
    app.proc.start();
    updateStatus();
    $('[data-restart]').onclick = async () => { app.proc.kill(); await app.proc.prepare(); app.proc.idleCard(); app.proc.start(); updateStatus(); queueRefresh(); };
    $('[data-demo]').onclick = async (e) => {
      const btn = e.currentTarget;
      if (btn.disabled) return;
      btn.disabled = true; btn.textContent = 'Running…';
      try {
        if (app.proc.state !== 'running') { await app.proc.prepare(); app.proc.start(); await sleep(100); }
        await runDemo();
      } catch (err) { console.error(err); status.textContent = err.message; }
      finally { btn.disabled = false; btn.textContent = 'Run demo'; }
    };
  } catch (e) {
    console.error(e);
    status.innerHTML = `<span class="bad">${esc(e.message || e)}</span>`;
  }
}
start();
