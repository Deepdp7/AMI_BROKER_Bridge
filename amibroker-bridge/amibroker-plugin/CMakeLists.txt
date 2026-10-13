cmake_minimum_required(VERSION 3.15)
project(DataBridgeProPlugin VERSION 1.0.0 LANGUAGES CXX)

# AmiBroker on client PCs is 32-bit: configure with the "amd64_x86" (or "x86") VS kit.
if(NOT CMAKE_SIZEOF_VOID_P EQUAL 4)
    message(WARNING "Building a 64-bit DataBridgePro.dll — it will NOT load in 32-bit AmiBroker. Select the amd64_x86 kit.")
endif()

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)

# Static CRT (/MT) like build.bat, so clients don't need the VC++ redistributable
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

# We are building a shared library (.dll on Windows).
# DataBridgePro.def exports Notify + GetRecentInfo, which live streaming needs.
add_library(DataBridgePro SHARED
    src/Plugin.cpp
    src/DataClient.cpp
    DataBridgePro.def
)

# Target Windows specifically
if(WIN32)
    target_compile_definitions(DataBridgePro PRIVATE
        _WINDOWS
        _USRDLL
        DATABRIDGEPRO_EXPORTS
        WIN32_LEAN_AND_MEAN
    )
endif()

# WinSock (live IPC on 7891), WinHTTP (history from 7890), user32 (SendMessage to AmiBroker)
target_link_libraries(DataBridgePro ws2_32 winhttp user32)

set_target_properties(DataBridgePro PROPERTIES PREFIX "")
# AmiBroker plugins traditionally use the .dll extension
set_target_properties(DataBridgePro PROPERTIES SUFFIX ".dll")
