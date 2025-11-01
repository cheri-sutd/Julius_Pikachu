"""
Quick test to verify system setup
Run this after installing dependencies manually
"""
import sys
import os
from pathlib import Path

print("="*60)
print("Julius Baer Agentic System - Quick Test")
print("="*60)

# Check directories
print("\n📁 Checking directories...")
dirs = ["./data", "./uploads", "./outputs"]
for d in dirs:
    if Path(d).exists():
        print(f"   ✅ {d}")
    else:
        print(f"   ❌ {d} - Missing")

# Check databases
print("\n🗄️  Checking databases...")
dbs = ["./data/agent_memory.db", "./data/audit_logs.db"]
for db in dbs:
    if Path(db).exists():
        print(f"   ✅ {db}")
    else:
        print(f"   ❌ {db} - Missing")

# Check .env file
print("\n🔑 Checking configuration...")
if Path(".env").exists():
    print("   ✅ .env file exists")
    # Check if it has API keys (don't reveal them)
    with open(".env", "r") as f:
        content = f.read()
        if "GROQ_API_KEY=" in content or "OPENAI_API_KEY=" in content:
            if "your_" not in content.lower():
                print("   ✅ API keys appear to be configured")
            else:
                print("   ⚠️  API keys may need to be set")
else:
    print("   ❌ .env file missing - please create it with your API keys")

# Check imports
print("\n📦 Checking Python packages...")
packages = {
    "langchain": "LangChain",
    "langchain_groq": "LangChain Groq",
    "langchain_openai": "LangChain OpenAI",
    "pandas": "Pandas",
    "dotenv": "python-dotenv",
    "requests": "Requests",
    "bs4": "BeautifulSoup4",
    "PIL": "Pillow"
}

missing = []
for package, name in packages.items():
    try:
        __import__(package)
        print(f"   ✅ {name}")
    except ImportError:
        print(f"   ❌ {name} - Not installed")
        missing.append(package)

if missing:
    print(f"\n⚠️  Missing packages: {', '.join(missing)}")
    print("\nTo install, run:")
    print("   pip install langchain langchain-openai langchain-groq langchain-community")
    print("   pip install pandas python-dotenv requests beautifulsoup4 PyPDF2 pillow opencv-python")
else:
    print("\n✅ All dependencies installed!")

# Test agent system
if not missing:
    print("\n🤖 Testing agent system...")
    try:
        from agent_orchestrator import AgentOrchestrator
        print("   ✅ Agent orchestrator imported successfully")
        
        # Try to initialize (this will test if API keys work)
        try:
            orch = AgentOrchestrator()
            print("   ✅ All agents initialized successfully!")
            print("\n🎉 System is ready to use!")
        except Exception as e:
            print(f"   ⚠️  Agent initialization issue: {e}")
            print("   This might be due to missing API keys in .env file")
    except Exception as e:
        print(f"   ❌ Import error: {e}")

print("\n" + "="*60)


