// OOP labs showcase: every lab executable runs from its own C++ sources, compiled to
// WebAssembly with a small Win32 shim (win32/ + host.js). This file lays out the tabs,
// starts the processes, and adds demos, file transfer for lab 5 and copy actions.
import { Process, clipboard, decodeCp1251, encodeCp1251 } from './host.js';

const REPO = 'https://github.com/Andrew1407/OOP';
const SRC = `${REPO}/blob/main`;
const $ = (s, root = document) => root.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WM_COMMAND = 0x111, WM_LBUTTONDOWN = 0x201, WM_LBUTTONUP = 0x202, WM_MOUSEMOVE = 0x200;

// --------------------------------------------------------------- English --
const EN = {
  'Робота 1': 'Work 1', 'Робота 2': 'Work 2', 'Так': 'Yes', 'Відміна': 'Cancel', 'Далі >': 'Next >', '< Назад': '< Back',
  "&Об'єкти": '&Objects', "Об'єкти": 'Objects', 'Точка': 'Point', 'Лінія': 'Line', 'Прямокутник': 'Rectangle', 'Еліпс': 'Ellipse',
  'Пряма з кружечками': 'Line with circles', 'Лінія з кружечками': 'Line with circles', 'Куб': 'Cube',
  '&Файл': '&File', 'Вы&ход': 'E&xit', 'Вихід': 'Exit', '&Справка': '&Help', '&О программе...': '&About...',
  'Очистити': 'Clear', 'Зчитати файл': 'Read file', 'Список фігур': 'Shape list', 'Видалити': 'Delete',
  'Виділити/зняти виділення': 'Select / deselect', 'Закрити': 'Close', 'Ввести значення матриці': 'Enter matrix values',
  'Виконати': 'Execute', 'Розмірність матриці:': 'Matrix size:', 'Мінімальне значення елементу:': 'Minimum element value:',
  'Максимальне значення елементу:': 'Maximum element value:', 'ОК': 'OK', 'Детермінант матриці:': 'Matrix determinant:',
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

const LABS = [
  {
    id: 'lab1', tab: '1', name: 'Dialogs and a scroll bar', dir: '1-lab', file: '1-lab/module1.cpp',
    intro: 'A Win32 skeleton split into modules. <b>Work 1</b> opens a dialog with a horizontal scroll bar (range 1–100); after <b>Yes</b> the main window prints the position with <code>TextOut</code> at (900, 20). <b>Work 2</b> is a chain of dialogs: <b>Next &gt;</b> and <b>&lt; Back</b> call <code>Work2Func</code> recursively until <b>Cancel</b>.',
    native: NATIVE('<code>Lab1.cpp</code>, <code>module1.cpp</code> and <code>module2.cpp</code>'),
    bugs: ['<b>Yes</b> in the second Work 2 dialog does nothing: its <code>IDYES2</code> isn\'t handled in <code>Work2Cb</code>.', 'The length passed to <code>TextOut</code> counts the terminating zero (2 for one digit), so an invisible NUL is drawn after the number.'],
    procs: [{ ...exeCfg('1-lab', 'Lab1.exe', 'lab1', { client: [960, 150], max: [960, 150] }), rc: ['../1-lab/Lab1.rc'], defs: ['../1-lab/resource.h'], unicode: true }],
    demo: demoLab1,
  },
  {
    id: 'lab2', tab: '2', name: 'Shape hierarchy', dir: '2-lab', file: '2-lab/shape.cpp',
    intro: 'An abstract <code>Shape</code> with a pure virtual <code>Show</code> and <code>Point</code>, <code>Line</code>, <code>Rect</code> and <code>Ellipse</code> subclasses, plus a parallel <code>Editor</code> hierarchy that rubber-bands each shape with a dotted red <code>R2_NOTXORPEN</code> pen. Pick a shape in <b>Objects</b> and drag on the canvas. Rectangles grow out from the point you press (mirrored around it), ellipses from a corner.',
    native: NATIVE('<code>Lab2.cpp</code>, <code>shape.cpp</code>, <code>editor.cpp</code> and <code>shape_editor.cpp</code>'),
    bugs: ['<code>shapeList</code> holds 105 shapes with no bounds check: a 106th overwrites memory after the array.', 'The window\'s <code>WM_PAINT</code> has <code>OnPaint</code> commented out, so the shapes are only repainted while you drag a new one.'],
    procs: [{ ...exeCfg('2-lab', 'Lab2.exe', 'lab2'), rc: ['../2-lab/Lab2.rc'], defs: ['../2-lab/resource.h'], unicode: true }],
    demo: (lab) => demoDraw(lab, DRAW_DEMO.lab2),
  },
  {
    id: 'lab3', tab: '3', name: 'Editors and a toolbar', dir: '3-lab', file: '3-lab/editor.cpp',
    intro: 'The shape and editor hierarchies with a toolbar built by <code>CreateToolbarEx</code> from the lab\'s <code>bitmap1.bmp</code>. The toolbar keeps the current tool pressed and the <b>Objects</b> menu shows a check mark, set by the lab in <code>WM_INITMENUPOPUP</code>. Rubber bands are blue and dotted, with sky-blue rectangles, khaki final rectangles and grey ellipses.',
    native: NATIVE('<code>Lab3.cpp</code>, <code>shape.cpp</code>, <code>editor.cpp</code>, <code>shape_editor.cpp</code> and <code>toolbar.cpp</code>'),
    bugs: ['Hover a toolbar button: the tooltip text is garbled. The project is built as Unicode, but <code>TBIconsNotify</code> casts ANSI (Windows-1251) string literals to <code>LPWSTR</code>, so <code>lstrcpy</code> copies them as UTF-16. The tooltip shows exactly what the lab returns.'],
    procs: [{ ...exeCfg('3-lab', 'Lab3.exe', 'lab3'), rc: ['../3-lab/Lab3.rc'], defs: ['../3-lab/resource.h'], bitmaps: { 130: '../3-lab/bitmap1.bmp' }, unicode: true }],
    demo: (lab) => demoDraw(lab, DRAW_DEMO.lab3),
  },
  {
    id: 'lab4', tab: '4', name: 'Multiple inheritance', dir: '4-lab', file: '4-lab/shape.h',
    intro: 'Virtual and multiple inheritance: <code>LineOOShape : public EllipseShape, public LineShape</code> draws a line with a circle at each end, and <code>CubeShape</code> is a composite of twelve <code>LineShape</code> edges. Each editor class creates the matching shape to show itself.',
    native: NATIVE('<code>Lab4.cpp</code>, <code>shape.cpp</code>, <code>editor.cpp</code>, <code>shape_editor.cpp</code> and <code>toolbar.cpp</code>'),
    bugs: ['The toolbar tooltips are garbled, as in lab 3 (ANSI literals copied as UTF-16).'],
    procs: [{ ...exeCfg('4-lab', 'Lab4.exe', 'lab4'), rc: ['../4-lab/Lab4.rc'], defs: ['../4-lab/Resource.h'], bitmaps: { 129: '../4-lab/bitmap1.bmp' }, unicode: true }],
    demo: (lab) => demoDraw(lab, DRAW_DEMO.lab4),
  },
  {
    id: 'lab5', tab: '5', name: 'Singleton, table and files', dir: '5-lab', file: '5-lab/my_table.cpp',
    intro: 'The editor becomes a singleton (<code>MyEditor::GetInstance</code>). Every shape you draw is appended to <code>shapes.txt</code> and to the modeless <b>Shape list</b> window (<b>Help → Shape list</b>), where you can select a shape to highlight it in red, or delete it. <b>File → Read file</b> loads <code>shapesRead.txt</code>. The files live in the module\'s memory file system and use the same Windows-1251 text format as the lab, so you can download what it wrote or upload your own file to read.',
    native: NATIVE('<code>Lab5.cpp</code>, <code>my_editor.cpp</code>, <code>my_table.cpp</code>, <code>editor.cpp</code>, <code>shape.cpp</code> and <code>toolbar.cpp</code>'),
    bugs: ['<b>Read file</b> draws the shapes with <code>GetDC</code> right after <code>InvalidateRect</code> and never adds them to the editor, so the pending <code>WM_PAINT</code> erases them at once. Only the <b>Shape list</b> shows what was read.', 'The list window\'s ✕ does nothing: <code>DlgProc</code> doesn\'t handle <code>IDCANCEL</code>. Use <b>Close</b>.', '<b>Read file</b> twice with the list window closed appends the file to the list a second time (<code>Index</code> is only reset through the list box).'],
    procs: [{ ...exeCfg('5-lab', 'Lab5.exe', 'lab5'), rc: ['../5-lab/Lab5.rc', '../5-lab/my_table.rc'], defs: ['../5-lab/resource.h', '../5-lab/resource1.h'], bitmaps: { 129: '../5-lab/bitmap1.bmp' }, unicode: false }],
    demo: demoLab5,
    extra: lab5Extra,
  },
  {
    id: 'lab6', tab: '6', name: 'Inter-process matrix', dir: '6-lab', file: '6-lab/Object3/matrix_res.cpp',
    intro: 'Three programs cooperate. <b>lab6</b> asks for a matrix size and value range and sends them to <b>Object2</b> with <code>WM_COPYDATA</code>, starting it with <code>WinExec</code> if <code>FindWindow</code> can\'t find it. Object2 fills the matrix with <code>rand()</code>, draws it, puts it on the clipboard as <code>CF_TEXT</code> and posts a <code>WM_COMMAND</code> to <b>Object3</b>, which reads the clipboard and prints the determinant (cofactor expansion in <code>float</code>).',
    native: '<b>Runs natively</b>, as three WebAssembly modules (one per process) built from <code>lab6.cpp</code> + <code>Matrix_res.cpp</code>, <code>Object2.cpp</code> + <code>matrix_res.cpp</code> and <code>Object3.cpp</code> + <code>matrix_res.cpp</code>. The page plays the part of Windows between them: <code>SendMessage(WM_COPYDATA)</code> copies the data into the receiver\'s memory and runs its window procedure, <code>PostMessage</code> queues, and the clipboard is shared by the three modules (not your system clipboard). <code>rand()</code> is the MSVC generator, so a seed gives the same matrix as on Windows.',
    bugs: ['An empty or non-numeric field makes <code>std::stol</code> throw, which ends lab6.', 'Object3 copies the clipboard with <code>strcpy_s(dest, 300, …)</code>, so a matrix text of 300 bytes or more (about 8×8 and up) ends Object3 through the CRT\'s invalid parameter handler.', 'Object3 gets two <code>WM_COMMAND</code>s per run (from Object2 and from lab6) and computes the determinant twice. It also recomputes it on its own <b>File</b> and <b>Help</b> menu commands.'],
    procs: [
      { ...exeCfg('6-lab/lab6', 'lab6.exe', 'lab6', { client: [460, 110], max: [460, 110] }), rc: ['../6-lab/lab6/lab6.rc'], defs: ['../6-lab/lab6/resource.h'], unicode: false },
      { ...exeCfg('6-lab/Object2', 'Object2.exe', 'object2', { max: [460, 260] }), rc: ['../6-lab/Object2/Object2.rc'], defs: ['../6-lab/Object2/Resource.h'], unicode: false, idle: 'lab6 starts it with <code>WinExec</code>.' },
      { ...exeCfg('6-lab/Object3', 'Object3.exe', 'object3', { max: [460, 90] }), rc: ['../6-lab/Object3/Object3.rc'], defs: ['../6-lab/Object3/Resource.h'], unicode: false, idle: 'lab6 or Object2 starts it with <code>WinExec</code>.' },
    ],
    autostart: 1,
    demo: demoLab6,
    extra: lab6Extra,
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
async function demoLab1(lab) {
  const p = lab.procs[0], slot = lab.slots[0];
  btnByOrig(slot, 'Робота 1').click();
  const dlg = await waitFor(() => visibleDialog(slot));
  const right = dlg.querySelectorAll('.w32-scroll .arr')[1];
  for (let i = 0; i < 6; i++) { right.click(); await sleep(70); }
  const d = [...p.dialogs.values()].pop();
  const bar = d.controls.find((c) => c.type === 'SCROLLBAR');
  p.enqueue([d.h, 0x114, (42 << 16) | 5, bar.h]); // the thumb dragged to 42 and let go
  p.enqueue([d.h, 0x114, (42 << 16) | 4, bar.h]);
  p.enqueue([d.h, 0x114, 8, bar.h]);
  await sleep(400);
  btnByOrig(dlg, 'Так').click();
  await sleep(500);
  btnByOrig(slot, 'Робота 2').click();
  for (const step of ['Далі >', '< Назад', 'Далі >', 'Так', 'Відміна']) {
    const box = await waitFor(() => visibleDialog(slot));
    await sleep(450);
    btnByOrig(box, step).click();
    await sleep(120);
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
async function demoLab6(lab) {
  const slot = lab.slots[0];
  btnByOrig(slot, 'Ввести значення матриці').click();
  const dlg = await waitFor(() => visibleDialog(slot));
  const [size, min, max] = dlg.querySelectorAll('.w32-edit');
  for (const [inp, v] of [[size, '4'], [min, '-9'], [max, '9']]) { inp.value = ''; for (const ch of v) { inp.value += ch; await sleep(90); } }
  await sleep(250);
  btnByOrig(dlg, 'Виконати').click();
  await sleep(900);
  btnByOrig(dlg, 'Закрити')?.click(); // the dialog stays open until Close, over Object2's window
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

// ---------------------------------------------------------- lab 6 extras --
function det(m) { // float64 check of the lab's float determinant
  const n = m.length, a = m.map((r) => [...r]);
  let d = 1;
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (!a[p][c]) return 0;
    if (p !== c) { [a[p], a[c]] = [a[c], a[p]]; d = -d; }
    d *= a[c][c];
    for (let r = c + 1; r < n; r++) { const f = a[r][c] / a[c][c]; for (let k = c; k < n; k++) a[r][k] -= f * a[c][k]; }
  }
  return d;
}
function lab6Extra(lab, sec) {
  const box = $('.extra', sec);
  box.innerHTML = `<div class="stats"><div class="stat"><b class="det">–</b><span>determinant (Object3, float)</span></div><div class="stat"><b class="chk">–</b><span>exact value (checked by this page)</span></div><div class="stat"><b class="size">–</b><span>matrix size</span></div></div>
    <div class="two-col">
      <div class="panel inner" data-copyable data-title="Matrix">
        <div class="copy-head"><h2>Matrix <small>parsed from the clipboard</small></h2>${actions('table')}</div>
        <div class="table-wrap"><table class="mtx"><tbody></tbody></table></div><p class="hint empty">Run lab6 to generate one.</p>
      </div>
      <div class="panel inner" data-copyable data-title="Clipboard">
        <div class="copy-head"><h2>Clipboard <small>CF_TEXT, shared by the three processes</small></h2>${actions('text')}</div>
        <pre class="text clip">(empty)</pre>
      </div></div>`;
  const update = () => {
    const text = clipboard.text();
    $('.clip', box).textContent = text || '(empty)';
    const rows = text.split('\n').filter((r) => r.trim()).map((r) => r.trim().split(/\s+/).map(Number));
    $('.mtx tbody', box).innerHTML = rows.map((r) => `<tr>${r.map((v) => `<td class="num">${v}</td>`).join('')}</tr>`).join('');
    $('.empty', box).hidden = rows.length > 0;
    $('.size', box).textContent = rows.length ? `${rows.length} × ${rows[0].length}` : '–';
    $('.chk', box).textContent = rows.length && rows.every((r) => r.length === rows.length) ? String(Math.round(det(rows))) : '–';
  };
  clipboard.listen(update);
  lab.onText = (p) => {
    if (p.exe !== 'Object3.exe') return;
    const last = [...p.outputs].reverse().find((o) => o.s.includes(':'));
    if (last) $('.det', box).textContent = last.s.split(':').pop().trim();
  };
  update();
}

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
    b.innerHTML = `<span class="lang cpp">C++</span>Lab ${lab.tab}<span class="long muted" style="font-weight:400">· ${esc(lab.name)}</span>`;
    b.onclick = () => select(lab.id, true);
    nav.appendChild(b);

    const sec = document.createElement('section');
    sec.className = 'panel'; sec.id = `panel-${lab.id}`; sec.role = 'tabpanel'; sec.hidden = true;
    sec.innerHTML = `<div class="lab-head"><span class="lang cpp">C++ → Wasm</span><h3>Lab ${lab.tab}: ${esc(lab.name)}</h3><a href="${REPO}/tree/main/${lab.dir}" target="_blank" rel="noopener">View source</a></div>
      <p class="intro">${lab.intro}</p>
      <p class="note native">${lab.native}</p>
      <div class="controls"><button class="run" type="button" data-demo>Run demo</button><button class="ghost" type="button" data-restart>Restart</button>
        <span class="hint status">Starting…</span></div>
      <div class="desktop${lab.procs.length > 1 ? ' multi' : ''}"></div>
      <div class="extra"></div>
      ${lab.bugs?.length ? `<div class="note bugs"><b>Lab bugs, kept as they are:</b><ul>${lab.bugs.map((x) => `<li>${x}</li>`).join('')}</ul></div>` : ''}
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
  document.title = `Lab ${lab.tab} · OOP Labs`;
  startLab(lab);
}

build();
select(location.hash.slice(1), false);
window.addEventListener('hashchange', () => select(location.hash.slice(1), false));
