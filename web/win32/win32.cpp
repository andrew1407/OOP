// Win32 shim implementation for the OOP labs (see windows.h).
// Windows, message queues, modal dialog loops and the GDI device-context state live here, as
// they do in user32/gdi32. Pixels, controls, menus, the clipboard and other processes live in
// the page: each host_* call below forwards to the process's host object in host.js.
// GetMessage waits for the page with Asyncify, so the lab's own wWinMain and message loop run.
#include <emscripten.h>
#include <map>
#include <string>
#include <vector>
#include <stdio.h>
#include <stdlib.h>
#include "windows.h"
#include "commctrl.h"

// ------------------------------------------------------------------ host --
EM_JS(int, host_new_hwnd, (int kind), { return Module.host.newHwnd(kind); });
EM_JS(void, host_frame_create, (int h, const char* cls, const WCHAR* title, int menu, int x, int y, int w, int hh),
      { Module.host.frameCreate(h, UTF8ToString(cls), Module.host.wstr(title), menu, x, y, w, hh); });
EM_JS(void, host_set_title, (int h, const void* p, int wide), { Module.host.setTitle(h, wide ? Module.host.wstr(p) : Module.host.astr(p)); });
EM_JS(void, host_show, (int h), { Module.host.show(h); });
EM_JS(void, host_destroy, (int h), { Module.host.destroy(h); });
EM_JS(void, host_erase, (int h), { Module.host.erase(h); });
EM_JS(int, host_peek, (int* out), { return Module.host.peek(out); });
EM_ASYNC_JS(int, host_wait, (int* out), { return await Module.host.wait(out); });
EM_JS(int, host_post, (int h, int m, int wp, int lp), { return Module.host.post(h, m, wp, lp); });
EM_JS(int, host_send, (int h, int m, int wp, int lp, int wide), { return Module.host.send(h, m, wp, lp, wide); });
EM_JS(void, host_cursor, (int* out), { Module.host.cursor(out); });
EM_JS(void, host_client_rect, (int h, int* out), { Module.host.clientRect(h, out); });
EM_JS(int, host_load_string, (int id, WCHAR* buf, int max), { return Module.host.loadString(id, buf, max); });
EM_JS(int, host_dlg_create, (int tmpl, int parent, int modal), { return Module.host.dlgCreate(tmpl, parent, modal); });
EM_JS(int, host_dlg_item, (int dlg, int id), { return Module.host.dlgItem(dlg, id); });
EM_JS(int, host_dlg_text, (int dlg, int id, void* buf, int max, int wide), { return Module.host.dlgText(dlg, id, buf, max, wide); });
EM_JS(int, host_scroll, (int h, int op, int a, int b), { return Module.host.scroll(h, op, a, b); });
EM_JS(int, host_menu_get, (int h), { return Module.host.menuGet(h); });
EM_JS(int, host_menu_sub, (int m, int i), { return Module.host.menuSub(m, i); });
EM_JS(int, host_menu_check, (int m, int id, int flags), { return Module.host.menuCheck(m, id, flags); });
EM_JS(void, host_tb_create, (int tb, int parent, int bmp, int dx, int dy), { Module.host.tbCreate(tb, parent, bmp, dx, dy); });
EM_JS(void, host_tb_add, (int tb, int img, int id, int state, int style), { Module.host.tbAdd(tb, img, id, state, style); });
EM_JS(int, host_tb_press, (int tb, int id, int on), { return Module.host.tbPress(tb, id, on); });
EM_JS(void, host_line, (int h, int x0, int y0, int x1, int y1, int ps, int pw, int pc, int rop),
      { Module.host.gdi(h, 'line', [x0, y0, x1, y1, ps, pw, pc, rop]); });
EM_JS(void, host_shape, (int h, int ellipse, int l, int t, int r, int b, int ps, int pw, int pc, int bs, int bc, int rop),
      { Module.host.gdi(h, ellipse ? 'ellipse' : 'rect', [l, t, r, b, ps, pw, pc, bs, bc, rop]); });
