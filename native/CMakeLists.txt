cmake_minimum_required(VERSION 3.15)
project(StructureAISolver VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Source files
set(SOURCES
    src/main.cpp
    src/fem_solver.cpp
    src/anl_fast_parser.cpp
)

add_executable(structure-solver ${SOURCES})

# Target properties
set_target_properties(structure-solver PROPERTIES
    OUTPUT_NAME "structure-solver"
    CXX_EXTENSIONS OFF
)

if(MSVC)
    target_compile_options(structure-solver PRIVATE /W4 /O2 /fp:fast)
else()
    target_compile_options(structure-solver PRIVATE -Wall -Wextra -O3 -ffast-math)
endif()
