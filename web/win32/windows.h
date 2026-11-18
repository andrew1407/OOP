// Minimal Win32 API shim for compiling the OOP labs with emscripten.
// It declares just the types, constants and functions the labs use. win32.cpp implements
// them: windows, messages and dialogs run in C++, and drawing and controls are forwarded
// to the page through EM_JS (see host.js). Build with -DUNICODE for the Unicode labs
// (and -fshort-wchar, so WCHAR is 16-bit like on Windows).
#pragma once
#ifndef W32_SHIM_WINDOWS_H
#define W32_SHIM_WINDOWS_H

#include <stddef.h>
#include <stdint.h>
#include <string.h>

// ---------------------------------------------------------------- basics --
#define WINAPI
#define APIENTRY
#define CALLBACK
#define _In_
#define _In_opt_
#define _Out_
#define UNREFERENCED_PARAMETER(P) (void)(P)
#define FALSE 0
#define TRUE 1

typedef int BOOL;
typedef unsigned char BYTE;
typedef unsigned short WORD;
typedef unsigned int DWORD;
typedef unsigned int UINT;
typedef int INT;
typedef long LONG;
typedef unsigned long ULONG;
typedef WORD ATOM;
typedef intptr_t INT_PTR, LONG_PTR, LPARAM, LRESULT;
typedef uintptr_t UINT_PTR, ULONG_PTR, DWORD_PTR, WPARAM;
typedef DWORD COLORREF;
typedef void* PVOID;
typedef void* LPVOID;
typedef char CHAR;
typedef wchar_t WCHAR;
typedef char* LPSTR;
typedef const char* LPCSTR;
typedef WCHAR* LPWSTR;
typedef const WCHAR* LPCWSTR;
#ifdef UNICODE
typedef WCHAR TCHAR;
#define __TEXT(q) L##q
#else
typedef char TCHAR;
#define __TEXT(q) q
#endif
typedef TCHAR* LPTSTR;
typedef const TCHAR* LPCTSTR;
#define TEXT(q) __TEXT(q)

#define DECLARE_HANDLE(n) struct n##__ { int unused; }; typedef struct n##__* n
DECLARE_HANDLE(HWND);
DECLARE_HANDLE(HDC);
DECLARE_HANDLE(HINSTANCE);
DECLARE_HANDLE(HMENU);
DECLARE_HANDLE(HICON);
DECLARE_HANDLE(HACCEL);
DECLARE_HANDLE(HPEN);
DECLARE_HANDLE(HBRUSH);
typedef void* HGDIOBJ;
typedef HICON HCURSOR;
typedef void* HGLOBAL;
typedef void* HANDLE;

typedef struct tagPOINT { LONG x, y; } POINT, *LPPOINT;
typedef struct tagRECT { LONG left, top, right, bottom; } RECT, *LPRECT;
typedef struct tagPAINTSTRUCT { HDC hdc; BOOL fErase; RECT rcPaint; BOOL fRestore; BOOL fIncUpdate; BYTE rgbReserved[32]; } PAINTSTRUCT, *LPPAINTSTRUCT;
typedef struct tagMSG { HWND hwnd; UINT message; WPARAM wParam; LPARAM lParam; DWORD time; POINT pt; } MSG, *LPMSG;

typedef LRESULT (CALLBACK* WNDPROC)(HWND, UINT, WPARAM, LPARAM);
typedef INT_PTR (CALLBACK* DLGPROC)(HWND, UINT, WPARAM, LPARAM);

typedef struct tagWNDCLASSEXW {
  UINT cbSize; UINT style; WNDPROC lpfnWndProc; int cbClsExtra; int cbWndExtra; HINSTANCE hInstance;
  HICON hIcon; HCURSOR hCursor; HBRUSH hbrBackground; LPCWSTR lpszMenuName; LPCWSTR lpszClassName; HICON hIconSm;
} WNDCLASSEXW;
typedef WNDCLASSEXW WNDCLASSEX;

