"""
Run full test suite and save results
"""
import sys
import json
from datetime import datetime
from pathlib import Path

print("="*60)
print("Julius Baer Agentic System - Full Test Suite")
print("="*60)
print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print()

# Redirect output to both console and file
log_file = Path("outputs") / f"test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"

class TeeOutput:
    """Write to both console and file"""
    def __init__(self, file_path):
        self.file = open(file_path, 'w', encoding='utf-8')
        self.stdout = sys.stdout
        
    def write(self, text):
        self.stdout.write(text)
        self.file.write(text)
        self.file.flush()
        
    def flush(self):
        self.stdout.flush()
        self.file.flush()
        
    def close(self):
        self.file.close()

# Setup output tee
tee = TeeOutput(log_file)

try:
    # Import and run tests
    from test_agents import *
    
    # Override print to use tee
    original_print = print
    def print(*args, **kwargs):
        output = ' '.join(str(arg) for arg in args)
        tee.write(output + '\n')
        if kwargs.get('end') != '':
            tee.write('\n')
    
    # Run main test
    exec(open('test_agents.py').read())
    
except KeyboardInterrupt:
    print("\n\nTest interrupted by user")
except Exception as e:
    print(f"\n\nError: {e}")
    import traceback
    traceback.print_exc()
finally:
    tee.close()
    print(f"\n{'='*60}")
    print(f"Test log saved to: {log_file}")
    print(f"Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)

