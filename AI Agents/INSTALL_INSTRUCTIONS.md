# Installation Instructions

## Current Status

✅ **Completed:**
- Project structure created
- Directories initialized (`data/`, `uploads/`, `outputs/`)
- Databases initialized (audit logs and memory)
- `.env` file created (you've added API keys)
- All code files ready

❌ **Remaining:**
- Python package dependencies need to be installed

## Installation Steps

### Option 1: Using the Batch Script (Windows)

Simply double-click `install_dependencies.bat` or run:
```cmd
install_dependencies.bat
```

### Option 2: Manual Installation

Run these commands in your terminal:

```powershell
# Upgrade pip
python -m pip install --upgrade pip

# Install core LangChain packages
python -m pip install langchain langchain-openai langchain-groq langchain-community

# Install supporting packages
python -m pip install pandas python-dotenv requests beautifulsoup4 PyPDF2 pillow opencv-python numpy scipy pyspellchecker

# Or install all at once from requirements.txt
python -m pip install -r requirements.txt
```

### Option 3: Using Virtual Environment (Recommended)

```powershell
# Create virtual environment
python -m venv venv

# Activate it
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

## Verify Installation

After installing, run:
```powershell
python quick_test.py
```

This will check:
- ✅ All directories exist
- ✅ Databases are initialized
- ✅ .env file is configured
- ✅ All Python packages are installed
- ✅ Agent system can be imported

## Next Steps After Installation

1. **Verify setup:**
   ```powershell
   python quick_test.py
   ```

2. **Run examples:**
   ```powershell
   python example_usage.py
   ```

3. **Start using the system:**
   ```python
   from agent_orchestrator import AgentOrchestrator
   
   orchestrator = AgentOrchestrator()
   # Use the agents...
   ```

## Troubleshooting

### If packages won't install:

1. **Check Python version:**
   ```powershell
   python --version
   ```
   (Should be Python 3.9 or higher)

2. **Try with --user flag:**
   ```powershell
   python -m pip install --user langchain
   ```

3. **Check permissions:**
   - Run terminal as Administrator
   - Or use `--user` flag for user-level installation

4. **Verify pip is working:**
   ```powershell
   python -m pip list
   ```

### If API keys aren't working:

- Make sure `.env` file is in the project root
- Format: `GROQ_API_KEY=your_actual_key_here` (no quotes)
- Restart terminal after editing `.env`

## Current System Status

Based on `quick_test.py` output:
- ✅ Directories: Created
- ✅ Databases: Initialized
- ✅ Config: .env file exists
- ❌ Packages: Need manual installation

Once packages are installed, the system will be fully operational!