EM_JS(void, host_pixel, (int h, int x, int y, int c), { Module.host.gdi(h, 'pixel', [x, y, c]); });
EM_JS(void, host_text, (int h, int x, int y, const void* p, int n, int wide, int fg, int bg, int mode),
      { Module.host.text(h, x, y, wide ? Module.host.wstr(p, n) : Module.host.astr(p, n), fg, bg, mode); });
EM_JS(int, host_find_window, (const void* p, int wide), { return Module.host.findWindow(wide ? Module.host.wstr(p) : Module.host.astr(p)); });
EM_JS(int, host_winexec, (const char* p), { return Module.host.winExec(Module.host.astr(p)); });
EM_JS(int, host_clip, (int op, void* p), { return Module.host.clip(op, p); });
EM_JS(void, host_trace, (int kind, int h, int m, int wp, int lp), { Module.host.trace(kind, h, m, wp, lp); });
EM_JS(void, host_crash, (const char* p), { Module.host.crash(UTF8ToString(p)); });

// ------------------------------------------------------------------ state --
namespace {

enum Kind { K_FRAME = 1, K_DIALOG = 2, K_TOOLBAR = 3 };

struct Cls { WNDPROC proc; int menu; };
struct Win {
  int kind = 0;
  WNDPROC proc = nullptr;
  DLGPROC dlgproc = nullptr;
  bool invalid = false, erase = false, destroying = false, ended = false;
  INT_PTR result = 0;
  int w = 0, h = 0;
};

std::map<std::string, Cls> classes;
std::map<int, Win> wins;
bool quit = false;
int quitCode = 0;

int H(HWND h) { return (int)(intptr_t)h; }
HWND W(int h) { return (HWND)(intptr_t)h; }
Win* find(HWND h) { auto it = wins.find(H(h)); return it == wins.end() ? nullptr : &it->second; }

std::string narrowW(LPCWSTR s) {
  std::string out;
  if (!s) return out;
  if ((uintptr_t)s < 0x10000) return "#" + std::to_string((int)(uintptr_t)s);
  for (; *s; ++s) out += (char)(*s < 128 ? *s : '?');
  return out;
}
std::string upper(std::string s) { for (auto& c : s) if (c >= 'a' && c <= 'z') c -= 32; return s; }
int resId(const void* p) { return (uintptr_t)p < 0x10000 ? (int)(uintptr_t)p : 0; }

// ---- GDI objects and device contexts
struct Obj { int type; int style; int width; COLORREF color; };  // type 1 pen, 2 brush
struct DC { int hwnd; int pen = 1, brush = 2; int rop = R2_COPYPEN; int x = 0, y = 0; bool clipAll = false;
            COLORREF fg = 0, bg = 0xFFFFFF; int bkMode = OPAQUE; };
std::map<int, Obj> objs = { { 1, { 1, PS_SOLID, 1, 0 } }, { 2, { 2, 0, 0, 0xFFFFFF } } };
std::map<int, DC> dcs;
int nextObj = 0x100, nextDc = 0x8000;

DC* dcOf(HDC h) { auto it = dcs.find(H((HWND)h)); return it == dcs.end() ? nullptr : &it->second; }
HDC newDc(int hwnd, bool clipAll) { int id = nextDc++; DC d; d.hwnd = hwnd; d.clipAll = clipAll; dcs[id] = d; return (HDC)(intptr_t)id; }
const Obj& pen(const DC* d) { auto it = objs.find(d->pen); return it == objs.end() ? objs[1] : it->second; }
const Obj& brush(const DC* d) { auto it = objs.find(d->brush); return it == objs.end() ? objs[2] : it->second; }

// Windows-1251 to UTF-16, upper half (the labs' ANSI code page)
const unsigned short CP1251[128] = {
  0x0402,0x0403,0x201A,0x0453,0x201E,0x2026,0x2020,0x2021,0x20AC,0x2030,0x0409,0x2039,0x040A,0x040C,0x040B,0x040F,
  0x0452,0x2018,0x2019,0x201C,0x201D,0x2022,0x2013,0x2014,0xFFFD,0x2122,0x0459,0x203A,0x045A,0x045C,0x045B,0x045F,
  0x00A0,0x040E,0x045E,0x0408,0x00A4,0x0490,0x00A6,0x00A7,0x0401,0x00A9,0x0404,0x00AB,0x00AC,0x00AD,0x00AE,0x0407,
  0x00B0,0x00B1,0x0406,0x0456,0x0491,0x00B5,0x00B6,0x00B7,0x0451,0x2116,0x0454,0x00BB,0x0458,0x0405,0x0455,0x0457,
};

LRESULT dispatchTo(Win* w, HWND h, UINT m, WPARAM wp, LPARAM lp);

}  // namespace