typedef struct tagCOPYDATASTRUCT { ULONG_PTR dwData; DWORD cbData; PVOID lpData; } COPYDATASTRUCT, *PCOPYDATASTRUCT;

#define LOWORD(l) ((WORD)(((DWORD_PTR)(l)) & 0xffff))
#define HIWORD(l) ((WORD)((((DWORD_PTR)(l)) >> 16) & 0xffff))
#define MAKELONG(a, b) ((LONG)(((WORD)(((DWORD_PTR)(a)) & 0xffff)) | ((DWORD)((WORD)(((DWORD_PTR)(b)) & 0xffff))) << 16))
#define MAKEWPARAM(l, h) ((WPARAM)(DWORD)MAKELONG(l, h))
#define MAKELPARAM(l, h) ((LPARAM)(DWORD)MAKELONG(l, h))
#define RGB(r, g, b) ((COLORREF)(((BYTE)(r) | ((WORD)((BYTE)(g)) << 8)) | (((DWORD)(BYTE)(b)) << 16)))
#define MAKEINTRESOURCEA(i) ((LPSTR)((ULONG_PTR)((WORD)(i))))
#define MAKEINTRESOURCEW(i) ((LPWSTR)((ULONG_PTR)((WORD)(i))))
#ifdef UNICODE
#define MAKEINTRESOURCE MAKEINTRESOURCEW
#else
#define MAKEINTRESOURCE MAKEINTRESOURCEA
#endif
#define ZeroMemory(p, n) memset((p), 0, (n))

// ------------------------------------------------------------- constants --
#define WM_NULL 0x0000
#define WM_CREATE 0x0001
#define WM_DESTROY 0x0002
#define WM_SIZE 0x0005
#define WM_PAINT 0x000F
#define WM_CLOSE 0x0010
#define WM_QUIT 0x0012
#define WM_ERASEBKGND 0x0014
#define WM_COPYDATA 0x004A
#define WM_NOTIFY 0x004E
#define WM_INITDIALOG 0x0110
#define WM_COMMAND 0x0111
#define WM_HSCROLL 0x0114
#define WM_INITMENUPOPUP 0x0117
#define WM_MOUSEMOVE 0x0200
#define WM_LBUTTONDOWN 0x0201
#define WM_LBUTTONUP 0x0202
#define WM_USER 0x0400

#define LB_ADDSTRING 0x0180
#define LB_DELETESTRING 0x0182
#define LB_GETCURSEL 0x0188
#define LB_GETCOUNT 0x018B
#define LB_ERR (-1)

#define SB_CTL 2
#define SB_LINELEFT 0
#define SB_LINERIGHT 1
#define SB_PAGELEFT 2
#define SB_PAGERIGHT 3
#define SB_THUMBPOSITION 4
#define SB_THUMBTRACK 5
#define SB_LEFT 6
#define SB_RIGHT 7
#define SB_ENDSCROLL 8

#define IDOK 1
#define IDCANCEL 2
#define BN_CLICKED 0

#define WS_OVERLAPPEDWINDOW 0x00CF0000L
#define WS_CHILD 0x40000000L
#define WS_VISIBLE 0x10000000L
#define WS_BORDER 0x00800000L
#define WS_CLIPSIBLINGS 0x04000000L
#define WS_CLIPCHILDREN 0x02000000L
#define CW_USEDEFAULT ((int)0x80000000)
#define CS_VREDRAW 0x0001
#define CS_HREDRAW 0x0002
#define COLOR_WINDOW 5
#define SW_SHOW 5
#define IDC_ARROW MAKEINTRESOURCE(32512)

#define MF_UNCHECKED 0x0000
#define MF_CHECKED 0x0008
#define MF_BYCOMMAND 0x0000

