@echo off
echo Building DataBridgePro.dll as 32-bit x86...
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars32.bat"
cl.exe /MT /std:c++17 /LD /EHsc /D_WINDOWS /D_USRDLL /DDATABRIDGEPRO_EXPORTS /DWIN32_LEAN_AND_MEAN src\Plugin.cpp src\DataClient.cpp ws2_32.lib user32.lib /link /DEF:exports.def /OUT:DataBridgePro.dll
echo Build complete.
