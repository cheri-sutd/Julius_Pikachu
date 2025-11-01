# Julius Baer Agentic System

A modular, scalable AI agent system built with LangChain for AML detection, compliance monitoring, and document validation.

## 🎯 Features

### Part 1: AML Detection & Compliance
- **TransactionMonitorAgent**: Analyzes transaction CSVs for AML patterns and calculates risk scores
- **RegulatoryWatcherAgent**: Monitors regulatory circulars, summarizes requirements, and identifies compliance triggers

### Part 2: Document Validation
- **SpellCheckerAgent**: Validates spelling and grammar in documents and PDFs
- **ImageForensicsAgent**: Detects image tampering and assesses authenticity
- **InfoValidatorAgent**: Validates information accuracy and completeness in documents

## 🚀 Quick Start

### 1. Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env and add your API keys:
# - GROQ_API_KEY=your_key_here (or)
# - OPENAI_API_KEY=your_key_here
```

### 2. Basic Usage

```python
from agent_orchestrator import AgentOrchestrator

# Initialize orchestrator
orchestrator = AgentOrchestrator()

# Part 1: AML Detection
result = orchestrator.analyze_transactions("transactions.csv")
print(f"Risk Score: {result['risk_score']}")

# Process regulatory circular
result = orchestrator.process_regulatory_circular(
    text="Regulatory circular text here..."
)

# Part 2: Document Validation
result = orchestrator.check_spelling(text="Document text with spelling errors...")

result = orchestrator.analyze_image("document_image.jpg")

result = orchestrator.validate_info(
    document_text="KYC document text...",
    document_type="KYC",
    required_fields=["name", "address", "id_number"]
)
```

### 3. Run Examples

```bash
python example_usage.py
```

## 📁 Project Structure

```
.
├── agents/
│   ├── __init__.py
│   ├── aml_agents.py          # Part 1: AML & Compliance agents
│   └── document_agents.py     # Part 2: Document validation agents
├── config.py                  # Configuration management
├── agent_orchestrator.py      # Main orchestrator
├── example_usage.py           # Example usage scripts
├── requirements.txt           # Python dependencies
├── .env.example              # Environment variables template
└── README.md                 # This file
```

## 🔧 Configuration

Edit `config.py` or set environment variables:

- `GROQ_API_KEY` or `OPENAI_API_KEY`: LLM API key
- `USE_GROQ`: Use Groq LPUs (True/False)
- `TEMPERATURE`: LLM temperature (default: 0.1)
- `RISK_THRESHOLD`: Risk score threshold for alerts (default: 0.7)
- `DB_PATH`: Path to memory database
- `AUDIT_LOG_PATH`: Path to audit log database

## 📊 Agent Details

### TransactionMonitorAgent

Analyzes CSV transaction files for:
- Large transactions (above 3x average)
- High-frequency transactions
- AML pattern detection (structuring, layering, placement)
- Risk scoring (0.0 - 1.0)

**Input**: CSV file path with columns: `amount`, `entity_id`, `customer_id`, `date`, etc.

**Output**: Risk score, alerts, risk indicators, LLM analysis

### RegulatoryWatcherAgent

Processes regulatory circulars to:
- Extract executive summary
- Identify compliance requirements
- Map affected areas (AML, KYC, Reporting)
- Generate action items
- Assess risk level

**Input**: URL or text content of regulatory circular

**Output**: Summary, compliance triggers, action items, deadlines

### SpellCheckerAgent

Validates documents for:
- Spelling errors with suggestions
- Grammar mistakes
- Professional language quality
- Overall quality score (0-100)

**Input**: Text string or PDF file path

**Output**: Errors list, suggestions, quality score, recommendations

### ImageForensicsAgent

Analyzes images for:
- Tampering detection (Error Level Analysis)
- Metadata validation
- Compression artifact analysis
- Authenticity assessment (0-100)

**Input**: Image file path (JPG, PNG, etc.)

**Output**: Tampering score, authenticity score, anomalies, recommendations

### InfoValidatorAgent

Validates document information for:
- Completeness (required fields present)
- Accuracy and consistency
- Internal validation
- Overall validation score (0-100)

**Input**: Document text or PDF, document type, required fields

**Output**: Completeness score, accuracy score, missing fields, inconsistencies

## 🔒 Compliance Features

- **Audit Trail**: All agent actions logged to SQLite database
- **Explainable AI**: LLM-based analysis provides reasoning
- **Risk Scoring**: Quantified risk assessments
- **Alert System**: Automatic alerts for high-risk scenarios

## 📝 Audit Logs

Access audit logs programmatically:

```python
logs = orchestrator.get_audit_logs(agent_name="TransactionMonitor", limit=100)
```

Or query the database directly at `./data/audit_logs.db`

## 🔄 Data Flow

```
User Input → AgentOrchestrator → Specific Agent → LLM Analysis
                                        ↓
                            Audit Log + Results
                                        ↓
                            JSON Export (optional)
```

## 🛠️ Dependencies

- **LangChain**: Agent orchestration and LLM integration
- **Groq/OpenAI**: LLM inference
- **Pandas**: Transaction data analysis
- **PyPDF2**: PDF text extraction
- **OpenCV/Pillow**: Image processing
- **SQLite**: Audit logging and memory

## 📄 License

Built for the Julius Baer Challenge

## 🤝 Contributing

This is a modular system - extend by adding new agents following the existing patterns.

