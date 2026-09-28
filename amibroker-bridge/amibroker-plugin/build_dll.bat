call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars32.bat"
cl.exe /O2 /LD /EHsc src\Plugin.cpp src\DataClient.cpp ws2_32.lib winhttp.lib user32.lib /link /def:DataBridgePro.def /out:DataBridgePro.dll