#define PS_SOLID 0
#define PS_DASH 1
#define PS_DOT 2
#define PS_DASHDOT 3
#define PS_DASHDOTDOT 4
#define PS_NULL 5
#define R2_BLACK 1
#define R2_NOTMERGEPEN 2
#define R2_MASKNOTPEN 3
#define R2_NOTCOPYPEN 4
#define R2_MASKPENNOT 5
#define R2_NOT 6
#define R2_XORPEN 7
#define R2_NOTMASKPEN 8
#define R2_MASKPEN 9
#define R2_NOTXORPEN 10
#define R2_NOP 11
#define R2_MERGENOTPEN 12
#define R2_COPYPEN 13
#define R2_MERGEPENNOT 14
#define R2_MERGEPEN 15
#define R2_WHITE 16
#define TRANSPARENT 1
#define OPAQUE 2

#define CF_TEXT 1
#define GMEM_MOVEABLE 0x0002
#define GMEM_ZEROINIT 0x0040
#define GHND (GMEM_MOVEABLE | GMEM_ZEROINIT)
#define CP_ACP 0

// ------------------------------------------------------------- functions --
#ifdef __cplusplus
extern "C" {
#endif

int LoadStringW(HINSTANCE, UINT, LPWSTR, int);
ATOM RegisterClassExW(const WNDCLASSEXW*);
HWND CreateWindowExW(DWORD, LPCWSTR, LPCWSTR, DWORD, int, int, int, int, HWND, HMENU, HINSTANCE, LPVOID);
#define CreateWindowW(c, t, s, x, y, w, h, p, m, i, l) CreateWindowExW(0, c, t, s, x, y, w, h, p, m, i, l)
BOOL ShowWindow(HWND, int);
BOOL UpdateWindow(HWND);
BOOL DestroyWindow(HWND);
HICON LoadIconW(HINSTANCE, LPCWSTR);
HICON LoadIconA(HINSTANCE, LPCSTR);
HCURSOR LoadCursorW(HINSTANCE, LPCWSTR);
HCURSOR LoadCursorA(HINSTANCE, LPCSTR);
HACCEL LoadAcceleratorsW(HINSTANCE, LPCWSTR);
HACCEL LoadAcceleratorsA(HINSTANCE, LPCSTR);
BOOL GetMessageW(LPMSG, HWND, UINT, UINT);
int TranslateAcceleratorW(HWND, HACCEL, LPMSG);
BOOL TranslateMessage(const MSG*);
LRESULT DispatchMessageW(const MSG*);
LRESULT DefWindowProcW(HWND, UINT, WPARAM, LPARAM);
void PostQuitMessage(int);
LRESULT SendMessageW(HWND, UINT, WPARAM, LPARAM);
LRESULT SendMessageA(HWND, UINT, WPARAM, LPARAM);
BOOL PostMessageW(HWND, UINT, WPARAM, LPARAM);
LRESULT SendDlgItemMessageW(HWND, int, UINT, WPARAM, LPARAM);
LRESULT SendDlgItemMessageA(HWND, int, UINT, WPARAM, LPARAM);
BOOL SetWindowTextW(HWND, LPCWSTR);
BOOL SetWindowTextA(HWND, LPCSTR);
HWND FindWindowA(LPCSTR, LPCSTR);
HWND FindWindowW(LPCWSTR, LPCWSTR);
UINT WinExec(LPCSTR, UINT);
BOOL GetClientRect(HWND, LPRECT);
BOOL GetWindowRect(HWND, LPRECT);
BOOL MoveWindow(HWND, int, int, int, int, BOOL);
BOOL InvalidateRect(HWND, const RECT*, BOOL);
BOOL GetCursorPos(LPPOINT);
BOOL ScreenToClient(HWND, LPPOINT);

INT_PTR DialogBoxParamW(HINSTANCE, LPCWSTR, HWND, DLGPROC, LPARAM);
INT_PTR DialogBoxParamA(HINSTANCE, LPCSTR, HWND, DLGPROC, LPARAM);
HWND CreateDialogParamW(HINSTANCE, LPCWSTR, HWND, DLGPROC, LPARAM);
HWND CreateDialogParamA(HINSTANCE, LPCSTR, HWND, DLGPROC, LPARAM);
BOOL EndDialog(HWND, INT_PTR);
HWND GetDlgItem(HWND, int);
UINT GetDlgItemTextA(HWND, int, LPSTR, int);
UINT GetDlgItemTextW(HWND, int, LPWSTR, int);
BOOL SetScrollRange(HWND, int, int, int, BOOL);
int GetScrollPos(HWND, int);
int SetScrollPos(HWND, int, int, BOOL);

HMENU GetMenu(HWND);
HMENU GetSubMenu(HMENU, int);
DWORD CheckMenuItem(HMENU, UINT, UINT);

HDC BeginPaint(HWND, LPPAINTSTRUCT);
BOOL EndPaint(HWND, const PAINTSTRUCT*);
HDC GetDC(HWND);
int ReleaseDC(HWND, HDC);
HPEN CreatePen(int, int, COLORREF);
HBRUSH CreateSolidBrush(COLORREF);
HGDIOBJ SelectObject(HDC, HGDIOBJ);
BOOL DeleteObject(HGDIOBJ);
int SetROP2(HDC, int);
BOOL MoveToEx(HDC, int, int, LPPOINT);
BOOL LineTo(HDC, int, int);
BOOL Rectangle(HDC, int, int, int, int);
BOOL Ellipse(HDC, int, int, int, int);
COLORREF SetPixel(HDC, int, int, COLORREF);
BOOL TextOutA(HDC, int, int, LPCSTR, int);
BOOL TextOutW(HDC, int, int, LPCWSTR, int);

int MultiByteToWideChar(UINT, DWORD, LPCSTR, int, LPWSTR, int);
LPSTR lstrcpyA(LPSTR, LPCSTR);
LPWSTR lstrcpyW(LPWSTR, LPCWSTR);
int _itoa_s(int, char*, size_t, int);
int strcpy_s(char*, size_t, const char*);

HGLOBAL GlobalAlloc(UINT, size_t);
LPVOID GlobalLock(HGLOBAL);
BOOL GlobalUnlock(HGLOBAL);
HGLOBAL GlobalFree(HGLOBAL);
BOOL OpenClipboard(HWND);
BOOL EmptyClipboard(void);
BOOL CloseClipboard(void);
HANDLE SetClipboardData(UINT, HANDLE);
HANDLE GetClipboardData(UINT);
BOOL IsClipboardFormatAvailable(UINT);

// The labs' Object2 fills its matrix with rand(): use the MSVC generator so the
// numbers follow the same sequence as on Windows.
int w32_msvc_rand(void);
void w32_msvc_srand(unsigned int);

#ifdef __cplusplus
}
#endif

