import os

# Document Validator API credentials
DOC_VALIDATOR_URL = os.environ.get('DOC_VALIDATOR_URL', 'https://example.com/api/doc/validate')
DOC_VALIDATOR_USERNAME = os.environ.get('DOC_VALIDATOR_USERNAME', 'dummy_user')
DOC_VALIDATOR_PASSWORD = os.environ.get('DOC_VALIDATOR_PASSWORD', 'dummy_password123')