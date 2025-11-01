"""
Shared LLM initialization helper with fallback logic
"""
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from config import Config

def get_llm_with_fallback():
    """
    Initialize LLM (Groq or OpenAI) with fallback options.
    Tries Groq models first, falls back to OpenAI if needed.
    
    Returns:
        ChatGroq or ChatOpenAI instance
    """
    # Try Groq first if enabled
    if Config.USE_GROQ and Config.GROQ_API_KEY:
        # Try multiple Groq models in order
        groq_models = [
            Config.MODEL_NAME,  # User specified
            "llama-3.1-8b-instant",  # Fast, current model
            "llama-3.3-70b-versatile",  # Latest versatile
            "llama-3.1-70b-versatile",  # Alternative
            "mixtral-8x7b-32768",  # Alternative
        ]
        
        for model in groq_models:
            try:
                llm = ChatGroq(
                    model=model,
                    temperature=Config.TEMPERATURE,
                    groq_api_key=Config.GROQ_API_KEY
                )
                print(f"   [Groq] Attempting model: {model}")
                return llm  # Return immediately, will fail at first use if model doesn't work
            except Exception as e:
                error_msg = str(e).lower()
                if "decommissioned" in error_msg or "invalid" in error_msg:
                    print(f"   [Groq] Model {model} unavailable, trying next...")
                    continue  # Try next model
                else:
                    print(f"   [Groq] Model {model} error: {str(e)[:80]}")
                    # Don't break, try other models
                    continue
    
    # Fallback to OpenAI
    if Config.OPENAI_API_KEY:
        try:
            print(f"   [OpenAI] Using gpt-4o-mini as fallback")
            return ChatOpenAI(
                model="gpt-4o-mini",  # Cost-effective
                temperature=Config.TEMPERATURE,
                openai_api_key=Config.OPENAI_API_KEY
            )
        except Exception as e:
            print(f"   [OpenAI] Failed: {str(e)[:80]}")
    
    raise ValueError("No working API key found. Please set GROQ_API_KEY or OPENAI_API_KEY")

