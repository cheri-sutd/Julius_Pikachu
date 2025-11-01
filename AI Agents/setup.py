"""
Setup script for Julius Baer Agentic System
Initializes directories and databases
"""

from config import Config
from pathlib import Path

def setup():
    """Initialize system directories and databases"""
    print("="*60)
    print("Julius Baer Agentic System - Setup")
    print("="*60)
    print()
    
    # Create directories
    print("📁 Creating directories...")
    Config.setup_directories()
    print(f"   ✅ {Config.UPLOAD_DIR}")
    print(f"   ✅ {Config.OUTPUT_DIR}")
    print(f"   ✅ {Path(Config.DB_PATH).parent}")
    print()
    
    # Initialize databases
    print("🗄️  Initializing databases...")
    Config.init_db()
    print(f"   ✅ Memory DB: {Config.DB_PATH}")
    print(f"   ✅ Audit Log DB: {Config.AUDIT_LOG_PATH}")
    print()
    
    # Check environment variables
    print("🔑 Checking configuration...")
    if Config.GROQ_API_KEY:
        print(f"   ✅ GROQ_API_KEY: {'*' * 20}")
    elif Config.OPENAI_API_KEY:
        print(f"   ✅ OPENAI_API_KEY: {'*' * 20}")
    else:
        print("   ⚠️  No API key found. Please set GROQ_API_KEY or OPENAI_API_KEY in .env")
    
    print(f"   ✅ Temperature: {Config.TEMPERATURE}")
    print(f"   ✅ Risk Threshold: {Config.RISK_THRESHOLD}")
    print(f"   ✅ Use Groq: {Config.USE_GROQ}")
    print()
    
    print("="*60)
    print("✅ Setup complete!")
    print("="*60)
    print()
    print("Next steps:")
    print("  1. Make sure .env file is configured with API keys")
    print("  2. Install dependencies: pip install -r requirements.txt")
    print("  3. Run examples: python example_usage.py")
    print()

if __name__ == "__main__":
    setup()


