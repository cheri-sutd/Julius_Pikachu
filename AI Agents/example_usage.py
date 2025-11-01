"""
Example usage of the Julius Baer Agentic System
Demonstrates how to use all agents for AML detection and document validation
"""

from agent_orchestrator import AgentOrchestrator
from pathlib import Path
import json

def example_part1_aml_detection():
    """Example: Part 1 - AML Detection and Compliance"""
    print("\n" + "="*60)
    print("PART 1: AML Detection and Compliance Examples")
    print("="*60)
    
    orchestrator = AgentOrchestrator()
    
    # Example 1: Analyze transaction CSV
    print("\n1️⃣  Transaction Monitoring Example")
    print("-" * 60)
    try:
        # Note: Replace with actual CSV path
        csv_path = "sample_transactions.csv"
        if Path(csv_path).exists():
            result = orchestrator.analyze_transactions(csv_path)
            print(f"Risk Score: {result['risk_score']:.2f}")
            print(f"Alerts: {len(result.get('alerts', []))}")
            print(f"Risk Indicators: {len(result.get('risk_indicators', []))}")
            
            # Export results
            orchestrator.export_results(result, "transaction_analysis.json")
        else:
            print(f"⚠️  CSV file not found: {csv_path}")
            print("   Create a CSV with columns: amount, entity_id, customer_id, date, etc.")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Example 2: Process regulatory circular
    print("\n2️⃣  Regulatory Watcher Example")
    print("-" * 60)
    try:
        # Example with text input
        circular_text = """
        REGULATORY CIRCULAR 2024-001
        
        Subject: Enhanced AML Reporting Requirements
        
        Effective immediately, all financial institutions must:
        1. Report transactions exceeding $10,000 within 24 hours
        2. Update KYC procedures for high-risk clients
        3. Implement enhanced due diligence for cross-border transfers
        
        Deadline: 30 days from issuance
        """
        
        result = orchestrator.process_regulatory_circular(text=circular_text)
        print(f"Risk Level: {result.get('risk_level', 'N/A')}")
        print(f"Compliance Triggers: {result.get('compliance_triggers', [])}")
        print(f"Action Items: {len(result.get('action_items', []))}")
        
        orchestrator.export_results(result, "regulatory_analysis.json")
    except Exception as e:
        print(f"❌ Error: {e}")


def example_part2_document_validation():
    """Example: Part 2 - Document Validation"""
    print("\n" + "="*60)
    print("PART 2: Document Validation Examples")
    print("="*60)
    
    orchestrator = AgentOrchestrator()
    
    # Example 1: Spell checking
    print("\n1️⃣  Spell Checker Example")
    print("-" * 60)
    try:
        sample_text = """
        Dear Sir/Madam,
        
        I am writing to submmit an application for account opening.
        Please find attached the required doccuments including my identy proof
        and address verification. I look forward to your favurable response.
        
        Best regards,
        John Smith
        """
        
        result = orchestrator.check_spelling(text=sample_text)
        print(f"Quality Score: {result.get('quality_score', 0)}/100")
        print(f"Spelling Errors: {len(result.get('spelling_errors', []))}")
        print(f"Grammar Errors: {len(result.get('grammar_errors', []))}")
        
        if result.get('spelling_errors'):
            print("\nDetected Spelling Errors:")
            for error in result['spelling_errors'][:5]:  # Show first 5
                print(f"  - '{error.get('word', 'N/A')}' → Suggestions: {error.get('suggestions', [])[:3]}")
        
        orchestrator.export_results(result, "spell_check_results.json")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Example 2: Image forensics
    print("\n2️⃣  Image Forensics Example")
    print("-" * 60)
    try:
        # Note: Replace with actual image path
        image_path = "sample_image.jpg"
        if Path(image_path).exists():
            result = orchestrator.analyze_image(image_path)
            print(f"Tampering Score: {result.get('tampering_score', 0):.2f} (0=authentic, 1=tampered)")
            print(f"Authenticity Score: {result.get('authenticity_score', 0)}/100")
            print(f"Risk Assessment: {result.get('risk_assessment', 'N/A')}")
            print(f"Anomalies Detected: {len(result.get('anomalies', []))}")
            
            orchestrator.export_results(result, "image_forensics_results.json")
        else:
            print(f"⚠️  Image file not found: {image_path}")
            print("   Provide path to an image file for analysis")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Example 3: Information validation
    print("\n3️⃣  Info Validator Example")
    print("-" * 60)
    try:
        kyc_document = """
        KYC DOCUMENT
        
        Full Name: John Michael Smith
        Date of Birth: 1985-03-15
        Nationality: British
        Address: 123 Main Street, London, SW1A 1AA, United Kingdom
        
        Identification:
        Passport Number: GB123456789
        Issued: 2020-01-01
        Expires: 2030-01-01
        
        Occupation: Financial Advisor
        Employer: ABC Financial Services Ltd
        """
        
        result = orchestrator.validate_info(
            document_text=kyc_document,
            document_type="KYC",
            required_fields=["name", "date_of_birth", "address", "id_number", "nationality"]
        )
        
        print(f"Overall Score: {result.get('overall_score', 0):.1f}/100")
        print(f"Completeness Score: {result.get('completeness_score', 0):.1f}/100")
        print(f"Accuracy Score: {result.get('accuracy_score', 0):.1f}/100")
        print(f"Found Fields: {result.get('found_fields', [])}")
        print(f"Missing Fields: {result.get('missing_fields', [])}")
        
        if result.get('inconsistencies'):
            print(f"Inconsistencies: {len(result['inconsistencies'])}")
        
        orchestrator.export_results(result, "info_validation_results.json")
    except Exception as e:
        print(f"❌ Error: {e}")


def example_audit_logs():
    """Example: Viewing audit logs"""
    print("\n" + "="*60)
    print("Audit Logs Example")
    print("="*60)
    
    orchestrator = AgentOrchestrator()
    
    # Get recent audit logs
    logs = orchestrator.get_audit_logs(limit=10)
    
    print(f"\n📋 Last {len(logs)} audit log entries:")
    print("-" * 60)
    
    for log in logs[:5]:  # Show first 5
        print(f"\n🔸 {log.get('timestamp', 'N/A')}")
        print(f"   Agent: {log.get('agent_name', 'N/A')}")
        print(f"   Action: {log.get('action', 'N/A')}")
        if log.get('risk_score'):
            print(f"   Risk Score: {log.get('risk_score', 0):.2f}")
        if log.get('alert_type'):
            print(f"   Alert: {log.get('alert_type', 'N/A')}")


def main():
    """Run all examples"""
    print("="*60)
    print("Julius Baer Agentic System - Example Usage")
    print("="*60)
    print("\nThis script demonstrates usage of all agents.")
    print("Make sure to:")
    print("  1. Set up your .env file with API keys")
    print("  2. Have sample files ready (CSV, images, PDFs)")
    print("  3. Install all dependencies: pip install -r requirements.txt")
    print()
    
    # Run Part 1 examples
    example_part1_aml_detection()
    
    # Run Part 2 examples
    example_part2_document_validation()
    
    # Show audit logs
    example_audit_logs()
    
    print("\n" + "="*60)
    print("✅ Examples completed!")
    print("="*60)
    print("\nCheck the ./outputs directory for exported results.")


if __name__ == "__main__":
    main()


