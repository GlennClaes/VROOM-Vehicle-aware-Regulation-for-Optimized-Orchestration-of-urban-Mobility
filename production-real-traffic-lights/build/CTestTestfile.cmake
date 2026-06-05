# CMake generated Testfile for 
# Source directory: /src
# Build directory: /src/build
# 
# This file includes the relevant testing commands required for 
# testing this directory and lists subdirectories to be tested as well.
add_test(message_protocol "/src/build/test_protocol")
set_tests_properties(message_protocol PROPERTIES  _BACKTRACE_TRIPLES "/src/CMakeLists.txt;38;add_test;/src/CMakeLists.txt;0;")
add_test(intersection_controller "/src/build/test_controller")
set_tests_properties(intersection_controller PROPERTIES  _BACKTRACE_TRIPLES "/src/CMakeLists.txt;42;add_test;/src/CMakeLists.txt;0;")
