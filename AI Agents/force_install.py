"""
Force install dependencies and test
"""
import subprocess
import sys
import time

packages = [
    "langchain",
    "langchain-openai",
    "langchain-groq",
    "langchain-community",
    "pandas",
    "beautifulsoup4",
    "PyPDF2",
    "pillow"
]

print("="*60)
print("Installing dependencies...")
print("="*60)

for package in packages:
    print(f"\nInstalling {package}...")
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--user", package],
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        if result.returncode == 0:
            print(f"✅ {package} installed successfully")
            # Show last few lines of output
            lines = result.stdout.split('\n')
            for line in lines[-5:]:
                if line.strip():
                    print(f"   {line}")
        else:
            print(f"❌ {package} failed to install")
            print(result.stderr[:500])
    except subprocess.TimeoutExpired:
        print(f"⏱️  {package} installation timed out")
    except Exception as e:
        print(f"❌ Error installing {package}: {e}")

print("\n" + "="*60)
print("Installation complete! Testing imports...")
print("="*60)

# Test imports
for package in ["langchain", "langchain_groq", "langchain_openai", "pandas"]:
    try:
        __import__(package)
        print(f"✅ {package} - OK")
    except ImportError as e:
        print(f"❌ {package} - NOT INSTALLED: {e}")

print("\n" + "="*60)
print("Done!")
print("="*60)