// ------------------------------------------------------------- windows --
extern "C" {

int LoadStringW(HINSTANCE, UINT id, LPWSTR buf, int max) { return host_load_string((int)id, buf, max); }

ATOM RegisterClassExW(const WNDCLASSEXW* wc) {
  classes[upper(narrowW(wc->lpszClassName))] = { wc->lpfnWndProc, resId(wc->lpszMenuName) };
  return (ATOM)classes.size();
}

HWND CreateWindowExW(DWORD, LPCWSTR cls, LPCWSTR title, DWORD, int x, int y, int w, int h, HWND, HMENU, HINSTANCE, LPVOID) {
  std::string name = upper(narrowW(cls));
  auto it = classes.find(name);
  if (it == classes.end()) return nullptr;
  int hwnd = host_new_hwnd(K_FRAME);
  Win& win = wins[hwnd];
  win.kind = K_FRAME;
  win.proc = it->second.proc;
  win.invalid = win.erase = true;
  host_frame_create(hwnd, name.c_str(), title, it->second.menu, x, y, w, h);
  int rc[4];
  host_client_rect(hwnd, rc);
  win.w = rc[2]; win.h = rc[3];
  host_trace(1, hwnd, WM_CREATE, 0, 0);
  if (win.proc(W(hwnd), WM_CREATE, 0, 0) == -1) { DestroyWindow(W(hwnd)); return nullptr; }
  return W(hwnd);
}

BOOL ShowWindow(HWND h, int) {
  Win* w = find(h);
  if (!w) return FALSE;
  host_show(H(h));
  if (w->kind == K_FRAME) SendMessageW(h, WM_SIZE, 0, MAKELPARAM(w->w, w->h));
  return TRUE;
}

BOOL UpdateWindow(HWND h) {
  Win* w = find(h);
  if (w && w->kind == K_FRAME && w->invalid) SendMessageW(h, WM_PAINT, 0, 0);
  return w != nullptr;
}

BOOL DestroyWindow(HWND h) {
  Win* w = find(h);
  if (!w || w->destroying) return FALSE;
  w->destroying = true;
  SendMessageW(h, WM_DESTROY, 0, 0);
  host_destroy(H(h));
  wins.erase(H(h));
  return TRUE;
}

HICON LoadIconW(HINSTANCE, LPCWSTR) { return (HICON)1; }
HICON LoadIconA(HINSTANCE, LPCSTR) { return (HICON)1; }
HCURSOR LoadCursorW(HINSTANCE, LPCWSTR) { return (HCURSOR)1; }
HCURSOR LoadCursorA(HINSTANCE, LPCSTR) { return (HCURSOR)1; }
HACCEL LoadAcceleratorsW(HINSTANCE, LPCWSTR) { return (HACCEL)1; }
HACCEL LoadAcceleratorsA(HINSTANCE, LPCSTR) { return (HACCEL)1; }
int TranslateAcceleratorW(HWND, HACCEL, LPMSG) { return 0; }
BOOL TranslateMessage(const MSG*) { return FALSE; }

// Posted and input messages first, then WM_PAINT for invalid windows, then wait for the page.
BOOL GetMessageW(LPMSG msg, HWND, UINT, UINT) {
  int ev[4];
  for (;;) {
    if (host_peek(ev)) break;
    if (quit) { memset(msg, 0, sizeof *msg); msg->message = WM_QUIT; msg->wParam = quitCode; return FALSE; }
    for (auto& [hw, w] : wins)
      if (w.kind == K_FRAME && w.invalid) { memset(msg, 0, sizeof *msg); msg->hwnd = W(hw); msg->message = WM_PAINT; return TRUE; }
    host_wait(ev);
    break;
  }
  memset(msg, 0, sizeof *msg);
  msg->hwnd = W(ev[0]); msg->message = (UINT)ev[1]; msg->wParam = (WPARAM)(unsigned)ev[2]; msg->lParam = ev[3];
  return TRUE;
}

LRESULT DispatchMessageW(const MSG* m) {
  Win* w = find(m->hwnd);
  if (!w) return 0;
  host_trace(0, H(m->hwnd), m->message, (int)m->wParam, (int)m->lParam);
  return dispatchTo(w, m->hwnd, m->message, m->wParam, m->lParam);
}

LRESULT DefWindowProcW(HWND h, UINT m, WPARAM, LPARAM) {
  if (m == WM_CLOSE) DestroyWindow(h);
  if (m == WM_PAINT) { PAINTSTRUCT ps; BeginPaint(h, &ps); EndPaint(h, &ps); }
  return 0;
}

void PostQuitMessage(int code) { quit = true; quitCode = code; }

LRESULT SendMessageW(HWND h, UINT m, WPARAM wp, LPARAM lp) {
  Win* w = find(h);
  if (!w) return host_send(H(h), (int)m, (int)wp, (int)lp, 1);
  if (w->kind == K_TOOLBAR) {
    switch (m) {
    case TB_ADDBUTTONSA: case TB_ADDBUTTONSW: {
      const TBBUTTON* b = (const TBBUTTON*)lp;
      for (UINT i = 0; i < (UINT)wp; i++) host_tb_add(H(h), b[i].iBitmap, b[i].idCommand, b[i].fsState, b[i].fsStyle);
      return TRUE;
    }
    case TB_PRESSBUTTON: return host_tb_press(H(h), (int)wp, LOWORD(lp));
    default: return 0;
    }
  }
  host_trace(1, H(h), (int)m, (int)wp, (int)lp);
  return dispatchTo(w, h, m, wp, lp);
}

LRESULT SendMessageA(HWND h, UINT m, WPARAM wp, LPARAM lp) {
  if (!find(h)) return host_send(H(h), (int)m, (int)wp, (int)lp, 0);
  return SendMessageW(h, m, wp, lp);
}

BOOL PostMessageW(HWND h, UINT m, WPARAM wp, LPARAM lp) { return host_post(H(h), (int)m, (int)wp, (int)lp); }
LRESULT SendDlgItemMessageW(HWND d, int id, UINT m, WPARAM wp, LPARAM lp) { HWND c = GetDlgItem(d, id); return c ? SendMessageW(c, m, wp, lp) : 0; }
LRESULT SendDlgItemMessageA(HWND d, int id, UINT m, WPARAM wp, LPARAM lp) { HWND c = GetDlgItem(d, id); return c ? SendMessageA(c, m, wp, lp) : 0; }
BOOL SetWindowTextW(HWND h, LPCWSTR s) { if (!find(h)) return FALSE; host_set_title(H(h), s, 1); return TRUE; }
BOOL SetWindowTextA(HWND h, LPCSTR s) { if (!find(h)) return FALSE; host_set_title(H(h), s, 0); return TRUE; }
HWND FindWindowA(LPCSTR cls, LPCSTR) { return W(host_find_window(cls, 0)); }
HWND FindWindowW(LPCWSTR cls, LPCWSTR) { return W(host_find_window(cls, 1)); }
UINT WinExec(LPCSTR cmd, UINT) { return (UINT)host_winexec(cmd); }

BOOL GetClientRect(HWND h, LPRECT r) {
  Win* w = find(h);
  if (!w) return FALSE;
  int rc[4];
  host_client_rect(H(h), rc);
  r->left = 0; r->top = 0; r->right = rc[2]; r->bottom = rc[3];
  return TRUE;
}
BOOL GetWindowRect(HWND h, LPRECT r) {
  int rc[4];
  host_client_rect(H(h), rc);
  r->left = rc[0]; r->top = rc[1]; r->right = rc[0] + rc[2]; r->bottom = rc[1] + rc[3];
  return TRUE;
}
BOOL MoveWindow(HWND, int, int, int, int, BOOL) { return TRUE; }  // the page lays out the toolbar

BOOL InvalidateRect(HWND h, const RECT*, BOOL erase) {
  Win* w = find(h);
  if (!w || w->kind != K_FRAME) return FALSE;
  w->invalid = true;
  if (erase) w->erase = true;
  return TRUE;
}

BOOL GetCursorPos(LPPOINT p) { int xy[2]; host_cursor(xy); p->x = xy[0]; p->y = xy[1]; return TRUE; }
BOOL ScreenToClient(HWND, LPPOINT) { return TRUE; }  // the page reports the cursor in client coordinates

// ------------------------------------------------------------- dialogs --
static HWND makeDialog(const void* tmpl, HWND parent, DLGPROC proc, LPARAM param, bool modal) {
  int h = host_dlg_create(resId(tmpl), H(parent), modal ? 1 : 0);
  if (!h) return nullptr;
  Win& w = wins[h];
  w.kind = K_DIALOG;
  w.dlgproc = proc;
  host_trace(1, h, WM_INITDIALOG, 0, (int)param);
  proc(W(h), WM_INITDIALOG, 0, param);
  return W(h);
}

// A modal loop of its own, like user32's: dispatch until EndDialog is called.
static INT_PTR modalLoop(HWND d) {
  host_show(H(d));
  MSG m;
  for (;;) {
    Win* w = find(d);
    if (!w || w->ended) break;
    if (!GetMessageW(&m, nullptr, 0, 0)) { PostQuitMessage((int)m.wParam); break; }
    DispatchMessageW(&m);
  }
  Win* w = find(d);
  INT_PTR r = w ? w->result : -1;
  if (w) { host_destroy(H(d)); wins.erase(H(d)); }
  return r;
}

INT_PTR DialogBoxParamW(HINSTANCE, LPCWSTR t, HWND p, DLGPROC f, LPARAM l) { HWND d = makeDialog(t, p, f, l, true); return d ? modalLoop(d) : -1; }
INT_PTR DialogBoxParamA(HINSTANCE, LPCSTR t, HWND p, DLGPROC f, LPARAM l) { HWND d = makeDialog(t, p, f, l, true); return d ? modalLoop(d) : -1; }
HWND CreateDialogParamW(HINSTANCE, LPCWSTR t, HWND p, DLGPROC f, LPARAM l) { return makeDialog(t, p, f, l, false); }
HWND CreateDialogParamA(HINSTANCE, LPCSTR t, HWND p, DLGPROC f, LPARAM l) { return makeDialog(t, p, f, l, false); }

BOOL EndDialog(HWND d, INT_PTR r) {
  Win* w = find(d);
  if (!w || w->kind != K_DIALOG) return FALSE;
  w->ended = true; w->result = r;
  return TRUE;
}

HWND GetDlgItem(HWND d, int id) { return find(d) ? W(host_dlg_item(H(d), id)) : nullptr; }
UINT GetDlgItemTextA(HWND d, int id, LPSTR buf, int n) { return (UINT)host_dlg_text(H(d), id, buf, n, 0); }
UINT GetDlgItemTextW(HWND d, int id, LPWSTR buf, int n) { return (UINT)host_dlg_text(H(d), id, buf, n, 1); }
BOOL SetScrollRange(HWND h, int, int lo, int hi, BOOL) { return host_scroll(H(h), 0, lo, hi); }
int GetScrollPos(HWND h, int) { return host_scroll(H(h), 1, 0, 0); }
int SetScrollPos(HWND h, int, int pos, BOOL) { return host_scroll(H(h), 2, pos, 0); }

HMENU GetMenu(HWND h) { return (HMENU)(intptr_t)host_menu_get(H(h)); }
HMENU GetSubMenu(HMENU m, int i) { return (HMENU)(intptr_t)host_menu_sub(H((HWND)m), i); }
DWORD CheckMenuItem(HMENU m, UINT id, UINT f) { return (DWORD)host_menu_check(H((HWND)m), (int)id, (int)f); }

void InitCommonControls(void) {}

HWND CreateToolbarEx(HWND parent, DWORD, UINT, int, HINSTANCE, UINT_PTR bmp, LPCTBBUTTON b, int n, int, int, int dx, int dy, UINT) {
  int h = host_new_hwnd(K_TOOLBAR);
  wins[h].kind = K_TOOLBAR;
  host_tb_create(h, H(parent), (int)bmp, dx, dy);
  for (int i = 0; i < n; i++) host_tb_add(h, b[i].iBitmap, b[i].idCommand, b[i].fsState, b[i].fsStyle);
  return W(h);
}

// ----------------------------------------------------------------- GDI --
HDC BeginPaint(HWND h, LPPAINTSTRUCT ps) {
  Win* w = find(h);
  memset(ps, 0, sizeof *ps);
  if (!w) return nullptr;
  // The paint DC is clipped to the update region: if nothing was invalid, nothing draws.
  bool was = w->invalid;
  if (was && w->erase) host_erase(H(h));
  ps->fErase = FALSE;
  ps->rcPaint = was ? RECT{ 0, 0, w->w, w->h } : RECT{ 0, 0, 0, 0 };
  w->invalid = w->erase = false;
  ps->hdc = newDc(H(h), !was);
  return ps->hdc;
}
BOOL EndPaint(HWND, const PAINTSTRUCT* ps) { dcs.erase(H((HWND)ps->hdc)); return TRUE; }
HDC GetDC(HWND h) { return find(h) ? newDc(H(h), false) : nullptr; }
int ReleaseDC(HWND, HDC d) { return dcs.erase(H((HWND)d)) ? 1 : 0; }

HPEN CreatePen(int style, int width, COLORREF c) { int id = nextObj++; objs[id] = { 1, style, width < 1 ? 1 : width, c & 0xFFFFFF }; return (HPEN)(intptr_t)id; }
HBRUSH CreateSolidBrush(COLORREF c) { int id = nextObj++; objs[id] = { 2, 0, 0, c & 0xFFFFFF }; return (HBRUSH)(intptr_t)id; }
HGDIOBJ SelectObject(HDC hdc, HGDIOBJ o) {
  DC* d = dcOf(hdc);
  auto it = objs.find((int)(intptr_t)o);
  if (!d || it == objs.end()) return nullptr;
  int& slot = it->second.type == 1 ? d->pen : d->brush;
  int old = slot;
  slot = it->first;
  return (HGDIOBJ)(intptr_t)old;
}
BOOL DeleteObject(HGDIOBJ o) { int id = (int)(intptr_t)o; return id > 2 && objs.erase(id) ? TRUE : FALSE; }
int SetROP2(HDC hdc, int rop) { DC* d = dcOf(hdc); if (!d) return 0; int old = d->rop; d->rop = rop; return old; }
BOOL MoveToEx(HDC hdc, int x, int y, LPPOINT old) {
  DC* d = dcOf(hdc);
  if (!d) return FALSE;
  if (old) { old->x = d->x; old->y = d->y; }
  d->x = x; d->y = y;
  return TRUE;
}
BOOL LineTo(HDC hdc, int x, int y) {
  DC* d = dcOf(hdc);
  if (!d) return FALSE;
  const Obj& p = pen(d);
  if (!d->clipAll) host_line(d->hwnd, d->x, d->y, x, y, p.style, p.width, (int)p.color, d->rop);
  d->x = x; d->y = y;
  return TRUE;
}
static BOOL shape(HDC hdc, bool ellipse, int l, int t, int r, int b) {
  DC* d = dcOf(hdc);
  if (!d) return FALSE;
  const Obj& p = pen(d);
  const Obj& br = brush(d);
  if (!d->clipAll) host_shape(d->hwnd, ellipse, l, t, r, b, p.style, p.width, (int)p.color, br.style, (int)br.color, d->rop);
  return TRUE;
}
BOOL Rectangle(HDC hdc, int l, int t, int r, int b) { return shape(hdc, false, l, t, r, b); }
BOOL Ellipse(HDC hdc, int l, int t, int r, int b) { return shape(hdc, true, l, t, r, b); }
COLORREF SetPixel(HDC hdc, int x, int y, COLORREF c) { DC* d = dcOf(hdc); if (d && !d->clipAll) host_pixel(d->hwnd, x, y, (int)c); return c; }
BOOL TextOutA(HDC hdc, int x, int y, LPCSTR s, int n) {
  DC* d = dcOf(hdc);
  if (!d) return FALSE;
  if (!d->clipAll) host_text(d->hwnd, x, y, s, n, 0, (int)d->fg, (int)d->bg, d->bkMode);
  return TRUE;
}
BOOL TextOutW(HDC hdc, int x, int y, LPCWSTR s, int n) {
  DC* d = dcOf(hdc);
  if (!d) return FALSE;
  if (!d->clipAll) host_text(d->hwnd, x, y, s, n, 1, (int)d->fg, (int)d->bg, d->bkMode);
  return TRUE;
}

// --------------------------------------------------------- strings, CRT --
int MultiByteToWideChar(UINT, DWORD, LPCSTR src, int cb, LPWSTR dst, int cch) {
  int n = cb < 0 ? (int)strlen(src) + 1 : cb;
  if (cch == 0) return n;
  for (int i = 0; i < n && i < cch; i++) {
    unsigned char c = (unsigned char)src[i];
    dst[i] = (WCHAR)(c < 128 ? c : CP1251[c - 128]);
  }
  return n < cch ? n : cch;
}
LPSTR lstrcpyA(LPSTR d, LPCSTR s) { return strcpy(d, s); }
LPWSTR lstrcpyW(LPWSTR d, LPCWSTR s) { LPWSTR r = d; while ((*d++ = *s++)) {} return r; }
int _itoa_s(int v, char* buf, size_t size, int radix) {
  char tmp[40];
  if (radix == 10) snprintf(tmp, sizeof tmp, "%d", v);
  else { unsigned u = (unsigned)v; int i = 38; tmp[39] = 0; do { tmp[i--] = "0123456789abcdefghijklmnopqrstuvwxyz"[u % radix]; u /= radix; } while (u && i >= 0); memmove(tmp, tmp + i + 1, 39 - i); }
  if (strlen(tmp) + 1 > size) { host_crash("_itoa_s: buffer too small (invalid parameter handler)"); abort(); }
  strcpy(buf, tmp);
  return 0;
}
int strcpy_s(char* d, size_t size, const char* s) {
  // The MSVC CRT calls its invalid parameter handler here, which ends the process.
  if (!d || !s || strlen(s) + 1 > size) { host_crash("strcpy_s: the text doesn't fit the 300-byte buffer (invalid parameter handler)"); abort(); }
  strcpy(d, s);
  return 0;
}

static unsigned int msvcSeed = 1;
int w32_msvc_rand(void) { msvcSeed = msvcSeed * 214013u + 2531011u; return (int)((msvcSeed >> 16) & 0x7fff); }
void w32_msvc_srand(unsigned int s) { msvcSeed = s; }

// ------------------------------------------------------ memory, clipboard --
HGLOBAL GlobalAlloc(UINT, size_t n) { return calloc(1, n ? n : 1); }
LPVOID GlobalLock(HGLOBAL h) { return h; }
BOOL GlobalUnlock(HGLOBAL) { return TRUE; }
HGLOBAL GlobalFree(HGLOBAL h) { free(h); return nullptr; }
BOOL OpenClipboard(HWND) { return host_clip(5, nullptr); }
BOOL EmptyClipboard(void) { return host_clip(0, nullptr); }
BOOL CloseClipboard(void) { return host_clip(6, nullptr); }
HANDLE SetClipboardData(UINT fmt, HANDLE h) { if (fmt == CF_TEXT && h) host_clip(1, h); return h; }
BOOL IsClipboardFormatAvailable(UINT fmt) { return fmt == CF_TEXT && host_clip(2, nullptr); }
HANDLE GetClipboardData(UINT fmt) {
  static char* data = nullptr;
  if (fmt != CF_TEXT || !host_clip(2, nullptr)) return nullptr;
  free(data);
  int n = host_clip(3, nullptr);
  data = (char*)calloc(1, n + 1);
  host_clip(4, data);
  return data;
}

}  // extern "C"

