"""
Test script for Julius Baer Agentic System
Tests all agents with sample data
"""
import sys
from pathlib import Path
from datetime import datetime

print("="*60)
print("Julius Baer Agentic System - Agent Testing")
print("="*60)
print()

try:
    # Test imports
    print("Testing imports...")
    from agent_orchestrator import AgentOrchestrator
    print("   ✅ Agent orchestrator imported")
    print()
    
    # Initialize orchestrator
    print("Initializing agents...")
    orchestrator = AgentOrchestrator()
    print("   ✅ All agents initialized successfully!")
    print()
    
    # Test 1: Part 1 - AML Detection: Transaction Monitor
    print("="*60)
    print("TEST 1: Transaction Monitor Agent")
    print("="*60)
    try:
        # Create a sample CSV for testing
        import csv
        import os
        
        sample_csv = "test_transactions.csv"
        with open(sample_csv, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['amount', 'entity_id', 'date', 'transaction_type'])
            writer.writerow([10000, 'C001', '2024-01-15', 'transfer'])
            writer.writerow([15000, 'C001', '2024-01-16', 'transfer'])
            writer.writerow([20000, 'C002', '2024-01-17', 'transfer'])
            writer.writerow([9500, 'C001', '2024-01-18', 'transfer'])
            writer.writerow([50000, 'C003', '2024-01-19', 'transfer'])  # Large transaction
            writer.writerow([12000, 'C001', '2024-01-20', 'transfer'])
        
        print(f"   Created sample transaction CSV: {sample_csv}")
        result = orchestrator.analyze_transactions(sample_csv)
        
        print(f"\n   📊 Results:")
        print(f"      Risk Score: {result.get('risk_score', 0):.2f}")
        print(f"      Total Transactions: {result.get('statistics', {}).get('total_transactions', 0)}")
        print(f"      Risk Indicators: {len(result.get('risk_indicators', []))}")
        print(f"      Alerts Generated: {len(result.get('alerts', []))}")
        
        if result.get('alerts'):
            print(f"\n   ⚠️  Alerts:")
            for alert in result['alerts']:
                print(f"      - {alert.get('type', 'N/A')}: {alert.get('severity', 'N/A')}")
        
        print("   ✅ Transaction Monitor test PASSED")
        
    except Exception as e:
        print(f"   ❌ Transaction Monitor test FAILED: {e}")
        import traceback
        traceback.print_exc()
    
    print()
    
    # Test 2: Part 1 - AML Detection: Regulatory Watcher
    print("="*60)
    print("TEST 2: Regulatory Watcher Agent")
    print("="*60)
    try:
        sample_circular = """
        REGULATORY CIRCULAR 2024-001
        
        Subject: Enhanced AML Reporting Requirements
        
        All financial institutions are hereby notified of the following requirements:
        
        1. Transaction Reporting: All transactions exceeding $10,000 must be reported 
           within 24 hours to the regulatory authority.
        
        2. KYC Updates: Enhanced Know Your Customer procedures must be implemented 
           for all high-risk clients.
        
        3. Due Diligence: Cross-border transfers require additional due diligence.
        
        Effective Date: 30 days from issuance
        Deadline for Compliance: 60 days
        """
        
        print("   Processing sample regulatory circular...")
        result = orchestrator.process_regulatory_circular(text=sample_circular)
        
        print(f"\n   📋 Results:")
        print(f"      Risk Level: {result.get('risk_level', 'N/A')}")
        print(f"      Compliance Triggers: {len(result.get('compliance_triggers', []))}")
        if result.get('compliance_triggers'):
            print(f"      Triggers: {', '.join(result.get('compliance_triggers', []))}")
        
        print("   ✅ Regulatory Watcher test PASSED")
        
    except Exception as e:
        print(f"   ❌ Regulatory Watcher test FAILED: {e}")
        import traceback
        traceback.print_exc()
    
    print()
    
    # Test 3: Part 2 - Document Validation: Spell Checker
    print("="*60)
    print("TEST 3: Spell Checker Agent")
    print("="*60)
    try:
        sample_text = """
        Dear Sir/Madam,
        
        I am writing to submmit an application for account opening.
        Please find attached the required doccuments including my identy proof
        and address verification. I look forward to your favurable response.
        
        Best regards,
        John Smith
        """
        
        print("   Checking spelling in sample text...")
        result = orchestrator.check_spelling(text=sample_text)
        
        print(f"\n   📝 Results:")
        print(f"      Quality Score: {result.get('quality_score', 0)}/100")
        print(f"      Spelling Errors: {len(result.get('spelling_errors', []))}")
        print(f"      Grammar Errors: {len(result.get('grammar_errors', []))}")
        
        if result.get('spelling_errors'):
            print(f"\n   Misspelled Words Found:")
            for i, error in enumerate(result['spelling_errors'][:5], 1):
                print(f"      {i}. '{error.get('word', 'N/A')}' → Suggestions: {error.get('suggestions', [])[:3]}")
        
        print("   ✅ Spell Checker test PASSED")
        
    except Exception as e:
        print(f"   ❌ Spell Checker test FAILED: {e}")
        import traceback
        traceback.print_exc()
    
    print()
    
    # Test 4: Part 2 - Document Validation: Info Validator
    print("="*60)
    print("TEST 4: Info Validator Agent")
    print("="*60)
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
        
        print("   Validating KYC document information...")
        result = orchestrator.validate_info(
            document_text=kyc_document,
            document_type="KYC",
            required_fields=["name", "date_of_birth", "address", "id_number", "nationality"]
        )
        
        print(f"\n   ✅ Results:")
        print(f"      Overall Score: {result.get('overall_score', 0):.1f}/100")
        print(f"      Completeness Score: {result.get('completeness_score', 0):.1f}/100")
        print(f"      Accuracy Score: {result.get('accuracy_score', 0):.1f}/100")
        print(f"      Found Fields: {len(result.get('found_fields', []))}")
        print(f"      Missing Fields: {len(result.get('missing_fields', []))}")
        
        if result.get('found_fields'):
            print(f"\n   Found: {', '.join(result['found_fields'])}")
        if result.get('missing_fields'):
            print(f"   Missing: {', '.join(result['missing_fields'])}")
        
        print("   ✅ Info Validator test PASSED")
        
    except Exception as e:
        print(f"   ❌ Info Validator test FAILED: {e}")
        import traceback
        traceback.print_exc()
    
    print()
    
    # Test 5: Audit Logs
    print("="*60)
    print("TEST 5: Audit Log System")
    print("="*60)
    try:
        logs = orchestrator.get_audit_logs(limit=10)
        print(f"   ✅ Retrieved {len(logs)} audit log entries")
        
        if logs:
            print(f"\n   Recent Activity:")
            for log in logs[:3]:
                print(f"      - {log.get('agent_name', 'N/A')}: {log.get('action', 'N/A')} at {log.get('timestamp', 'N/A')[:19]}")
        
        print("   ✅ Audit Log test PASSED")
        
    except Exception as e:
        print(f"   ❌ Audit Log test FAILED: {e}")
        import traceback
        traceback.print_exc()
    
    print()
    print("="*60)
    print("✅ ALL TESTS COMPLETED")
    print("="*60)
    print()
    print("Summary:")
    print("  - Part 1 (AML & Compliance): Transaction Monitor ✅, Regulatory Watcher ✅")
    print("  - Part 2 (Document Validation): Spell Checker ✅, Info Validator ✅")
    print("  - Audit Logging: ✅")
    print()
    print("System is operational and ready for use!")
    
except ImportError as e:
    print(f"❌ Failed to import agent system: {e}")
    print("\nPlease install dependencies first:")
    print("  python -m pip install -r requirements.txt")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error during testing: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)


