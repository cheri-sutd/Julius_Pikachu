"""
Part 1: AML Detection and Compliance Agents
- Transaction Monitor: Detects AML anomalies in transaction data
- Regulatory Watcher: Monitors regulatory circulars and updates
"""

from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from .llm_helper import get_llm_with_fallback
from langchain.tools import Tool
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.schema import HumanMessage, AIMessage
from langchain.memory import ConversationBufferMemory
from typing import Dict, List, Optional, Any
import pandas as pd
import json
from datetime import datetime
import sqlite3
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import Config

class AuditLogger:
    """Utility class for logging agent actions to audit trail"""
    
    @staticmethod
    def log(agent_name: str, action: str, input_data: Any, 
            output_data: Any, risk_score: Optional[float] = None, 
            alert_type: Optional[str] = None):
        """Log agent action to audit database"""
        
        def safe_json_serialize(obj):
            """Safely serialize objects to JSON, handling numpy types"""
            if isinstance(obj, dict):
                return json.dumps({k: safe_json_serialize(v) for k, v in obj.items()}, default=str)
            elif isinstance(obj, (list, tuple)):
                return json.dumps([safe_json_serialize(item) for item in obj], default=str)
            else:
                try:
                    # Try regular JSON serialization
                    json.dumps(obj)
                    return json.dumps(obj) if isinstance(obj, (dict, list)) else str(obj)
                except (TypeError, ValueError):
                    # Fallback to string representation for non-serializable types
                    return str(obj)
        
        conn = sqlite3.connect(Config.AUDIT_LOG_PATH)
        try:
            conn.execute("""
                INSERT INTO audit_logs 
                (timestamp, agent_name, action, input_data, output_data, risk_score, alert_type)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                datetime.now().isoformat(),
                agent_name,
                action,
                safe_json_serialize(input_data),
                safe_json_serialize(output_data),
                float(risk_score) if risk_score is not None else None,
                alert_type
            ))
            conn.commit()
        except Exception as e:
            # Log error but don't fail the operation
            print(f"   Warning: Audit log failed: {str(e)[:100]}")
        finally:
            conn.close()

# ============================================
# PART 1: AML DETECTION AGENTS
# ============================================

class TransactionMonitorAgent:
    """
    Agent responsible for monitoring transactions and detecting AML anomalies.
    Analyzes CSV transaction data and calculates risk scores.
    """
    
    def __init__(self):
        self.agent_name = "TransactionMonitor"
        self.llm = self._get_llm()
        self.memory = ConversationBufferMemory(
            return_messages=True,
            memory_key="chat_history"
        )
        
    def _get_llm(self):
        """Initialize LLM (Groq or OpenAI) with fallback"""
        return get_llm_with_fallback()
    
    def analyze_transaction_csv(self, csv_path: str) -> Dict[str, Any]:
        """
        Analyze transaction CSV file for AML patterns.
        
        Args:
            csv_path: Path to CSV file with transactions
            
        Returns:
            Dictionary with risk_score, alerts, and analysis
        """
        try:
            df = pd.read_csv(csv_path)
            
            # Basic statistical analysis
            stats = {
                "total_transactions": len(df),
                "total_amount": df.get("amount", pd.Series([0])).sum() if "amount" in df.columns else 0,
                "avg_amount": df.get("amount", pd.Series([0])).mean() if "amount" in df.columns else 0,
                "unique_entities": df.get("entity_id", df.get("customer_id", pd.Series([]))).nunique() if any(col in df.columns for col in ["entity_id", "customer_id"]) else 0
            }
            
            # Risk indicators
            risk_indicators = []
            risk_score = 0.0
            
            # Large transaction detection
            if "amount" in df.columns:
                large_txn_threshold = stats["avg_amount"] * 3
                large_txns = df[df["amount"] > large_txn_threshold]
                if len(large_txns) > 0:
                    risk_indicators.append({
                        "type": "LARGE_TRANSACTION",
                        "count": len(large_txns),
                        "severity": "HIGH"
                    })
                    risk_score += 0.3
            
            # High frequency detection
            if "entity_id" in df.columns or "customer_id" in df.columns:
                entity_col = "entity_id" if "entity_id" in df.columns else "customer_id"
                entity_counts = df[entity_col].value_counts()
                high_freq = entity_counts[entity_counts > stats["total_transactions"] * 0.1]
                if len(high_freq) > 0:
                    risk_indicators.append({
                        "type": "HIGH_FREQUENCY",
                        "count": len(high_freq),
                        "severity": "MEDIUM"
                    })
                    risk_score += 0.2
            
            # Pattern analysis (using LLM for sophisticated detection)
            df_summary = df.head(100).to_dict('records')  # Sample for LLM analysis
            
            prompt = f"""
            Analyze the following transaction data for potential AML (Anti-Money Laundering) patterns:
            
            Transaction Summary:
            - Total transactions: {stats['total_transactions']}
            - Total amount: {stats['total_amount']}
            - Sample transactions: {json.dumps(df_summary[:10], default=str)}
            
            Risk Indicators Found:
            {json.dumps(risk_indicators, indent=2)}
            
            Identify:
            1. Suspicious patterns (structuring, layering, placement)
            2. Unusual transaction amounts or frequencies
            3. Geographic or timing anomalies
            4. Additional risk factors
            
            Provide a detailed analysis with risk score justification (0.0-1.0).
            """
            
            response = self.llm.invoke(prompt)
            llm_analysis = response.content if hasattr(response, 'content') else str(response)
            
            # Extract risk score from LLM response (simple extraction)
            try:
                if "risk score" in llm_analysis.lower():
                    # Try to extract numeric risk score
                    import re
                    score_match = re.search(r'(?:risk score|risk score:|score:)\s*([0-9.]+)', llm_analysis.lower())
                    if score_match:
                        llm_risk = float(score_match.group(1))
                        if llm_risk <= 1.0:
                            risk_score = max(risk_score, llm_risk)
            except:
                pass
            
            # Cap risk score at 1.0
            risk_score = min(risk_score, 1.0)
            
            # Generate alerts if threshold exceeded
            alerts = []
            if risk_score >= Config.RISK_THRESHOLD:
                alerts.append({
                    "type": "HIGH_RISK_TRANSACTIONS",
                    "severity": "CRITICAL" if risk_score > 0.8 else "HIGH",
                    "message": f"Transaction batch flagged with risk score: {risk_score:.2f}",
                    "recommendation": "Immediate review required"
                })
            
            result = {
                "risk_score": risk_score,
                "risk_indicators": risk_indicators,
                "statistics": stats,
                "llm_analysis": llm_analysis,
                "alerts": alerts,
                "timestamp": datetime.now().isoformat()
            }
            
            # Audit log
            AuditLogger.log(
                self.agent_name,
                "analyze_transactions",
                {"csv_path": csv_path, "stats": stats},
                result,
                risk_score=risk_score,
                alert_type="HIGH_RISK_TRANSACTIONS" if alerts else None
            )
            
            return result
            
        except Exception as e:
            error_result = {
                "error": str(e),
                "risk_score": 0.0,
                "alerts": []
            }
            AuditLogger.log(self.agent_name, "analyze_transactions", {"csv_path": csv_path}, error_result)
            raise


class RegulatoryWatcherAgent:
    """
    Agent responsible for monitoring regulatory circulars and updates.
    Summarizes circulars and identifies compliance triggers.
    """
    
    def __init__(self):
        self.agent_name = "RegulatoryWatcher"
        self.llm = self._get_llm()
        self.memory = ConversationBufferMemory(
            return_messages=True,
            memory_key="chat_history"
        )
        
    def _get_llm(self):
        """Initialize LLM (Groq or OpenAI) with fallback"""
        return get_llm_with_fallback()
    
    def process_circular_url(self, url: str) -> Dict[str, Any]:
        """
        Process regulatory circular from URL.
        
        Args:
            url: URL to regulatory circular document
            
        Returns:
            Dictionary with summary, compliance triggers, and recommendations
        """
        try:
            import requests
            from bs4 import BeautifulSoup
            
            # Fetch content from URL
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            
            # Extract text content
            soup = BeautifulSoup(response.content, 'html.parser')
            text_content = soup.get_text(separator=' ', strip=True)
            
            # Limit content length for LLM processing
            max_chars = 10000
            if len(text_content) > max_chars:
                text_content = text_content[:max_chars] + "... [truncated]"
            
            # LLM analysis
            prompt = f"""
            Analyze the following regulatory circular from URL: {url}
            
            Document Content:
            {text_content}
            
            Provide:
            1. Executive Summary (2-3 sentences)
            2. Key Compliance Requirements
            3. Affected Areas (AML, KYC, Reporting, etc.)
            4. Action Items Required
            5. Risk Level (LOW/MEDIUM/HIGH)
            6. Timeline/Deadlines mentioned
            
            Format as structured JSON with these keys:
            - summary
            - compliance_requirements (list)
            - affected_areas (list)
            - action_items (list)
            - risk_level
            - deadlines
            """
            
            response = self.llm.invoke(prompt)
            analysis = response.content if hasattr(response, 'content') else str(response)
            
            # Try to parse JSON from response
            try:
                import re
                json_match = re.search(r'\{.*\}', analysis, re.DOTALL)
                if json_match:
                    parsed_analysis = json.loads(json_match.group())
                else:
                    parsed_analysis = {"raw_analysis": analysis}
            except:
                parsed_analysis = {"raw_analysis": analysis}
            
            # Identify compliance triggers
            triggers = []
            if "aml" in text_content.lower() or "money laundering" in text_content.lower():
                triggers.append("AML_COMPLIANCE")
            if "kyc" in text_content.lower() or "know your customer" in text_content.lower():
                triggers.append("KYC_UPDATE")
            if "reporting" in text_content.lower() or "report" in text_content.lower():
                triggers.append("REPORTING_REQUIREMENT")
            
            result = {
                "url": url,
                "summary": parsed_analysis.get("summary", "Analysis completed"),
                "compliance_requirements": parsed_analysis.get("compliance_requirements", []),
                "affected_areas": parsed_analysis.get("affected_areas", []),
                "action_items": parsed_analysis.get("action_items", []),
                "risk_level": parsed_analysis.get("risk_level", "MEDIUM"),
                "deadlines": parsed_analysis.get("deadlines", []),
                "compliance_triggers": triggers,
                "timestamp": datetime.now().isoformat(),
                "raw_analysis": analysis
            }
            
            # Audit log
            AuditLogger.log(
                self.agent_name,
                "process_circular",
                {"url": url},
                result,
                alert_type="REGULATORY_UPDATE" if triggers else None
            )
            
            return result
            
        except Exception as e:
            error_result = {
                "error": str(e),
                "url": url,
                "compliance_triggers": []
            }
            AuditLogger.log(self.agent_name, "process_circular", {"url": url}, error_result)
            raise
    
    def summarize_circular_text(self, text: str) -> Dict[str, Any]:
        """
        Process regulatory circular from direct text input.
        
        Args:
            text: Raw text content of circular
            
        Returns:
            Dictionary with summary and compliance triggers
        """
        try:
            # Limit content length
            max_chars = 10000
            if len(text) > max_chars:
                text = text[:max_chars] + "... [truncated]"
            
            # LLM analysis
            prompt = f"""
            Analyze the following regulatory circular:
            
            {text}
            
            Provide:
            1. Executive Summary
            2. Key Compliance Requirements
            3. Affected Areas
            4. Action Items
            5. Risk Level
            
            Format as structured analysis.
            """
            
            response = self.llm.invoke(prompt)
            analysis = response.content if hasattr(response, 'content') else str(response)
            
            # Identify triggers
            triggers = []
            text_lower = text.lower()
            if "aml" in text_lower or "money laundering" in text_lower:
                triggers.append("AML_COMPLIANCE")
            if "kyc" in text_lower or "know your customer" in text_lower:
                triggers.append("KYC_UPDATE")
            
            result = {
                "summary": analysis,
                "compliance_triggers": triggers,
                "timestamp": datetime.now().isoformat()
            }
            
            AuditLogger.log(self.agent_name, "summarize_circular", {"text_length": len(text)}, result)
            
            return result
            
        except Exception as e:
            return {"error": str(e), "compliance_triggers": []}


