# OOP

A set of object-oriented programming labs written in C++ for the Windows platform. Each lab is a standalone Win32 desktop application built around a graphics editor (and, in the last lab, a small matrix tool), progressively introducing inheritance, polymorphism, abstract base classes, and design patterns.

## Overview

The projects are organized as numbered labs. Most labs implement an interactive shape editor: the user draws shapes on the window with the mouse, and each shape type is a class derived from a common abstract base. Later labs extend this with menus, toolbars, multiple inheritance, file persistence, a table view, the singleton pattern, and inter-process communication.

All applications use the raw Win32 API (GDI drawing, dialog boxes, message loops) — not MFC. The UI text and source comments are in Ukrainian/Russian.

## Topics and labs

| Lab | Project | Focus |
| --- | --- | --- |
| `1-lab` | `Lab1` | Win32 application skeleton split into modules; dialog box with a scrollbar control. |
| `2-lab` | `Lab2` | Abstract `Shape` base class with a pure virtual `Show`; `Point`/`Line`/`Rect`/`Ellipse` subclasses; a `ShapeEditor` that manages drawing. Includes XML schema files. |
| `3-lab` | `Lab3` | Shape hierarchy plus a parallel `Editor` class hierarchy; toolbar and dynamic shape list. |
| `4-lab` | `Lab4` | Virtual inheritance and multiple inheritance (`LineOOShape : public EllipseShape, public LineShape`); composite shapes (`CubeShape`); menu checkmark state. |
| `5-lab` | `Lab5` | Singleton editor (`MyEditor::GetInstance`), unified `Editor` hierarchy, shape picking/deletion, file save/load of shapes, and a separate table window (`MyTable`). |
| `6-lab` | `lab6`, `Object2`, `Object3` | Inter-process communication between three cooperating applications using `WM_COPYDATA` and the Windows clipboard to generate a matrix and compute its determinant. |

## Tech stack

- **Language:** C++
- **Platform:** Windows (Win32 API, GDI)
- **Build:** Visual Studio solutions (`.sln`) and project files (`.vcxproj`)
- **Platform toolset:** v142 (Visual Studio 2019)
- **Windows SDK:** 10.0

No explicit C++ language-standard setting is configured in the project files, so each project builds with the toolset default.

## Building and running

Each lab ships its own Visual Studio solution. To build a lab:

1. Open the solution for the lab in Visual Studio (2019 or newer), for example `1-lab/Lab1.sln` or `5-lab/Lab5.sln`.
2. Select a configuration (Debug/Release) and platform.
3. Build and run from the IDE.

Lab 6 contains three separate projects (`lab6`, `Object2`, `Object3`). Build each one, then run them together so they can exchange data via `WM_COPYDATA` and the clipboard.

## Project structure

```
.
├── 1-lab/        Win32 skeleton + scrollbar dialog (Lab1)
├── 2-lab/        Shape hierarchy + editor, XML schemas (Lab2)
├── 3-lab/        Shape + Editor hierarchies, toolbar (Lab3)
├── 4-lab/        Virtual/multiple inheritance, composites (Lab4)
├── 5-lab/        Singleton editor, file I/O, table view (Lab5)
└── 6-lab/        Inter-process matrix tool
    ├── lab6/     Controller window
    ├── Object2/  Matrix generator
    └── Object3/  Determinant calculator
```

Each project directory follows the standard Visual Studio Win32 layout: `framework.h`, `targetver.h`, a `*.rc` resource script, icons, and the `.sln`/`.vcxproj` files.
