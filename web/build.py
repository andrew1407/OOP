#!/usr/bin/env python3
"""Compile the shape editor labs' (2-5) C++ to WebAssembly with emscripten (em++ must be on PATH).

Each lab's sources are the <ClCompile> files of its own .vcxproj, built against the Win32
shim in web/win32 instead of the Windows SDK. The labs are copied to web/.build first so that
MSVC's handling of the source text can be reproduced without touching the lab directories:
  - UTF-8 files are converted to Windows-1251. MSVC turns narrow string literals into the
    ANSI code page, so at run time every char string the labs use is cp1251 (as in
    5-lab/shapes.txt); the files that are already cp1251 are copied as they are.
  - Windows file names are case-insensitive, so "Resource.h" also finds "resource.h".
Output: web/wasm/<name>.mjs + .wasm, one module per lab.
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / 'web'
TMP = WEB / '.build'
OUT = WEB / 'wasm'

# name, project file, character set (labs 2-4 were built as Unicode, lab 5 as multi-byte)
PROJECTS = [
    ('lab2', '2-lab/Lab2.vcxproj', 'unicode'),
    ('lab3', '3-lab/Lab3.vcxproj', 'unicode'),
    ('lab4', '4-lab/Lab4.vcxproj', 'unicode'),
    ('lab5', '5-lab/Lab5.vcxproj', 'mbcs'),
]

COMPILE = ['-O2', '-std=c++17', '-fshort-wchar', '-fno-strict-return', '-w', f'-I{WEB / "win32"}']
LINK = [
    '-sMODULARIZE=1', '-sEXPORT_ES6=1', '-sEXPORT_NAME=create', '-sENVIRONMENT=web',
    # Windows never maps user memory below 64 KiB, and the labs' MAKEINTRESOURCE ids rely on it
    '-sGLOBAL_BASE=65536',
    '-sASYNCIFY=1', '-sASYNCIFY_STACK_SIZE=65536', '-sINITIAL_MEMORY=33554432', '-sSTACK_SIZE=1048576',
    '-sEXPORTED_FUNCTIONS=_w32_main,_w32_send,_w32_tooltip,_malloc,_free',
]


def to_cp1251(data: bytes) -> bytes:
    if data.startswith(b'\xef\xbb\xbf'):
        data = data[3:]
    try:
        text = data.decode('utf-8')
    except UnicodeDecodeError:
        return data  # already the ANSI code page
    return text.encode('cp1251', errors='replace')


def stage(project_dir: Path) -> Path:
    dst = TMP / project_dir.relative_to(ROOT)
    dst.mkdir(parents=True, exist_ok=True)
    for f in project_dir.iterdir():
        if f.suffix.lower() not in ('.cpp', '.h'):
            continue
        data = to_cp1251(f.read_bytes())
        for name in {f.name, f.name.lower(), f.name[:1].upper() + f.name[1:].lower()}:
            (dst / name).write_bytes(data)
    return dst


def sources(vcxproj: Path) -> list[str]:
    text = vcxproj.read_text(encoding='utf-8-sig')
    return re.findall(r'<ClCompile Include="([^"]+\.cpp)"', text)


def main() -> None:
    shutil.rmtree(TMP, ignore_errors=True)
    OUT.mkdir(exist_ok=True)
    shim = WEB / 'win32' / 'win32.cpp'
    for name, proj, charset in PROJECTS:
        vcx = ROOT / proj
        src_dir = stage(vcx.parent)
        files = [str(src_dir / s.replace('\\', '/')) for s in sources(vcx)]
        flags = COMPILE + (['-DUNICODE', '-D_UNICODE'] if charset == 'unicode' else [])
        runtime = 'ccall,HEAPU8,HEAP32,HEAPU16,HEAPU32' + (',FS' if name == 'lab5' else '')
        extra = ['-sFORCE_FILESYSTEM=1'] if name == 'lab5' else []
        cmd = ['em++', *flags, *files, str(shim), *LINK, *extra,
               f'-sEXPORTED_RUNTIME_METHODS={runtime}', '-o', str(OUT / f'{name}.mjs')]
        print(f'{name}: {", ".join(Path(f).name for f in files)}', flush=True)
        subprocess.run(cmd, check=True, cwd=src_dir)
    shutil.rmtree(TMP, ignore_errors=True)


if __name__ == '__main__':
    sys.exit(main())
