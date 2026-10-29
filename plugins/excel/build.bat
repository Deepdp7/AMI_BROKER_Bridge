@echo off
rem DataBridge Pro live prices for Excel (RTD server): a 64-bit and a 32-bit DLL, one per Excel kind.
cd /d "%~dp0"
set VS=C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build
set SRC=src\DataBridgeRtd.cpp
set LIBS=ole32.lib oleaut32.lib winhttp.lib user32.lib advapi32.lib uuid.lib
set FLAGS=/nologo /MT /O2 /std:c++17 /LD /EHsc /DUNICODE /D_UNICODE /DWIN32_LEAN_AND_MEAN
if not exist obj64 mkdir obj64
if not exist obj32 mkdir obj32

setlocal
call "%VS%\vcvars64.bat" >nul
cl.exe %FLAGS% /Foobj64\ %SRC% %LIBS% /link /DEF:DataBridgeRtd.def /OUT:DataBridgeRtd64.dll /IMPLIB:obj64\DataBridgeRtd64.lib || exit /b 1
endlocal

setlocal
call "%VS%\vcvars32.bat" >nul
cl.exe %FLAGS% /Foobj32\ %SRC% %LIBS% /link /DEF:DataBridgeRtd.def /OUT:DataBridgeRtd32.dll /IMPLIB:obj32\DataBridgeRtd32.lib || exit /b 1
endlocal
echo Build complete.