#define rand w32_msvc_rand
#define srand w32_msvc_srand

#ifdef UNICODE
#define LoadIcon LoadIconW
#define LoadCursor LoadCursorW
#define LoadAccelerators LoadAcceleratorsW
#define SendMessage SendMessageW
#define SendDlgItemMessage SendDlgItemMessageW
#define SetWindowText SetWindowTextW
#define FindWindow FindWindowW
#define DialogBoxParam DialogBoxParamW
#define CreateDialogParam CreateDialogParamW
#define GetDlgItemText GetDlgItemTextW
#define TextOut TextOutW
#define lstrcpy lstrcpyW
#else
#define LoadIcon LoadIconA
#define LoadCursor LoadCursorA
#define LoadAccelerators LoadAcceleratorsA
#define SendMessage SendMessageA
#define SendDlgItemMessage SendDlgItemMessageA
#define SetWindowText SetWindowTextA
#define FindWindow FindWindowA
#define DialogBoxParam DialogBoxParamA
#define CreateDialogParam CreateDialogParamA
#define GetDlgItemText GetDlgItemTextA
#define TextOut TextOutA
#define lstrcpy lstrcpyA
#endif
#define GetMessage GetMessageW
#define TranslateAccelerator TranslateAcceleratorW
#define DispatchMessage DispatchMessageW
#define DefWindowProc DefWindowProcW
#define PostMessage PostMessageW
#define DialogBox(i, t, p, f) DialogBoxParam(i, t, p, f, 0)
#define CreateDialog(i, t, p, f) CreateDialogParam(i, t, p, f, 0)

#endif
