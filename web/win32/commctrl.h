// Common controls part of the Win32 shim: the toolbar and its tooltips (labs 3-5).
#pragma once
#include "windows.h"

typedef struct tagNMHDR { HWND hwndFrom; UINT_PTR idFrom; UINT code; } NMHDR, *LPNMHDR;

typedef struct _TBBUTTON {
  int iBitmap; int idCommand; BYTE fsState; BYTE fsStyle; BYTE bReserved[2]; DWORD_PTR dwData; INT_PTR iString;
} TBBUTTON, *LPTBBUTTON;
typedef const TBBUTTON* LPCTBBUTTON;

typedef struct tagTOOLTIPTEXTA { NMHDR hdr; LPSTR lpszText; char szText[80]; HINSTANCE hinst; UINT uFlags; LPARAM lParam; } TOOLTIPTEXTA, *LPTOOLTIPTEXTA;
typedef struct tagTOOLTIPTEXTW { NMHDR hdr; LPWSTR lpszText; WCHAR szText[80]; HINSTANCE hinst; UINT uFlags; LPARAM lParam; } TOOLTIPTEXTW, *LPTOOLTIPTEXTW;

#define TTN_FIRST (0U - 520U)
#define TTN_NEEDTEXTA (TTN_FIRST - 0)
#define TTN_NEEDTEXTW (TTN_FIRST - 10)

#define TBSTATE_CHECKED 0x01
#define TBSTATE_PRESSED 0x02
#define TBSTATE_ENABLED 0x04
#define TBSTYLE_BUTTON 0x0000
#define TBSTYLE_TOOLTIPS 0x0100
#define CCS_TOP 0x00000001L

#define TB_PRESSBUTTON (WM_USER + 3)
#define TB_ADDBUTTONSA (WM_USER + 20)
#define TB_BUTTONSTRUCTSIZE (WM_USER + 30)
#define TB_ADDBUTTONSW (WM_USER + 68)

#ifdef UNICODE
#define TTN_NEEDTEXT TTN_NEEDTEXTW
#define TOOLTIPTEXT TOOLTIPTEXTW
#define LPTOOLTIPTEXT LPTOOLTIPTEXTW
#define TB_ADDBUTTONS TB_ADDBUTTONSW
#else
#define TTN_NEEDTEXT TTN_NEEDTEXTA
#define TOOLTIPTEXT TOOLTIPTEXTA
#define LPTOOLTIPTEXT LPTOOLTIPTEXTA
#define TB_ADDBUTTONS TB_ADDBUTTONSA
#endif

#ifdef __cplusplus
extern "C" {
#endif
void InitCommonControls(void);
HWND CreateToolbarEx(HWND, DWORD, UINT, int, HINSTANCE, UINT_PTR, LPCTBBUTTON, int, int, int, int, int, UINT);
#ifdef __cplusplus
}
#endif