// ------------------------------------------------------------- dispatch --
namespace {
LRESULT dispatchTo(Win* w, HWND h, UINT m, WPARAM wp, LPARAM lp) {
  if (w->kind == K_DIALOG) {
    INT_PTR r = w->dlgproc(h, m, wp, lp);
    // DefDlgProc: the close box sends IDCANCEL to the dialog procedure
    if (!r && m == WM_CLOSE && find(h)) w->dlgproc(h, WM_COMMAND, MAKEWPARAM(IDCANCEL, BN_CLICKED), 0);
    return r;
  }
  if (w->kind == K_FRAME && w->proc) return w->proc(h, m, wp, lp);
  return 0;
}
}  // namespace

// ------------------------------------------------------------- exports --
int wWinMain(HINSTANCE, HINSTANCE, LPWSTR, int);

extern "C" {
EMSCRIPTEN_KEEPALIVE int w32_main() {
  static WCHAR cmd[1] = { 0 };
  return wWinMain((HINSTANCE)1, nullptr, cmd, SW_SHOW);
}

// A message sent from the page or another process, delivered while this one waits in GetMessage.
EMSCRIPTEN_KEEPALIVE int w32_send(int h, int m, int wp, int lp) {
  Win* w = find(W(h));
  if (!w) return 0;
  host_trace(1, h, m, wp, lp);
  return (int)dispatchTo(w, W(h), (UINT)m, (WPARAM)(unsigned)wp, lp);
}

// The toolbar asks its parent for tooltip text with WM_NOTIFY / TTN_NEEDTEXT.
EMSCRIPTEN_KEEPALIVE const void* w32_tooltip(int parent, int tb, int id, int wide) {
  // Labs 3 and 4 lstrcpy narrow strings into szText as UTF-16, which runs past its 80 units
  // until it meets a 16-bit zero. The padding keeps that overrun away from the shim's state.
  static struct { TOOLTIPTEXTA t; char pad[16384]; } as;
  static struct { TOOLTIPTEXTW t; WCHAR pad[16384]; } us;
  TOOLTIPTEXTA& a = as.t;
  TOOLTIPTEXTW& u = us.t;
  Win* w = find(W(parent));
  if (!w) return nullptr;
  if (wide) {
    memset(&u, 0, sizeof u);
    u.hdr.hwndFrom = W(tb); u.hdr.idFrom = (UINT_PTR)id; u.hdr.code = TTN_NEEDTEXTW;
    dispatchTo(w, W(parent), WM_NOTIFY, (WPARAM)id, (LPARAM)&u);
    return u.szText;
  }
  memset(&a, 0, sizeof a);
  a.hdr.hwndFrom = W(tb); a.hdr.idFrom = (UINT_PTR)id; a.hdr.code = TTN_NEEDTEXTA;
  dispatchTo(w, W(parent), WM_NOTIFY, (WPARAM)id, (LPARAM)&a);
  return a.szText;
}
}
