# D2RLoader plugin of D2R Arcane Tracker. See README.md for the build steps.
cmake_minimum_required(VERSION 3.29)

# The plugin version, reported to D2RLoader and to the tracker. Bump it for every hub release.
project(ArcaneTrackerPlugin VERSION 1.0.0 LANGUAGES CXX RC)

# The hook of the ground labels is written in assembly, which only MSVC builds
if(MSVC)
	enable_language(ASM_MASM)
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_CXX_SCAN_FOR_MODULES OFF)

# Static C/C++ runtime, so the DLL loads without any runtime DLL next to it
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

include(FetchContent)

# D2RLoader Plugin SDK 0.4.0 (plugin ABI 4), pinned to an exact commit
set(D2RLPLUGIN_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(BUILD_TESTING OFF CACHE BOOL "" FORCE)
FetchContent_Declare(
	D2RLPluginSDK
	GIT_REPOSITORY https://github.com/D2RLoader/PluginSDK.git
	GIT_TAG 03a5af9e0feb3f95f95e148e330e01f6635950df
)
FetchContent_MakeAvailable(D2RLPluginSDK)

add_library(ArcaneTrackerPlugin SHARED
	src/plugin.cpp
	src/config.cpp
	src/bridge_client.cpp
	src/local_http.cpp
	src/tracker_state.cpp
	src/grail_item.cpp
	src/ground_label.cpp
	src/ground_hooks.cpp
	src/pickups.cpp
	src/plugin.rc
)
if(MSVC)
	target_sources(ArcaneTrackerPlugin PRIVATE src/ground_hook_stub.asm)
endif()
target_link_libraries(ArcaneTrackerPlugin PRIVATE D2RLPlugin::D2RLPlugin winhttp)
target_compile_definitions(ArcaneTrackerPlugin PRIVATE
	ARCANE_TRACKER_PLUGIN_VERSION="${PROJECT_VERSION}"
	WIN32_LEAN_AND_MEAN
	NOMINMAX
)
set_target_properties(ArcaneTrackerPlugin PROPERTIES
	OUTPUT_NAME "d2rl-arcane-tracker"
	PREFIX ""
)
d2rlplugin_embed_config(TARGET ArcaneTrackerPlugin FILE "${CMAKE_CURRENT_SOURCE_DIR}/arcane-tracker.toml")

if(MSVC)
	target_compile_options(ArcaneTrackerPlugin PRIVATE "$<$<COMPILE_LANGUAGE:CXX>:/W4;/permissive-;/EHsc;/utf-8>")
else()
	target_compile_options(ArcaneTrackerPlugin PRIVATE "$<$<COMPILE_LANGUAGE:CXX>:-Wall;-Wextra;-Wpedantic;-Wno-missing-field-initializers>")
	target_link_options(ArcaneTrackerPlugin PRIVATE -static -static-libgcc -static-libstdc++ "$<$<CONFIG:Release>:-s>")
endif()

# Tests of the pure logic (config and tracker state parsers); off by default. Run them with ctest.
option(ARCANE_TRACKER_BUILD_TESTS "Build the plugin's unit tests" OFF)
if(ARCANE_TRACKER_BUILD_TESTS)
	enable_testing()
	add_executable(ArcaneTrackerPluginTests
		tests/plugin_tests.cpp
		src/config.cpp
		src/grail_item.cpp
		src/ground_label.cpp
		src/local_http.cpp
		src/tracker_state.cpp
	)
	target_include_directories(ArcaneTrackerPluginTests PRIVATE src)
	target_link_libraries(ArcaneTrackerPluginTests PRIVATE D2RLPlugin::D2RLPlugin winhttp ws2_32)
	target_compile_definitions(ArcaneTrackerPluginTests PRIVATE NOMINMAX)
	if(MSVC)
		target_compile_options(ArcaneTrackerPluginTests PRIVATE /W4 /permissive- /EHsc /utf-8)
	else()
		target_compile_options(ArcaneTrackerPluginTests PRIVATE -Wall -Wextra -Wpedantic -Wno-missing-field-initializers)
	endif()
	add_test(NAME ArcaneTrackerPluginTests COMMAND ArcaneTrackerPluginTests)
endif()
