"""
Test script to verify installation and diagnose issues
"""
import sys
import subprocess
import os

print("="*60)
print("Installation Test & Diagnostic")
print("="*60)
print(f"\nPython Version: {sys.version}")
print(f"Python Executable: {sys.executable}")
print(f"Python Path: {sys.path[:3]}")
print()

# Try to import
print("Testing imports...")
try:
    import langchain
    print("✅ langchain - OK")
except ImportError as e:
    print(f"❌ langchain - MISSING: {e}")
    print("Attempting installation...")
    result = subprocess.run([sys.executable, "-m", "pip", "install", "langchain"], 
                           capture_output=True, text=True)
    print(result.stdout)
    if result.returncode == 0:
        print("✅ Installation successful, please try again")
    else:
        print(f"❌ Installation failed: {result.stderr}")

try:
    import langchain_groq
    print("✅ langchain_groq - OK")
except ImportError as e:
    print(f"❌ langchain_groq - MISSING: {e}")

try:
    import pandas
    print("✅ pandas - OK")
except ImportError as e:
    print(f"❌ pandas - MISSING: {e}")

try:
    from dotenv import load_dotenv
    print("✅ python-dotenv - OK")
except ImportError as e:
    print(f"❌ python-dotenv - MISSING: {e}")

print("\n" + "="*60)
print("Test Complete")
print("="*60)


