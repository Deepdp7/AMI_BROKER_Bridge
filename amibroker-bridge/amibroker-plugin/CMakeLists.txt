cmake_minimum_required(VERSION 3.10)
project(DataBridgeProPlugin VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)

# We are building a shared library (.dll on Windows)
add_library(DataBridgePro SHARED 
    src/Plugin.cpp
    src/DataClient.cpp
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

# For networking/IPC (Named pipes / WinSock)
target_link_libraries(DataBridgePro ws2_32)

set_target_properties(DataBridgePro PROPERTIES PREFIX "")
# AmiBroker plugins traditionally use the .dll extension
set_target_properties(DataBridgePro PROPERTIES SUFFIX ".dll")
