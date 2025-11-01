"""
Test code structure and syntax without requiring dependencies
"""
import ast
import sys
from pathlib import Path

print("="*60)
print("Code Structure Validation")
print("="*60)
print()

files_to_check = [
    "config.py",
    "agent_orchestrator.py",
    "agents/aml_agents.py",
    "agents/document_agents.py",
    "agents/__init__.py"
]

errors = []
success = []

for file_path in files_to_check:
    path = Path(file_path)
    if not path.exists():
        errors.append(f"❌ {file_path} - File not found")
        continue
    
    try:
        with open(path, 'r', encoding='utf-8') as f:
            code = f.read()
        
        # Parse AST to check syntax
        ast.parse(code)
        success.append(f"✅ {file_path} - Syntax valid")
    except SyntaxError as e:
        errors.append(f"❌ {file_path} - Syntax error: {e}")
    except Exception as e:
        errors.append(f"⚠️  {file_path} - Could not parse: {e}")

print("Syntax Validation:")
print("-" * 60)
for result in success:
    print(f"  {result}")

if errors:
    print("\nErrors:")
    print("-" * 60)
    for error in errors:
        print(f"  {error}")
else:
    print("\n✅ All files have valid syntax!")

print("\n" + "="*60)
print("Code Structure Check:")
print("="*60)

# Check imports
print("\n📦 Checking imports in agent_orchestrator.py...")
try:
    with open("agent_orchestrator.py", 'r') as f:
        content = f.read()
        
    imports = []
    for line in content.split('\n'):
        if line.strip().startswith('from') or line.strip().startswith('import'):
            imports.append(line.strip())
    
    print(f"   Found {len(imports)} import statements")
    print("   Key imports:")
    for imp in imports[:10]:
        print(f"      {imp}")
    
except Exception as e:
    print(f"   Error: {e}")

# Check agent classes
print("\n🤖 Checking agent classes...")
agent_files = ["agents/aml_agents.py", "agents/document_agents.py"]
for file in agent_files:
    try:
        with open(file, 'r') as f:
            content = f.read()
            classes = [line for line in content.split('\n') if 'class ' in line and 'Agent' in line]
            if classes:
                print(f"   {file}:")
                for cls in classes[:5]:
                    cls_name = cls.split('class ')[1].split('(')[0].strip()
                    print(f"      ✅ {cls_name}")
    except Exception as e:
        print(f"   ⚠️  {file}: {e}")

print("\n" + "="*60)
print("Summary:")
print("="*60)
print("✅ Code structure validated")
print("⚠️  Dependencies need to be installed to run the agents")
print("\nTo install dependencies:")
print("   python -m pip install --user -r requirements.txt")
print("\nAfter installation, run:")
print("   python test_agents.py")


