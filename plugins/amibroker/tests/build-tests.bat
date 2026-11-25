@echo off
rem Builds and runs the plugin's tests (the parts that need no AmiBroker: merging bars, the engine's lines,
rem the recent minutes kept per symbol). Same compiler flags as build.bat. Exit code 0 = all passed.
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars32.bat" >nul
if errorlevel 1 exit /b 1
cd /d "%~dp0"
if not exist build mkdir build
cl.exe /nologo /MT /O2 /std:c++17 /EHsc /W3 /D_WINDOWS /D_USRDLL /DWIN32_LEAN_AND_MEAN /I..\src plugin_tests.cpp ..\src\BarMerge.cpp /Fo:build\ /Fe:build\plugin_tests.exe
if errorlevel 1 exit /b 1
build\plugin_tests.exe
exit /b %errorlevel%
