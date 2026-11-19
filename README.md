# OOP

<p align="center">
  <a href="https://andrew1407.github.io/OOP/" title="Open the labs in the browser">
    <img src="web/icon.svg" alt="OOP Labs" width="140" height="140">
  </a>
</p>

[![pages deploy badge](https://github.com/andrew1407/OOP/actions/workflows/pages.yml/badge.svg)](https://andrew1407.github.io/OOP/)

A set of object-oriented programming labs written in C++ for the Windows platform. Each lab is a standalone Win32 desktop application built around a graphics editor (and, in the last lab, a small matrix tool), progressively introducing inheritance, polymorphism, abstract base classes, and design patterns.

## Overview

The projects are organized as numbered labs. Most labs implement an interactive shape editor: the user draws shapes on the window with the mouse, and each shape type is a class derived from a common abstract base. Later labs extend this with menus, toolbars, multiple inheritance, file persistence, a table view, the singleton pattern, and inter-process communication.

All applications use the raw Win32 API (GDI drawing, dialog boxes, message loops) — not MFC. The UI text and source comments are in Ukrainian/Russian, except lab 5, which is in English.

## Topics and labs

| Lab | Project | Focus |
| --- | --- | --- |
| [`1-lab`](1-lab) | `Lab1` | Win32 application skeleton split into modules; dialog box with a scrollbar control. |
| [`2-lab`](2-lab) | `Lab2` | Abstract [`Shape`](2-lab/shape.h) base class with a pure virtual `Show`; [`Point`](2-lab/shape.h)/[`Line`](2-lab/shape.h)/[`Rect`](2-lab/shape.h)/[`Ellipse`](2-lab/shape.h) subclasses; a [`ShapeEditor`](2-lab/shape_editor.h) that manages drawing. Includes XML schema files. |
| [`3-lab`](3-lab) | `Lab3` | Shape hierarchy plus a parallel [`Editor`](3-lab/editor.h) class hierarchy; toolbar and dynamic shape list. |
| [`4-lab`](4-lab) | `Lab4` | Virtual inheritance and multiple inheritance ([`LineOOShape : public EllipseShape, public LineShape`](4-lab/shape.h)); composite shapes ([`CubeShape`](4-lab/shape.h)); menu checkmark state. |
| [`5-lab`](5-lab) | `Lab5` | Singleton editor ([`MyEditor::GetInstance`](5-lab/my_editor.h)), unified [`Editor`](5-lab/editor.h) hierarchy, shape picking/deletion, file save/load of shapes, and a separate table window ([`MyTable`](5-lab/my_table.h)). |
| [`6-lab`](6-lab) | [`lab6`](6-lab/lab6), [`Object2`](6-lab/Object2), [`Object3`](6-lab/Object3) | Inter-process communication between three cooperating applications using `WM_COPYDATA` and the Windows clipboard to generate a matrix and compute its determinant. |

## Showcase

**[Open the shape editor in the browser](https://andrew1407.github.io/OOP/)**. The page runs the finished shape-painting app from lab 5: draw points, lines, rectangles, ellipses, lines with circles and cubes with the toolbar and menus, select or delete them in the shape list window, and save and load them through `shapes.txt` and `shapesRead.txt`. The canvas copies as a PNG image, and the `shapes.txt` table and `shapesRead.txt` copy as text.

- **It runs natively, nothing is ported.** [`web/build.py`](web/build.py) compiles the `<ClCompile>` sources of [`5-lab/Lab5.vcxproj`](5-lab/Lab5.vcxproj) with emscripten, including `wWinMain` and its message loop, as a multi-byte build with narrow strings in Windows-1251, like the original project.
- **Win32 is emulated by a small shim** in [`web/win32`](web/win32) and [`web/host.js`](web/host.js). Windows, message queues and dialogs run in C++. `GetMessage` waits on the page through Asyncify. GDI drawing goes to a canvas with GDI's pens, brushes and `R2_NOTXORPEN` raster mode. Menus, the toolbar, dialogs and string tables are read from the lab's own `.rc` files and bitmaps.
- **Files**: `shapes.txt` and `shapesRead.txt` live in the module's file system. You can download what the editor wrote or upload a file for it to read.

Build and run it locally (needs [emsdk](https://emscripten.org/docs/getting_started/downloads.html)):

```sh
python3 web/build.py                             # builds web/wasm/
python3 -m http.server                           # then open http://localhost:8000/web/
```

The [pages workflow](.github/workflows/pages.yml) builds and deploys it on every push to `main`.

## Tech stack

- **Language:** C++
- **Platform:** Windows (Win32 API, GDI)
- **Build:** Visual Studio solutions (`.sln`) and project files (`.vcxproj`)
- **Platform toolset:** v142 (Visual Studio 2019)
- **Windows SDK:** 10.0

No explicit C++ language-standard setting is configured in the project files, so each project builds with the toolset default.

## Building and running

Each lab ships its own Visual Studio solution. To build a lab:

1. Open the solution for the lab in Visual Studio (2019 or newer), for example [`1-lab/Lab1.sln`](1-lab/Lab1.sln) or [`5-lab/Lab5.sln`](5-lab/Lab5.sln).
2. Select a configuration (Debug/Release) and platform.
3. Build and run from the IDE.

Lab 6 contains three separate projects ([`lab6`](6-lab/lab6), [`Object2`](6-lab/Object2), [`Object3`](6-lab/Object3)). Build each one, then run them together so they can exchange data via `WM_COPYDATA` and the clipboard.

## Project structure

```
.
├── 1-lab/        Win32 skeleton + scrollbar dialog (Lab1)
├── 2-lab/        Shape hierarchy + editor, XML schemas (Lab2)
├── 3-lab/        Shape + Editor hierarchies, toolbar (Lab3)
├── 4-lab/        Virtual/multiple inheritance, composites (Lab4)
├── 5-lab/        Singleton editor, file I/O, table view (Lab5)
├── 6-lab/        Inter-process matrix tool
│   ├── lab6/     Controller window
│   ├── Object2/  Matrix generator
│   └── Object3/  Determinant calculator
└── web/          Browser showcase: Win32 shim, emscripten build, page
```

Each project directory follows the standard Visual Studio Win32 layout: [`framework.h`](1-lab/framework.h), [`targetver.h`](1-lab/targetver.h), a `*.rc` resource script, icons, and the `.sln`/`.vcxproj` files.
