@echo off
rem Builds tests\build\dll_host.exe, a 32-bit stand-in for AmiBroker that loads a built DataBridgePro.dll
rem (see dll_host.cpp). Not part of the automatic tests: it needs an engine to talk to.
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars32.bat" >nul
if errorlevel 1 exit /b 1
cd /d "%~dp0"
if not exist build mkdir build
cl.exe /nologo /MT /O2 /std:c++17 /EHsc /W3 /D_WINDOWS /DWIN32_LEAN_AND_MEAN /I..\src dll_host.cpp ..\src\BarMerge.cpp user32.lib /Fo:build\ /Fe:build\dll_host.exe
exit /b %errorlevel%
