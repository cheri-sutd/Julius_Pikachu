"""
Main Agent Orchestrator for Julius Baer Agentic System
Coordinates all agents and provides unified interface
"""

from typing import Dict, List, Optional, Any, Union
from pathlib import Path
import json
from datetime import datetime

from config import Config
from agents import (
    TransactionMonitorAgent,
    RegulatoryWatcherAgent,
    SpellCheckerAgent,
    ImageForensicsAgent,
    InfoValidatorAgent
)

class AgentOrchestrator:
    """
    Main orchestrator that coordinates all agents in the system.
    Provides unified API for interacting with all agents.
    """
    
    def __init__(self):
        """Initialize all agents"""
        Config.init_db()
        
        # Part 1: AML & Compliance Agents
        self.transaction_monitor = TransactionMonitorAgent()
        self.regulatory_watcher = RegulatoryWatcherAgent()
        
        # Part 2: Document Validation Agents
        self.spell_checker = SpellCheckerAgent()
        self.image_forensics = ImageForensicsAgent()
        self.info_validator = InfoValidatorAgent()
        
        print("✅ All agents initialized successfully")
    
    # ============================================
    # PART 1: AML & Compliance Methods
    # ============================================
    
    def analyze_transactions(self, csv_path: str) -> Dict[str, Any]:
        """
        Analyze transaction CSV for AML patterns.
        
        Args:
            csv_path: Path to CSV file with transactions
            
        Returns:
            Analysis results with risk scores and alerts
        """
        print(f"🔍 Analyzing transactions from: {csv_path}")
        result = self.transaction_monitor.analyze_transaction_csv(csv_path)
        print(f"✅ Analysis complete. Risk Score: {result['risk_score']:.2f}")
        return result
    
    def process_regulatory_circular(self, url: str = None, text: str = None) -> Dict[str, Any]:
        """
        Process regulatory circular from URL or text.
        
        Args:
            url: URL to regulatory circular (optional)
            text: Text content of circular (optional)
            
        Returns:
            Summary with compliance triggers and recommendations
        """
        if url:
            print(f"📋 Processing regulatory circular from URL: {url}")
            result = self.regulatory_watcher.process_circular_url(url)
        elif text:
            print(f"📋 Processing regulatory circular from text")
            result = self.regulatory_watcher.summarize_circular_text(text)
        else:
            raise ValueError("Either 'url' or 'text' must be provided")
        
        print(f"✅ Circular processed. Risk Level: {result.get('risk_level', 'N/A')}")
        return result
    
    # ============================================
    # PART 2: Document Validation Methods
    # ============================================
    
    def check_spelling(self, text: str = None, pdf_path: str = None) -> Dict[str, Any]:
        """
        Check spelling and grammar in text or PDF.
        
        Args:
            text: Text content to check (optional)
            pdf_path: Path to PDF file (optional)
            
        Returns:
            Validation results with errors and quality score
        """
        if pdf_path:
            print(f"📝 Checking spelling in PDF: {pdf_path}")
            result = self.spell_checker.check_pdf_spelling(pdf_path)
        elif text:
            print(f"📝 Checking spelling in text")
            result = self.spell_checker.check_text_spelling(text)
        else:
            raise ValueError("Either 'text' or 'pdf_path' must be provided")
        
        print(f"✅ Spell check complete. Quality Score: {result.get('quality_score', 0)}")
        return result
    
    def analyze_image(self, image_path: str) -> Dict[str, Any]:
        """
        Analyze image for tampering and authenticity.
        
        Args:
            image_path: Path to image file
            
        Returns:
            Analysis results with tampering score and authenticity assessment
        """
        print(f"🖼️  Analyzing image for tampering: {image_path}")
        result = self.image_forensics.analyze_image(image_path)
        print(f"✅ Image analysis complete. Tampering Score: {result['tampering_score']:.2f}, Authenticity: {result['authenticity_score']}")
        return result
    
    def validate_info(self, document_text: str = None, pdf_path: str = None,
                     document_type: str = None, required_fields: List[str] = None) -> Dict[str, Any]:
        """
        Validate information accuracy and completeness in document.
        
        Args:
            document_text: Text content of document (optional)
            pdf_path: Path to PDF file (optional)
            document_type: Type of document (e.g., "KYC", "Transaction")
            required_fields: List of required fields to check
            
        Returns:
            Validation results with completeness and accuracy scores
        """
        if pdf_path:
            print(f"✅ Validating information in PDF: {pdf_path}")
            result = self.info_validator.validate_pdf_info(pdf_path, document_type, required_fields)
        elif document_text:
            print(f"✅ Validating information in document")
            result = self.info_validator.validate_document_info(document_text, document_type, required_fields)
        else:
            raise ValueError("Either 'document_text' or 'pdf_path' must be provided")
        
        print(f"✅ Validation complete. Overall Score: {result.get('overall_score', 0):.1f}")
        return result
    
    # ============================================
    # Utility Methods
    # ============================================
    
    def get_audit_logs(self, agent_name: Optional[str] = None, 
                      limit: int = 100) -> List[Dict[str, Any]]:
        """
        Retrieve audit logs from database.
        
        Args:
            agent_name: Filter by agent name (optional)
            limit: Maximum number of logs to return
            
        Returns:
            List of audit log entries
        """
        import sqlite3
        
        conn = sqlite3.connect(Config.AUDIT_LOG_PATH)
        conn.row_factory = sqlite3.Row
        
        if agent_name:
            cursor = conn.execute("""
                SELECT * FROM audit_logs 
                WHERE agent_name = ? 
                ORDER BY timestamp DESC 
                LIMIT ?
            """, (agent_name, limit))
        else:
            cursor = conn.execute("""
                SELECT * FROM audit_logs 
                ORDER BY timestamp DESC 
                LIMIT ?
            """, (limit,))
        
        logs = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return logs
    
    def export_results(self, results: Dict[str, Any], output_path: str):
        """
        Export agent results to JSON file.
        
        Args:
            results: Results dictionary from any agent
            output_path: Path to output JSON file
        """
        Config.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        output_file = Config.OUTPUT_DIR / output_path
        
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        print(f"💾 Results exported to: {output_file}")


def main():
    """Example usage of the agent orchestrator"""
    print("=" * 60)
    print("Julius Baer Agentic System - Agent Orchestrator")
    print("=" * 60)
    print()
    
    # Initialize orchestrator
    orchestrator = AgentOrchestrator()
    
    print("\n" + "=" * 60)
    print("Available Agents:")
    print("=" * 60)
    print("PART 1: AML & Compliance")
    print("  1. TransactionMonitorAgent - Analyze transaction CSVs")
    print("  2. RegulatoryWatcherAgent - Process regulatory circulars")
    print()
    print("PART 2: Document Validation")
    print("  3. SpellCheckerAgent - Check spelling and grammar")
    print("  4. ImageForensicsAgent - Detect image tampering")
    print("  5. InfoValidatorAgent - Validate information accuracy")
    print("=" * 60)
    print()
    
    # Example usage
    print("📖 Example Usage:")
    print()
    print("# Part 1: AML Detection")
    print("orchestrator.analyze_transactions('transactions.csv')")
    print("orchestrator.process_regulatory_circular(url='https://example.com/circular')")
    print()
    print("# Part 2: Document Validation")
    print("orchestrator.check_spelling(text='Your document text here')")
    print("orchestrator.analyze_image('image.jpg')")
    print("orchestrator.validate_info(document_text='...', document_type='KYC')")
    print()
    
    return orchestrator


if __name__ == "__main__":
    orchestrator = main()


