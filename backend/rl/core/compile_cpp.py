import os
import sys
import subprocess
import shutil
from pathlib import Path

def compile_lib():
    current_dir = Path(__file__).parent.resolve()
    cpp_file = current_dir / "prediction_engine.cpp"
    
    # Determine platform-specific output name
    if sys.platform == "win32":
        output_lib = current_dir / "prediction_engine.dll"
        compile_cmd = ["g++", "-O3", "-ffast-math", "-march=native", "-shared", "-std=c++17", str(cpp_file), "-o", str(output_lib)]
    else:
        output_lib = current_dir / "libprediction_engine.so"
        compile_cmd = ["g++", "-O3", "-ffast-math", "-march=native", "-shared", "-std=c++17", "-fPIC", str(cpp_file), "-o", str(output_lib)]

    print(f"[C++ Compiler] Target file: {cpp_file}")
    print(f"[C++ Compiler] Output library: {output_lib}")

    # Check if compiler is available
    if shutil.which("g++") is None:
        print("[C++ Compiler] g++ not found on PATH. C++ compilation skipped.")
        return False

    try:
        print(f"[C++ Compiler] Executing command: {' '.join(compile_cmd)}")
        result = subprocess.run(compile_cmd, capture_output=True, text=True, check=True)
        print("[C++ Compiler] Shared library compiled successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print("[C++ Compiler] Compilation failed:")
        print(e.stderr)
        return False
    except Exception as e:
        print(f"[C++ Compiler] Compilation error: {e}")
        return False

if __name__ == "__main__":
    compile_lib()
