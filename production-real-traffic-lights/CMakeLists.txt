cmake_minimum_required(VERSION 3.16)

project(vroom_real_traffic_lights
    VERSION 1.0.0
    DESCRIPTION "Production-prepared VROOM controller for physical traffic lights"
    LANGUAGES CXX
)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(vroom_real_controller STATIC
    src/gpio_hardware_adapter.cpp
    src/intersection_controller.cpp
    src/logger.cpp
    src/message_protocol.cpp
    src/mock_hardware_adapter.cpp
    src/plc_hardware_adapter.cpp
    src/types.cpp
)

target_include_directories(vroom_real_controller PUBLIC include)

if(MSVC)
    target_compile_options(vroom_real_controller PRIVATE /W4)
else()
    target_compile_options(vroom_real_controller PRIVATE -Wall -Wextra -Wpedantic)
endif()

add_executable(vroom-real-controller src/main.cpp)
target_link_libraries(vroom-real-controller PRIVATE vroom_real_controller)

enable_testing()

add_executable(test_protocol tests/test_protocol.cpp)
target_link_libraries(test_protocol PRIVATE vroom_real_controller)
add_test(NAME message_protocol COMMAND test_protocol)

add_executable(test_controller tests/test_controller.cpp)
target_link_libraries(test_controller PRIVATE vroom_real_controller)
add_test(NAME intersection_controller COMMAND test_controller)
