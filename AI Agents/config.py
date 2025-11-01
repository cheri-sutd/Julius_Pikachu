import os
from dotenv import load_dotenv
from typing import Dict, List, Optional, Any
from datetime import datetime
import sqlite3
from pathlib import Path

load_dotenv()

class Config:
    """Configuration manager for the agentic system"""
    
    # API Keys
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "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")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "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")
    
    # Agent Settings
    USE_GROQ = os.getenv("USE_GROQ", "True").lower() == "true"  # Try Groq first, fallback to OpenAI
    TEMPERATURE = float(os.getenv("TEMPERATURE", "0.1"))
    MODEL_NAME = os.getenv("MODEL_NAME", "llama-3.1-8b-instant")  # Current working Groq model
    
    # Database
    DB_PATH = os.getenv("DB_PATH", "./data/agent_memory.db")
    AUDIT_LOG_PATH = os.getenv("AUDIT_LOG_PATH", "./data/audit_logs.db")
    
    # Compliance Settings
    RISK_THRESHOLD = float(os.getenv("RISK_THRESHOLD", "0.7"))
    ALERT_ENABLED = os.getenv("ALERT_ENABLED", "True").lower() == "true"
    
    # File Paths
    UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))
    OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "./outputs"))
    
    @classmethod
    def setup_directories(cls):
        """Create necessary directories"""
        cls.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        cls.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        Path(cls.DB_PATH).parent.mkdir(parents=True, exist_ok=True)
        Path(cls.AUDIT_LOG_PATH).parent.mkdir(parents=True, exist_ok=True)
    
    @classmethod
    def init_db(cls):
        """Initialize SQLite databases"""
        cls.setup_directories()
        
        # Memory database
        conn = sqlite3.connect(cls.DB_PATH)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS agent_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_name TEXT,
                timestamp TEXT,
                memory_content TEXT,
                metadata TEXT
            )
        """)
        conn.commit()
        conn.close()
        
        # Audit log database
        conn = sqlite3.connect(cls.AUDIT_LOG_PATH)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT,
                agent_name TEXT,
                action TEXT,
                input_data TEXT,
                output_data TEXT,
                risk_score REAL,
                alert_type TEXT
            )
        """)
        conn.commit()
        conn.close()


