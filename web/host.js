// The page side of the Win32 shim (web/win32/win32.cpp). Each lab executable is one
// Process: a wasm module running the lab's own wWinMain, with its windows drawn here.
//  - Gdi: a software raster for the client area, with GDI's pen styles and ROP2 modes,
//    so R2_NOTXORPEN rubber bands behave as on Windows.
//  - parseRc: reads the lab's .rc script and resource.h, so menus, dialogs and string
//    tables come from the lab's own resources.
//  - Process: windows, menus, toolbars, dialogs and controls as HTML, a message queue the
//    module's GetMessage waits on, and routing for messages sent between processes.

// ---------------------------------------------------------------- strings --
const dec1251 = new TextDecoder('windows-1251');
const enc1251 = (() => {
  const m = new Map();
  const all = dec1251.decode(Uint8Array.from({ length: 256 }, (_, i) => i));
  [...all].forEach((ch, i) => m.set(ch, i));
  return (s) => Uint8Array.from([...s].map((ch) => m.get(ch) ?? 63));
})();
export const decodeCp1251 = (bytes) => dec1251.decode(bytes);
export const encodeCp1251 = enc1251;

function decodeText(buf) {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2));
  try { return new TextDecoder('utf-8', { fatal: true }).decode(b).replace(/^﻿/, ''); } catch { return dec1251.decode(b); }
}

// --------------------------------------------------------------- resources --
const BUILTIN_IDS = { IDOK: 1, IDCANCEL: 2, IDABORT: 3, IDRETRY: 4, IDIGNORE: 5, IDYES: 6, IDNO: 7, IDC_STATIC: -1 };

export function parseDefines(text) {
  const defs = {};
  for (const m of text.matchAll(/^\s*#define\s+(\w+)\s+(-?(?:0x[0-9a-f]+|\d+))\b/gim)) defs[m[1]] = Number(m[2]);
  return defs;
}

const unquote = (s) => s.slice(1, -1).replace(/""/g, '"').replace(/\\t/g, '\t').replace(/\\n/g, '\n');
function splitArgs(s) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') { if (q && s[i + 1] === '"') { cur += '""'; i++; continue; } q = !q; cur += c; continue; }
    if (c === ',' && !q) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** The parts of a .rc script the labs use: STRINGTABLE, MENU and DIALOG(EX) resources. */
export function parseRc(text, defs) {
  const id = (t) => (t == null ? 0 : /^-?\d+$/.test(t) ? Number(t) : defs[t] ?? BUILTIN_IDS[t] ?? t);
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const res = { strings: {}, menus: {}, dialogs: {} };
  let i = 0;
  const next = () => {
    while (i < lines.length && (!lines[i] || lines[i].startsWith('//') || lines[i].startsWith('#'))) i++;
    return i < lines.length ? lines[i++] : null;
  };
  const skipBlock = () => { let depth = 1; let l; while (depth && (l = next()) != null) { if (/^(BEGIN|\{)$/.test(l)) depth++; else if (/^(END|\})$/.test(l)) depth--; } };
  const menuItems = () => {
    const items = [];
    let l;
    while ((l = next()) != null && !/^(END|\})$/.test(l)) {
      let m;
      if ((m = l.match(/^POPUP\s+("(?:[^"]|"")*")/))) { next(); items.push({ popup: true, text: unquote(m[1]), items: menuItems() }); }
      else if (/^MENUITEM\s+SEPARATOR/.test(l)) items.push({ separator: true });
      else if ((m = l.match(/^MENUITEM\s+(.*)$/))) { const a = splitArgs(m[1]); items.push({ text: unquote(a[0]), id: id(a[1]) }); }
    }
    return items;
  };
  const TEXT_CONTROLS = /^(PUSHBUTTON|DEFPUSHBUTTON|LTEXT|RTEXT|CTEXT|GROUPBOX|CHECKBOX|AUTOCHECKBOX|RADIOBUTTON|AUTORADIOBUTTON|ICON)$/;
  let l;
  while ((l = next()) != null) {
    let m;
    if (/^STRINGTABLE\b/.test(l)) {
      while ((l = next()) != null && !/^BEGIN$/.test(l)) {}
      while ((l = next()) != null && !/^END$/.test(l)) {
        if ((m = l.match(/^(\w+)\s*,?\s*("(?:[^"]|"")*")/))) res.strings[id(m[1])] = unquote(m[2]);
      }
    } else if ((m = l.match(/^(\w+)\s+MENU(EX)?\b/))) {
      while ((l = next()) != null && !/^(BEGIN|\{)$/.test(l)) {}
      res.menus[id(m[1])] = menuItems();
    } else if ((m = l.match(/^(\w+)\s+DIALOG(EX)?\s+(.*)$/))) {
      const [, , w, h] = splitArgs(m[3]).map(Number);
      const dlg = { w, h, caption: '', controls: [] };
      while ((l = next()) != null && !/^BEGIN$/.test(l)) { const c = l.match(/^CAPTION\s+("(?:[^"]|"")*")/); if (c) dlg.caption = unquote(c[1]); }
      while ((l = next()) != null && !/^END$/.test(l)) {
        const c = l.match(/^(\w+)\s+(.*)$/);
        if (!c) continue;
        const type = c[1], a = splitArgs(c[2]);
        let ctl;
        if (type === 'CONTROL') ctl = { type: unquote(a[2] || '""').toUpperCase(), text: unquote(a[0]), id: id(a[1]), x: +a[4], y: +a[5], w: +a[6], h: +a[7], style: a[3] || '' };
        else if (TEXT_CONTROLS.test(type)) ctl = { type, text: a[0].startsWith('"') ? unquote(a[0]) : a[0], id: id(a[1]), x: +a[2], y: +a[3], w: +a[4], h: +a[5], style: a[6] || '' };
        else ctl = { type, text: '', id: id(a[0]), x: +a[1], y: +a[2], w: +a[3], h: +a[4], style: a[5] || '' };
        dlg.controls.push(ctl);
      }
      res.dialogs[id(m[1])] = dlg;
    } else if (/^(BEGIN|\{)$/.test(l)) skipBlock();
  }
  return res;
}

export async function loadResources(rcUrls, hUrls) {
  const fetchText = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: ${r.status}`); return decodeText(await r.arrayBuffer()); };
  const defs = Object.assign({}, ...(await Promise.all(hUrls.map(fetchText))).map(parseDefines));
  const res = { strings: {}, menus: {}, dialogs: {}, defs };
  for (const t of await Promise.all(rcUrls.map(fetchText))) {
    const r = parseRc(t, defs);
    Object.assign(res.strings, r.strings); Object.assign(res.menus, r.menus); Object.assign(res.dialogs, r.dialogs);
  }
  return res;
}

// --------------------------------------------------------------------- GDI --
const PEN_STYLES = { 1: [18, 6], 2: [3, 3], 3: [9, 6, 3, 6], 4: [9, 3, 3, 3, 3, 3] }; // as GDI's cosmetic pens
function rop2(op, p, d) {
  switch (op) {
    case 1: return 0;
    case 2: return ~(p | d);
    case 3: return ~p & d;
    case 4: return ~p;
    case 5: return p & ~d;
    case 6: return ~d;
    case 7: return p ^ d;
    case 8: return ~(p & d);
    case 9: return p & d;
    case 10: return ~(p ^ d);
    case 11: return d;
    case 12: return ~p | d;
    case 14: return p | ~d;
    case 15: return p | d;
    case 16: return 0xffffff;
    default: return p;
  }
}

export class Gdi {
  constructor(canvas, w, h) {
    this.canvas = canvas; this.w = w; this.h = h;
    canvas.width = w; canvas.height = h;
    this.ctx = canvas.getContext('2d');
    this.img = this.ctx.createImageData(w, h);
    this.px = new Uint32Array(this.img.data.buffer);
    this.px.fill(0xffffffff);
    this.queued = false;
    this.present();
  }
  present() {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => { this.queued = false; this.ctx.putImageData(this.img, 0, 0); });
  }
  flush() { this.queued = false; this.ctx.putImageData(this.img, 0, 0); }
  // Apply one pixel set once (a Map of index -> colour), so XOR modes never hit a pixel twice.
  apply(map, rop) {
    const px = this.px;
    for (const [i, c] of map) px[i] = 0xff000000 | (rop2(rop, c, px[i] & 0xffffff) & 0xffffff);
    this.present();
  }
  idx(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : y * this.w + x; }
  // Outline pixels in drawing order get the pen pattern; the gaps take the (opaque) background.
  stroke(map, pts, style, width, color) {
    if (style === 5) return;
    const pat = PEN_STYLES[style];
    const period = pat ? pat.reduce((a, b) => a + b, 0) : 0;
    const r = width > 1 ? Math.floor(width / 2) : 0;
    pts.forEach(([x, y], k) => {
      let on = true;
      if (pat) { let t = k % period, j = 0; while (t >= pat[j]) t -= pat[j++]; on = j % 2 === 0; }
      const c = on ? color : 0xffffff;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const i = this.idx(x + dx, y + dy); if (i >= 0) map.set(i, c); }
    });
  }
  line(x0, y0, x1, y1, ps, pw, pc, rop) {
    const pts = [];
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    let x = x0, y = y0;
    while (!(x === x1 && y === y1)) { // LineTo leaves out the end point
      pts.push([x, y]);
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    const map = new Map();
    this.stroke(map, pts, ps, pw, pc);
    this.apply(map, rop);
  }
  rect(l, t, r, b, ps, pw, pc, bs, bc, rop) {
    if (l > r) [l, r] = [r, l];
    if (t > b) [t, b] = [b, t];
    if (r - l < 1 || b - t < 1) return;
    const map = new Map();
    if (bs !== 1) for (let y = t + 1; y < b - 1; y++) for (let x = l + 1; x < r - 1; x++) { const i = this.idx(x, y); if (i >= 0) map.set(i, bc); }
    const pts = [];
    for (let x = l; x < r; x++) pts.push([x, t]);
    for (let y = t + 1; y < b; y++) pts.push([r - 1, y]);
    for (let x = r - 2; x >= l; x--) pts.push([x, b - 1]);
    for (let y = b - 2; y > t; y--) pts.push([l, y]);
    this.stroke(map, pts, ps, pw, pc);
    this.apply(map, rop);
  }
  ellipse(l, t, r, b, ps, pw, pc, bs, bc, rop) {
    if (l > r) [l, r] = [r, l];
    if (t > b) [t, b] = [b, t];
    if (r - l < 1 || b - t < 1) return;
    const cx = (l + r - 1) / 2, cy = (t + b - 1) / 2, a = (r - l - 1) / 2, e = (b - t - 1) / 2;
    const span = (d, rad) => { if (rad <= 0) return Math.abs(d) < 0.5 ? 0 : -1; const s = 1 - (d / rad) ** 2; return s < 0 ? -1 : Math.sqrt(s); };
    const edge = new Set(), rows = [];
    const key = (x, y) => y * 65536 + x;
    for (let y = t; y < b; y++) {
      const s = span(y - cy, e);
      if (s < 0) continue;
      const xl = Math.round(cx - a * s), xr = Math.round(cx + a * s);
      rows.push([y, xl, xr]);
      edge.add(key(xl, y)); edge.add(key(xr, y));
    }
    for (let x = l; x < r; x++) {
      const s = span(x - cx, a);
      if (s < 0) continue;
      edge.add(key(x, Math.round(cy - e * s))); edge.add(key(x, Math.round(cy + e * s)));
    }
    const map = new Map();
    if (bs !== 1) for (const [y, xl, xr] of rows) for (let x = xl + 1; x < xr; x++) if (!edge.has(key(x, y))) { const i = this.idx(x, y); if (i >= 0) map.set(i, bc); }
    const pts = [...edge].map((k) => [k % 65536, Math.floor(k / 65536)])
      .map(([x, y]) => [x, y, Math.atan2((y - cy) * (a || 1), (x - cx) * (e || 1))])
      .sort((p, q) => p[2] - q[2]).map(([x, y]) => [x, y]);
    this.stroke(map, pts, ps, pw, pc);
    this.apply(map, rop);
  }
  pixel(x, y, c) { const i = this.idx(x, y); if (i >= 0) { this.px[i] = 0xff000000 | (c & 0xffffff); this.present(); } }
  fill(c) { this.px.fill(0xff000000 | c); this.present(); }
  // TextOut with the default System font: black text in an opaque white cell, 16 px high.
  text(x, y, s, fg, bg, mode) {
    s = s.replace(/\0/g, '');
    if (!s) return;
    const tc = (Gdi.tc ??= document.createElement('canvas'));
    const ctx = tc.getContext('2d', { willReadFrequently: true });
    const font = '700 13px "Segoe UI", Tahoma, Arial, sans-serif';
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(s).width) + 1, h = 16;
    tc.width = w; tc.height = h;
    ctx.font = font;
    const css = (c) => `rgb(${c & 255},${(c >> 8) & 255},${(c >> 16) & 255})`;
    ctx.fillStyle = css(bg); ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = css(fg); ctx.textBaseline = 'alphabetic'; ctx.fillText(s, 0, 12.5);
    const src = new Uint32Array(ctx.getImageData(0, 0, w, h).data.buffer);
    const bgPx = 0xff000000 | (bg & 0xffffff);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const i = this.idx(x + xx, y + yy);
      const v = src[yy * w + xx];
      if (i >= 0 && (mode !== 1 || v !== bgPx)) this.px[i] = v | 0xff000000;
    }
    this.present();
  }
}

// ------------------------------------------------------------- messages --
const MSG_NAMES = {
  0x0001: 'WM_CREATE', 0x0002: 'WM_DESTROY', 0x0005: 'WM_SIZE', 0x000f: 'WM_PAINT', 0x0010: 'WM_CLOSE', 0x0012: 'WM_QUIT',
  0x004a: 'WM_COPYDATA', 0x004e: 'WM_NOTIFY', 0x0110: 'WM_INITDIALOG', 0x0111: 'WM_COMMAND', 0x0114: 'WM_HSCROLL',
  0x0117: 'WM_INITMENUPOPUP', 0x0200: 'WM_MOUSEMOVE', 0x0201: 'WM_LBUTTONDOWN', 0x0202: 'WM_LBUTTONUP',
};
const SB_NAMES = ['SB_LINELEFT', 'SB_LINERIGHT', 'SB_PAGELEFT', 'SB_PAGERIGHT', 'SB_THUMBPOSITION', 'SB_THUMBTRACK', 'SB_LEFT', 'SB_RIGHT', 'SB_ENDSCROLL'];
const WM = { MOUSEMOVE: 0x200, LBUTTONDOWN: 0x201, LBUTTONUP: 0x202, COMMAND: 0x111, HSCROLL: 0x114, CLOSE: 0x10, COPYDATA: 0x4a, INITMENUPOPUP: 0x117 };
const QUIET = new Set([0x000f, 0x004e, 0x0005]);
const hex = (h) => `0x${(h >>> 0).toString(16).padStart(5, '0')}`;
const lo = (v) => v & 0xffff, hi = (v) => (v >>> 16) & 0xffff;
const sx16 = (v) => (v << 16) >> 16;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Dialogs shrink to fit narrow screens.
addEventListener('resize', () => { for (const e of registry.hwnds.values()) if (e.kind === 'dialog' && e.root && !e.root.hidden) e.proc.fitDialog(e); });

// ------------------------------------------------------------- registry --
const registry = {
  hwnds: new Map(), // hwnd -> { proc, kind, ...ui }
  next: 0x20010,
  launchers: new Map(), // 'object2.exe' -> Process
  clipboard: null, // Uint8Array, CF_TEXT
  clipListeners: new Set(),
  alloc(entry) { const h = this.next; this.next += 4; this.hwnds.set(h, entry); return h; },
};
export const clipboard = {
  text: () => (registry.clipboard ? decodeCp1251(registry.clipboard) : ''),
  listen: (f) => registry.clipListeners.add(f),
};

// -------------------------------------------------------------- process --
/**
 * cfg: { exe, module (URL of the .mjs), rc: [urls], defs: [urls], icon, bitmaps: { id: url },
 *        client: [w, h] for CW_USEDEFAULT windows, max: [w, h], unicode, slot (element),
 *        log (line, proc), files: { path: Uint8Array },
 *        idle (text for the "not running" card), onState (proc) }
 */
export class Process {
  constructor(cfg) {
    this.cfg = cfg;
    this.exe = cfg.exe;
    this.state = 'stopped';
    this.files = { ...(cfg.files || {}) };
    this.frames = new Map();
    this.dialogs = new Map();
    this.outputs = [];
    registry.launchers.set(cfg.exe.toLowerCase(), this);
    this.idleCard();
  }

  async prepare() {
    this.res ??= await loadResources(this.cfg.rc, this.cfg.defs);
    this.factory ??= (await import(this.cfg.module)).default;
    this.mod = null;
    const mod = await this.factory({
      host: this,
      locateFile: (f) => new URL(f, new URL(this.cfg.module, location.href)).href,
      print: (s) => console.log(`[${this.exe}] ${s}`),
      printErr: (s) => console.warn(`[${this.exe}] ${s}`),
      onAbort: (what) => this.crashed(what),
    });
    for (const [path, bytes] of Object.entries(this.files)) mod.FS?.writeFile(path, bytes);
    this.mod = mod;
    return this;
  }

  /** Runs the lab's wWinMain until it first waits in GetMessage (as WinExec does). */
  start() {
    if (this.state === 'running' || !this.mod) return false;
    this.queue = []; this.waiter = null; this.cursorXY = [0, 0]; this.modal = 0; this.crashMsg = '';
    this.state = 'running';
    this.slotClear();
    this.log(`${this.exe} started`);
    const mod = this.mod;
    let ret;
    try { ret = mod.ccall('w32_main', 'number', [], [], { async: true }); } catch (e) { this.crashed(e); return true; }
    Promise.resolve(ret).then((code) => { if (this.mod === mod) this.exited(code); }, (e) => { if (this.mod === mod) this.crashed(e); });
    this.cfg.onState?.(this);
    return true;
  }

  async restart() {
    this.kill();
    await this.prepare();
    this.start();
  }

  kill() {
    for (const [h, e] of registry.hwnds) if (e.proc === this) { e.root?.remove(); registry.hwnds.delete(h); }
    this.frames.clear();
    this.dialogs.clear();
    this.mod = null;
    this.queue = []; this.waiter = null;
    this.state = 'stopped';
  }

  exited(code) {
    this.log(`${this.exe} exited with code ${code}`);
    this.kill();
    this.state = 'exited';
    this.idleCard();
    this.cfg.onState?.(this);
    this.prepare().catch((e) => console.error(e));
  }

  crashed(err) {
    if (this.state !== 'running') return;
    const why = this.crashMsg || String(err?.message || err).replace(/^RuntimeError: /, '');
    this.log(`${this.exe} crashed: ${why}`);
    this.kill();
    this.state = 'crashed';
    this.lastCrash = why;
    this.idleCard();
    this.cfg.onState?.(this);
    this.prepare().catch((e) => console.error(e));
  }

  // ---- slot UI (the place the process's windows appear)
  slotClear() { this.cfg.slot.querySelector('.w32-idle')?.remove(); }
  idleCard() {
    const slot = this.cfg.slot;
    slot.querySelector('.w32-idle')?.remove();
    const msg = this.state === 'crashed' ? `<b class="bad">${esc(this.exe)} crashed.</b> ${esc(this.lastCrash || '')}`
      : this.state === 'exited' ? `<b>${esc(this.exe)} has exited.</b>` : `<b>${esc(this.exe)}</b> is not running. ${this.cfg.idle || ''}`;
    const card = el('div', 'w32-idle', `<span>${msg}</span><button type="button" class="mini">${this.state === 'stopped' ? 'Start' : 'Start again'}</button>`);
    card.querySelector('button').onclick = async () => { await (this.mod ? null : this.prepare()); this.start(); };
    slot.prepend(card);
  }

  // ---- memory helpers
  astr(p, n = -1) {
    if (!p) return '';
    const u8 = this.mod.HEAPU8;
    let e = p;
    while ((n < 0 || e - p < n) && u8[e]) e++;
    return decodeCp1251(u8.subarray(p, e));
  }
  wstr(p, n = -1) {
    if (!p) return '';
    const u8 = this.mod.HEAPU8, units = [];
    for (let k = 0; n < 0 ? k < 4096 : k < n; k++) { const u = u8[p + 2 * k] | (u8[p + 2 * k + 1] << 8); if (n < 0 && !u) break; units.push(u); }
    return String.fromCharCode(...units);
  }
  writeStr(buf, max, s, wide) {
    if (max <= 0) return 0;
    if (wide) { const n = Math.min(s.length, max - 1); for (let k = 0; k < n; k++) this.mod.HEAPU16[(buf >> 1) + k] = s.charCodeAt(k); this.mod.HEAPU16[(buf >> 1) + n] = 0; return n; }
    const b = encodeCp1251(s).subarray(0, max - 1);
    this.mod.HEAPU8.set(b, buf); this.mod.HEAPU8[buf + b.length] = 0;
    return b.length;
  }
  // Resource text to HTML: "&x" underlines the mnemonic, "&&" is a literal ampersand
  label(s) { return esc(s).replace(/&amp;(&amp;|.)/g, (m, c) => (c === '&amp;' ? '&amp;' : `<u>${c}</u>`)); }

  // ---- log
  log(line, opts = {}) { this.cfg.log?.(line, this, opts); }
  trace(kind, h, m, wp, lp) {
    if (QUIET.has(m)) return;
    const e = registry.hwnds.get(h);
    const who = e ? `${e.kind === 'dialog' ? 'dialog' : 'window'} "${e.titleText ?? ''}"` : hex(h);
    let detail = '';
    const name = MSG_NAMES[m] || `0x${m.toString(16)}`;
    if (m === WM.COMMAND) { const id = lo(wp); detail = this.idName(id) ?? String(id); if (lp && hi(wp) === 0 && !this.idName(id)) detail = `${id}, lParam ${lp}`; }
    else if (m === WM.LBUTTONDOWN || m === WM.LBUTTONUP || m === WM.MOUSEMOVE) detail = `(${sx16(lo(lp))}, ${sx16(hi(lp))})`;
    else if (m === WM.HSCROLL) detail = `${SB_NAMES[lo(wp)] || lo(wp)}${lo(wp) === 4 || lo(wp) === 5 ? ` ${hi(wp)}` : ''}`;
    else if (m === WM.COPYDATA) { const cds = lp >> 2, u32 = this.mod.HEAPU32, i32 = this.mod.HEAP32; const n = u32[cds + 1], p = u32[cds + 2]; detail = `${n} bytes: [${Array.from(i32.subarray(p >> 2, (p >> 2) + n / 4)).join(', ')}]`; }
    this.log(`${kind ? 'sent  ' : 'posted'} ${name}${detail ? ` ${detail}` : ''} → ${who}`, { coalesce: m === WM.MOUSEMOVE });
  }
  idName(id) {
    if (id === 1 || id === 2) return id === 1 ? 'IDOK' : 'IDCANCEL';
    const defs = this.res?.defs || {};
    let name; // the last #define wins, as with ID_PICK_SAHPE over ID_RM_SHAPE2
    for (const [k, v] of Object.entries(defs)) if (v === id && /^(IDM_|ID_|IDC_|IDYES|IDNEXT|IDGOBACK)/.test(k)) name = k;
    return name;
  }
  crash(msg) { this.crashMsg = msg; }

  // ---- message queue
  enqueue(ev) {
    const last = this.queue[this.queue.length - 1];
    if (ev[1] === WM.MOUSEMOVE && last && last[1] === WM.MOUSEMOVE && last[0] === ev[0]) this.queue[this.queue.length - 1] = ev;
    else this.queue.push(ev);
    if (this.waiter) { const w = this.waiter; this.waiter = null; w(); }
  }
  take(out) { const ev = this.queue.shift(); this.mod.HEAP32.set(ev.map((v) => v | 0), out >> 2); return 1; }
  peek(out) { return this.queue.length ? this.take(out) : 0; }
  wait(out) {
    const mod = this.mod;
    return new Promise((resolve) => {
      const go = () => { if (this.mod === mod) resolve(this.take(out)); };
      if (this.queue.length) go(); else this.waiter = go;
    });
  }
  post(h, m, wp, lp) {
    if (!h) { this.enqueue([0, m, wp, lp]); return 1; }
    const e = registry.hwnds.get(h);
    if (!e || e.proc.state !== 'running') return 0;
    if (e.proc !== this) this.log(`PostMessage ${MSG_NAMES[m] || m} → ${e.proc.exe}`);
    e.proc.enqueue([h, m, wp, lp]);
    return 1;
  }
  // SendMessage to a window this module doesn't own: a control on the page, or another process.
  send(h, m, wp, lp, wide) {
    const e = registry.hwnds.get(h);
    if (!e) return 0;
    if (e.kind === 'control') return this.controlMsg(e, m, wp, lp, wide);
    if (e.proc === this || e.proc.state !== 'running') return 0;
    if (m === WM.COPYDATA) {
      const src = this.mod, cds = lp >> 2;
      const dwData = src.HEAPU32[cds], cb = src.HEAPU32[cds + 1], p = src.HEAPU32[cds + 2];
      this.log(`SendMessage WM_COPYDATA (${cb} bytes) → ${e.proc.exe}`);
      return e.proc.deliver(h, m, wp, lp, (dst) => {
        const buf = dst._malloc(cb + 12), data = buf + 12;
        dst.HEAPU8.set(src.HEAPU8.subarray(p, p + cb), data);
        dst.HEAPU32.set([dwData, cb, data], buf >> 2);
        return buf;
      });
    }
    return e.proc.deliver(h, m, wp, lp);
  }
  /** A sent message: runs the window procedure now, while this module waits in GetMessage. */
  deliver(h, m, wp, lp, marshal) {
    const mod = this.mod;
    if (!mod || this.state !== 'running') return 0;
    let buf = 0;
    try {
      if (marshal) { buf = marshal(mod); lp = buf; }
      return mod._w32_send(h, m, wp, lp);
    } catch (e) {
      this.crashed(e);
      return 0;
    } finally {
      if (buf && this.mod === mod) mod._free(buf);
    }
  }
  cursor(out) { this.mod.HEAP32.set(this.cursorXY, out >> 2); }
  input(h, m, x, y) {
    if (this.state !== 'running' || this.modal) return;
    this.cursorXY = [x, y];
    this.enqueue([h, m, m === WM.MOUSEMOVE ? 0 : m === WM.LBUTTONDOWN ? 1 : 0, ((y & 0xffff) << 16) | (x & 0xffff)]);
  }

  // ---- windows
  newHwnd(kind) { return registry.alloc({ proc: this, kind: kind === 2 ? 'dialog' : kind === 3 ? 'toolbar' : 'frame' }); }
  clientRect(h, out) {
    const e = registry.hwnds.get(h);
    const r = e?.client ? [e.x || 0, e.y || 0, e.client[0], e.client[1]] : e?.kind === 'toolbar' ? [0, 0, 0, 30] : [0, 0, 0, 0];
    this.mod.HEAP32.set(r, out >> 2);
  }
  frameCreate(h, cls, title, menuId, x, y, w, hh) {
    const e = registry.hwnds.get(h);
    const DEF = -2147483648;
    const [mw, mh] = this.cfg.max || [960, 600];
    const client = w === DEF ? [...this.cfg.client] : [Math.min(mw, Math.max(120, w - 16)), Math.min(mh, Math.max(80, hh - 59))];
    Object.assign(e, { cls: cls.toUpperCase(), client, x: x === DEF ? 0 : x, y: y === DEF ? 0 : y });
    const root = el('div', 'w32-win w32-frame');
    root.hidden = true;
    root.dataset.exe = this.exe;
    root.innerHTML = `<div class="w32-title"><img src="${this.cfg.icon}" alt="" width="16" height="16"><span class="t"></span><button type="button" class="w32-x" aria-label="Close window" title="Close (WM_CLOSE)">✕</button></div>
      <div class="w32-menubar" role="menubar"></div><div class="w32-toolbar" hidden></div>
      <div class="w32-client"><canvas aria-label="${esc(this.exe)} client area"></canvas></div>`;
    e.root = root;
    e.titleEl = root.querySelector('.t');
    this.setTitle(h, title);
    root.querySelector('.w32-x').onclick = () => { if (!this.modal) this.enqueue([h, WM.CLOSE, 0, 0]); };
    const canvas = root.querySelector('canvas');
    canvas.style.aspectRatio = `${client[0]} / ${client[1]}`;
    root.style.width = `min(100%, ${client[0] + 2}px)`;
    e.gdi = new Gdi(canvas, client[0], client[1]);
    e.canvas = canvas;
    const pos = (ev) => {
      const r = canvas.getBoundingClientRect();
      return [Math.floor(((ev.clientX - r.left) * client[0]) / r.width), Math.floor(((ev.clientY - r.top) * client[1]) / r.height)];
    };
    canvas.addEventListener('pointerdown', (ev) => { if (ev.button !== 0) return; ev.preventDefault(); this.input(h, WM.LBUTTONDOWN, ...pos(ev)); });
    canvas.addEventListener('pointermove', (ev) => this.input(h, WM.MOUSEMOVE, ...pos(ev)));
    canvas.addEventListener('pointerup', (ev) => { if (ev.button === 0) this.input(h, WM.LBUTTONUP, ...pos(ev)); });
    if (menuId && this.res.menus[menuId]) this.buildMenu(h, e, this.res.menus[menuId]);
    this.frames.set(h, e);
    this.cfg.slot.appendChild(root);
  }
  setTitle(h, text) {
    const e = registry.hwnds.get(h);
    if (!e?.titleEl) return;
    e.titleText = text;
    e.titleEl.innerHTML = this.label(text);
  }
  show(h) {
    const e = registry.hwnds.get(h);
    if (!e?.root) return;
    e.root.hidden = false;
    if (e.kind === 'dialog') this.fitDialog(e);
  }
  destroy(h) {
    const e = registry.hwnds.get(h);
    if (!e) return;
    if (e.kind === 'dialog') {
      e.controls?.forEach((c) => registry.hwnds.delete(c.h));
      if (e.modal) { this.modal--; e.owner?.root?.classList.remove('w32-has-modal'); if (e.owner?.root) e.owner.root.style.minHeight = ''; }
    }
    e.root?.remove();
    registry.hwnds.delete(h);
    this.frames.delete(h);
    this.dialogs.delete(h);
  }
  erase(h) { registry.hwnds.get(h)?.gdi?.fill(0xffffff); }
  gdi(h, op, args) { registry.hwnds.get(h)?.gdi?.[op](...args); }
  text(h, x, y, s, fg, bg, mode) {
    const e = registry.hwnds.get(h);
    if (!e?.gdi) return;
    e.gdi.text(x, y, s, fg, bg, mode);
    this.outputs.push({ h, x, y, s: s.replace(/\0/g, '') });
    if (this.outputs.length > 200) this.outputs.shift();
    this.cfg.onText?.(this);
  }
  loadString(id, buf, max) { return this.writeStr(buf, max, this.res.strings[id] ?? '', true); }

  // ---- menus: HMENU handles index the parsed MENU resource
  buildMenu(h, e, items) {
    const bar = e.root.querySelector('.w32-menubar');
    e.menus = new Map();
    let nextMenu = 1;
    const reg = (list) => { const m = (h << 4) + nextMenu++; e.menus.set(m, list); list.forEach((it) => it.popup && (it.hmenu = reg(it.items))); return m; };
    e.hmenu = reg(items);
    const close = () => { bar.querySelectorAll('.w32-drop').forEach((d) => d.remove()); bar.querySelectorAll('[aria-expanded]').forEach((b) => b.setAttribute('aria-expanded', 'false')); };
    items.forEach((it, idx) => {
      if (it.separator) return;
      const b = el('button', 'w32-mi');
      b.type = 'button';
      b.innerHTML = this.label(it.text);
      bar.appendChild(b);
      if (!it.popup) { b.onclick = () => { close(); this.post(h, WM.COMMAND, it.id, 0); }; return; }
      b.setAttribute('aria-haspopup', 'menu'); b.setAttribute('aria-expanded', 'false');
      b.onclick = (ev) => {
        ev.stopPropagation();
        const open = b.getAttribute('aria-expanded') === 'true';
        close();
        if (open || this.state !== 'running' || this.modal) return;
        this.deliver(h, WM.INITMENUPOPUP, it.hmenu, idx); // the lab updates its check marks here
        const drop = el('div', 'w32-drop');
        drop.setAttribute('role', 'menu');
        for (const sub of it.items) {
          if (sub.separator) { drop.appendChild(el('hr')); continue; }
          const s = el('button', 'w32-mi');
          s.type = 'button'; s.setAttribute('role', 'menuitemcheckbox'); s.setAttribute('aria-checked', !!sub.checked);
          s.innerHTML = `<span class="ck">${sub.checked ? '✓' : ''}</span>${this.label(sub.text)}`;
          s.onclick = () => { close(); this.post(h, WM.COMMAND, sub.id, 0); };
          drop.appendChild(s);
        }
        drop.style.left = `${b.offsetLeft}px`;
        bar.appendChild(drop);
        b.setAttribute('aria-expanded', 'true');
        const off = (x) => { if (!drop.contains(x.target)) { close(); document.removeEventListener('pointerdown', off, true); } };
        document.addEventListener('pointerdown', off, true);
      };
    });
  }
  menuGet(h) { return registry.hwnds.get(h)?.hmenu || 0; }
  menuOwner(m) { for (const f of this.frames.values()) if (f.menus?.has(m)) return f; return null; }
  menuSub(m, i) { const f = this.menuOwner(m); const it = f?.menus.get(m)[i]; return it?.popup ? it.hmenu : 0; }
  menuCheck(m, id, flags) {
    const f = this.menuOwner(m);
    const find = (list) => { for (const it of list) { if (it.popup) { const r = find(it.items); if (r) return r; } else if (it.id === id) return it; } return null; };
    const it = f && find(f.menus.get(m));
    if (!it) return -1;
    const prev = it.checked ? 8 : 0;
    it.checked = !!(flags & 8);
    return prev;
  }

  // ---- toolbar
  tbCreate(tb, parent, bmp, dx, dy) {
    const f = registry.hwnds.get(parent), e = registry.hwnds.get(tb);
    const bar = f.root.querySelector('.w32-toolbar');
    bar.hidden = false;
    Object.assign(e, { h: tb, parent, bar, buttons: new Map(), bmp: this.cfg.bitmaps?.[bmp], dx, dy });
  }
  tbAdd(tb, img, id) {
    const e = registry.hwnds.get(tb);
    const b = el('button', 'w32-tb');
    b.type = 'button';
    b.style.setProperty('--w', `${e.dx}px`); b.style.setProperty('--h', `${e.dy}px`);
    b.innerHTML = `<i style="background-image:url('${e.bmp}');background-position:${-img * e.dx}px 0"></i>`;
    const name = this.cfg.toolNames?.[this.idName(id)] || '';
    b.setAttribute('aria-label', name || `button ${id}`);
    b.onclick = () => this.post(e.parent, WM.COMMAND, id, tb);
    let timer;
    b.addEventListener('pointerenter', () => { timer = setTimeout(() => this.tooltip(e, b, id, name), 350); });
    b.addEventListener('pointerleave', () => { clearTimeout(timer); e.bar.querySelector('.w32-tip')?.remove(); });
    e.buttons.set(id, b);
    e.bar.appendChild(b);
  }
  tbPress(tb, id, on) { const b = registry.hwnds.get(tb)?.buttons.get(id); if (!b) return 0; b.classList.toggle('pressed', !!on); b.setAttribute('aria-pressed', !!on); return 1; }
  tooltip(e, b, id, name) {
    if (this.state !== 'running') return;
    let text = '';
    try {
      const p = this.mod._w32_tooltip(e.parent, e.h, id, this.cfg.unicode ? 1 : 0);
      text = this.cfg.unicode ? this.wstr(p, -1).slice(0, 79) : this.astr(p, 80);
    } catch (err) { this.crashed(err); return; }
    e.bar.querySelector('.w32-tip')?.remove();
    const shown = [...text].length > 24 ? `${[...text].slice(0, 24).join('')}…` : text;
    const tip = el('div', 'w32-tip', `<b>${esc(shown) || '<i>(empty)</i>'}</b>${name ? `<small>${esc(name)}</small>` : ''}`);
    tip.style.left = `${b.offsetLeft}px`;
    e.bar.appendChild(tip);
  }

  // ---- dialogs (from the DIALOG resources)
  dlgCreate(tmpl, parent, modal) {
    const t = this.res.dialogs[tmpl];
    if (!t) return 0;
    const h = registry.alloc({ proc: this, kind: 'dialog' });
    const e = registry.hwnds.get(h);
    const owner = registry.hwnds.get(parent) || [...this.frames.values()].find((f) => f.kind === 'frame');
    const X = (v) => v * 1.5, Y = (v) => v * 1.625;
    const root = el('div', `w32-win w32-dialog${modal ? ' modal' : ''}`);
    root.hidden = true;
    root.innerHTML = `<div class="w32-title"><span class="t"></span><button type="button" class="w32-x" aria-label="Close dialog" title="Close (WM_CLOSE)">✕</button></div><div class="w32-body"></div>`;
    const body = root.querySelector('.w32-body');
    body.style.width = `${X(t.w)}px`; body.style.height = `${Y(t.h)}px`;
    Object.assign(e, { h, root, titleEl: root.querySelector('.t'), modal: !!modal, owner, controls: [], base: [X(t.w), Y(t.h)] });
    this.dialogs.set(h, e);
    this.setTitle(h, t.caption);
    root.querySelector('.w32-x').onclick = () => this.enqueue([h, WM.CLOSE, 0, 0]);
    t.controls.forEach((c, z) => {
      const ch = registry.alloc({ proc: this, kind: 'control', type: c.type, id: c.id, dlg: h });
      const ce = registry.hwnds.get(ch);
      ce.h = ch;
      e.controls.push(ce);
      let node;
      const lab = c.text ? this.label(c.text) : '';
      if (/PUSHBUTTON$/.test(c.type)) {
        node = el('button', `w32-btn${c.type === 'DEFPUSHBUTTON' ? ' def' : ''}`, lab);
        node.type = 'button';
        node.onclick = () => this.enqueue([h, WM.COMMAND, c.id & 0xffff, ch]);
      } else if (c.type === 'EDITTEXT') {
        node = el('input', 'w32-edit');
        node.type = 'text'; node.spellcheck = false; node.autocomplete = 'off';
        node.setAttribute('aria-label', `edit ${this.idName(c.id) || c.id}`);
      } else if (c.type === 'LISTBOX') {
        node = el('div', 'w32-list');
        node.setAttribute('role', 'listbox'); node.tabIndex = 0;
        Object.assign(ce, { items: [], sel: -1, fails: 0 });
      } else if (c.type === 'SCROLLBAR') {
        node = this.scrollbar(h, ch, ce);
      } else if (c.type === 'ICON') {
        node = el('img', 'w32-icon'); node.src = this.cfg.icon; node.alt = '';
      } else {
        node = el('span', 'w32-label', lab);
      }
      Object.assign(node.style, { left: `${X(c.x)}px`, top: `${Y(c.y)}px`, width: `${X(c.w)}px`, height: `${Y(c.h)}px`, zIndex: String(100 - z) });
      node.classList.add('w32-ctl');
      ce.node = node;
      body.appendChild(node);
    });
    if (modal) {
      this.modal++;
      const host = owner?.root;
      if (host) { host.classList.add('w32-has-modal'); host.appendChild(root); } else this.cfg.slot.appendChild(root);
    } else this.cfg.slot.appendChild(root);
    return h;
  }
  // Shrink a dialog to the desktop's width; a modal one that is wider than its owner
  // starts at the owner's left edge and overlaps the windows next to it.
  fitDialog(e) {
    const desk = this.cfg.slot.closest('.desktop') || this.cfg.slot;
    const left = e.modal && e.owner?.root ? e.owner.root.getBoundingClientRect().left - desk.getBoundingClientRect().left : 0;
    const avail = desk.clientWidth - left;
    const z = Math.max(0.5, Math.min(1, (avail - 4) / (e.base[0] + 2)));
    e.root.style.zoom = z < 1 ? String(z) : '';
    if (!e.modal || !e.owner?.root) return;
    const wide = (e.base[0] + 2) * z > e.owner.root.clientWidth - 16;
    e.root.classList.toggle('overhang', wide);
    e.owner.root.style.minHeight = `${Math.ceil((e.base[1] + 34) * z) + 56}px`;
  }
  dlgItem(dlg, id) { const e = registry.hwnds.get(dlg); return e?.controls?.find((c) => c.id === id)?.h || 0; }
  dlgText(dlg, id, buf, max, wide) {
    const c = registry.hwnds.get(this.dlgItem(dlg, id));
    const v = c?.node?.value ?? c?.node?.textContent ?? '';
    return this.writeStr(buf, max, v, wide);
  }
  controlMsg(c, m, wp, lp, wide) {
    if (c.type !== 'LISTBOX') return 0;
    const draw = () => {
      c.node.innerHTML = c.items.map((s, i) => `<div role="option" aria-selected="${i === c.sel}" data-i="${i}">${esc(s) || '&nbsp;'}</div>`).join('');
      c.node.querySelectorAll('[data-i]').forEach((o) => (o.onclick = () => { c.sel = +o.dataset.i; draw(); }));
      this.cfg.onList?.(this, c.items);
    };
    switch (m) {
      case 0x180: c.items.push(wide ? this.wstr(lp) : this.astr(lp)); draw(); return c.items.length - 1; // LB_ADDSTRING
      case 0x182: // LB_DELETESTRING
        if (wp < 0 || wp >= c.items.length) { if (++c.fails > 5000) throw new Error('the list box loop never ends (LB_DELETESTRING keeps failing)'); return -1; }
        c.fails = 0; c.items.splice(wp, 1);
        if (c.sel >= c.items.length) c.sel = -1;
        draw(); return c.items.length;
      case 0x188: return c.sel; // LB_GETCURSEL
      case 0x18b: return c.items.length; // LB_GETCOUNT
      default: return 0;
    }
  }
  scrollbar(dlg, ch, ce) {
    Object.assign(ce, { min: 0, max: 100, pos: 0 });
    const node = el('div', 'w32-scroll');
    node.setAttribute('role', 'scrollbar'); node.setAttribute('aria-orientation', 'horizontal'); node.tabIndex = 0;
    node.innerHTML = '<button type="button" class="arr" aria-label="Scroll left">◀</button><div class="track"><div class="thumb"></div></div><button type="button" class="arr" aria-label="Scroll right">▶</button>';
    const [left, right] = node.querySelectorAll('.arr'), track = node.querySelector('.track'), thumb = node.querySelector('.thumb');
    const send = (code, pos = 0) => this.enqueue([dlg, WM.HSCROLL, ((pos & 0xffff) << 16) | code, ch]);
    const line = (code) => { send(code); send(8); };
    left.onclick = () => line(0); right.onclick = () => line(1);
    node.addEventListener('keydown', (ev) => { if (ev.key === 'ArrowLeft') line(0); if (ev.key === 'ArrowRight') line(1); });
    const at = (ev) => { const r = track.getBoundingClientRect(), tw = thumb.offsetWidth; const f = Math.min(1, Math.max(0, (ev.clientX - r.left - tw / 2) / Math.max(1, r.width - tw))); return Math.round(ce.min + f * (ce.max - ce.min)); };
    track.addEventListener('pointerdown', (ev) => {
      if (ev.target === thumb) {
        ev.preventDefault();
        thumb.setPointerCapture(ev.pointerId);
        let p = ce.pos;
        const move = (e2) => { p = at(e2); ce.drawPos(p); send(5, p); };
        const up = () => { thumb.removeEventListener('pointermove', move); thumb.removeEventListener('pointerup', up); send(4, p); send(8); ce.drawPos(ce.pos); };
        thumb.addEventListener('pointermove', move); thumb.addEventListener('pointerup', up);
      } else {
        const r = thumb.getBoundingClientRect();
        line(ev.clientX < r.left ? 2 : 3);
      }
    });
    ce.drawPos = (p) => {
      const f = ce.max > ce.min ? (p - ce.min) / (ce.max - ce.min) : 0;
      thumb.style.left = `calc((100% - 18px) * ${f})`;
      node.setAttribute('aria-valuemin', ce.min); node.setAttribute('aria-valuemax', ce.max); node.setAttribute('aria-valuenow', p);
    };
    ce.drawPos(0);
    return node;
  }
  // SB_CTL scroll bars: 0 SetScrollRange, 1 GetScrollPos, 2 SetScrollPos (clamped, returns the old position)
  scroll(h, op, a, b) {
    const c = registry.hwnds.get(h);
    if (!c || c.type !== 'SCROLLBAR') return 0;
    const clamp = (v) => Math.min(c.max, Math.max(c.min, v));
    if (op === 0) { c.min = a; c.max = b; c.pos = clamp(c.pos); c.drawPos(c.pos); return 1; }
    if (op === 1) return c.pos;
    const old = c.pos; c.pos = clamp(a); c.drawPos(c.pos); return old;
  }

  // ---- other processes
  findWindow(cls) {
    const want = cls.toUpperCase();
    for (const [h, e] of registry.hwnds) if (e.kind === 'frame' && e.cls === want && e.proc.state === 'running') return h;
    return 0;
  }
  winExec(cmd) {
    const p = registry.launchers.get(cmd.trim().split(/[\\/]/).pop().toLowerCase());
    if (!p || !p.mod) { this.log(`WinExec("${cmd}") failed: file not found`); return 2; }
    this.log(`WinExec("${cmd}")`);
    p.start();
    return 33;
  }
  // clipboard ops: 0 empty, 1 set CF_TEXT, 2 has text, 3 length, 4 copy out, 5 open, 6 close
  clip(op, p) {
    switch (op) {
      case 0: registry.clipboard = null; return 1;
      case 1: {
        const u8 = this.mod.HEAPU8; let e = p; while (u8[e]) e++;
        registry.clipboard = u8.slice(p, e);
        this.log(`SetClipboardData(CF_TEXT, ${e - p} bytes)`);
        registry.clipListeners.forEach((f) => f());
        return 1;
      }
      case 2: return registry.clipboard ? 1 : 0;
      case 3: return registry.clipboard?.length || 0;
      case 4: this.mod.HEAPU8.set(registry.clipboard, p); this.mod.HEAPU8[p + registry.clipboard.length] = 0; this.log(`GetClipboardData(CF_TEXT) read ${registry.clipboard.length} bytes`); return 1;
      default: return 1;
    }
  }
}
