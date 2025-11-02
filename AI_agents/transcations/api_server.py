from fastapi import FastAPI, Query, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
import pandas as pd
import io
import os
import requests
from datetime import datetime, timedelta
import threading
import time
import uuid
import json

from .aml_detection_agent import AMLDetectionAgent
from .secrets import DOC_VALIDATOR_URL, DOC_VALIDATOR_USERNAME, DOC_VALIDATOR_PASSWORD


CSV_PATH = os.environ.get(
    "CLIENT_DATA_CSV",
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "client_data", "transactions_mock_1000_for_participants.csv"),
)

app = FastAPI(title="AML Detection API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


df_raw: pd.DataFrame | None = None
df_scored: pd.DataFrame | None = None
agent: AMLDetectionAgent | None = None
resolved_alerts: dict[str, dict] = {}

RETENTION_DAYS = 30
REPORT_RETENTION_DAYS = 365

# Monthly report storage under project root
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
REPORTS_DIR = os.path.join(PROJECT_ROOT, "reports", "monthly")
STORAGE_DIR = os.path.join(PROJECT_ROOT, "storage")
DOC_VALIDATIONS_PATH = os.path.join(STORAGE_DIR, "doc_validations.json")

def ensure_reports_dir() -> None:
    try:
        os.makedirs(REPORTS_DIR, exist_ok=True)
    except Exception:
        pass

def ensure_storage_dir() -> None:
    try:
        os.makedirs(STORAGE_DIR, exist_ok=True)
    except Exception:
        pass

def month_key(dt: datetime) -> str:
    return dt.strftime("%Y-%m")

def monthly_report_exists(month: str) -> bool:
    csv_path = os.path.join(REPORTS_DIR, f"{month}.csv")
    json_path = os.path.join(REPORTS_DIR, f"{month}.json")
    return os.path.exists(csv_path) and os.path.exists(json_path)

def purge_old_monthly_reports() -> None:
    """Delete monthly reports older than REPORT_RETENTION_DAYS based on file mtime."""
    try:
        ensure_reports_dir()
        cutoff = time.time() - REPORT_RETENTION_DAYS * 24 * 3600
        for name in os.listdir(REPORTS_DIR):
            if not (name.endswith('.csv') or name.endswith('.json')):
                continue
            path = os.path.join(REPORTS_DIR, name)
            try:
                mtime = os.path.getmtime(path)
                if mtime < cutoff:
                    os.remove(path)
            except Exception:
                pass
    except Exception:
        # Non-fatal
        pass

def generate_monthly_report(month: str | None = None) -> dict:
    """Create monthly report CSV and JSON summary for the given month (UTC)."""
    if df_scored is None:
        raise RuntimeError("Data not loaded")
    ensure_reports_dir()
    # Default to current month (UTC)
    if not month:
        month = month_key(datetime.utcnow())

    # Snapshot flagged transactions and annotate resolution
    flagged = df_scored[df_scored["is_suspicious"] == 1].copy()
    flagged = flagged.copy()
    try:
        flagged["resolved"] = flagged["transaction_id"].astype(str).isin(set(resolved_alerts.keys()))
    except Exception:
        flagged["resolved"] = False

    # Write CSV snapshot
    csv_path = os.path.join(REPORTS_DIR, f"{month}.csv")
    try:
        flagged.to_csv(csv_path, index=False)
    except Exception:
        # If CSV writing fails, still proceed with JSON summary
        pass

    # Produce JSON summary counts
    total = int(flagged.shape[0])
    resolved_count = int(getattr(flagged[flagged["resolved"] == True], 'shape', [0])[0]) if "resolved" in flagged.columns else 0
    unresolved_count = total - resolved_count
    by_regulator = (
        flagged["regulator"].value_counts(dropna=False).to_dict()
        if "regulator" in flagged.columns
        else {}
    )
    by_category = (
        flagged["risk_category"].value_counts(dropna=False).to_dict()
        if "risk_category" in flagged.columns
        else {}
    )
    summary = {
        "month": month,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "total_flagged": total,
        "resolved": resolved_count,
        "unresolved": unresolved_count,
        "by_regulator": by_regulator,
        "by_category": by_category,
    }
    json_path = os.path.join(REPORTS_DIR, f"{month}.json")
    try:
        import json
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(summary, f)
    except Exception:
        pass
    return {"csv_path": csv_path, "json_path": json_path, **summary}

def list_monthly_reports() -> list[dict]:
    ensure_reports_dir()
    reports: dict[str, dict] = {}
    try:
        for name in os.listdir(REPORTS_DIR):
            if name.endswith('.json'):
                month = name.replace('.json', '')
                try:
                    import json
                    with open(os.path.join(REPORTS_DIR, name), 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    reports[month] = {**data}
                except Exception:
                    # If JSON unreadable, at least return minimal info
                    reports[month] = {"month": month}
        # Add CSV availability and URLs
        for m, rep in reports.items():
            rep["csv_url"] = f"/api/reports/download?month={m}&format=csv"
            rep["json_url"] = f"/api/reports/download?month={m}&format=json"
        # Sort by month desc
        return sorted(reports.values(), key=lambda r: r.get("month", ""), reverse=True)
    except Exception:
        return []

def report_scheduler() -> None:
    """Background loop: ensure current month report exists and purge old ones."""
    while True:
        try:
            ensure_reports_dir()
            purge_old_monthly_reports()
            purge_old_resolved_alerts()
            current_month = month_key(datetime.utcnow())
            if not monthly_report_exists(current_month):
                try:
                    generate_monthly_report(current_month)
                except Exception:
                    pass
        except Exception:
            # Non-fatal
            pass
        # Check hourly
        time.sleep(3600)


# Document validation persistence
doc_validations: list[dict] = []

def load_doc_validations() -> None:
    global doc_validations
    try:
        ensure_storage_dir()
        if os.path.exists(DOC_VALIDATIONS_PATH):
            with open(DOC_VALIDATIONS_PATH, "r", encoding="utf-8") as f:
                doc_validations = json.load(f) or []
        else:
            doc_validations = []
    except Exception:
        doc_validations = []

def save_doc_validations() -> None:
    try:
        ensure_storage_dir()
        with open(DOC_VALIDATIONS_PATH, "w", encoding="utf-8") as f:
            json.dump(doc_validations, f)
    except Exception:
        pass

def purge_old_resolved_alerts() -> None:
    """Remove resolved alerts older than RETENTION_DAYS."""
    try:
        cutoff = datetime.utcnow() - timedelta(days=RETENTION_DAYS)
        to_delete: list[str] = []
        for tid, meta in resolved_alerts.items():
            ts = str(meta.get("resolved_at") or "")
            dt = None
            try:
                # Allow ISO strings with trailing Z
                dt = datetime.fromisoformat(ts.replace("Z", ""))
            except Exception:
                dt = None
            if dt is None or dt < cutoff:
                to_delete.append(tid)
        for tid in to_delete:
            try:
                del resolved_alerts[tid]
            except Exception:
                pass
    except Exception:
        # Non-fatal
        pass


def load_and_score() -> None:
    global df_raw, df_scored, agent
    df_raw = pd.read_csv(CSV_PATH, low_memory=False)
    # Use only the first 100 transactions to limit dataset size
    try:
        df_raw = df_raw.iloc[:100].copy()
    except Exception:
        # If slicing fails for any reason, proceed with original frame
        pass
    agent = AMLDetectionAgent(high_amount_threshold_percentile=95)
    results_df = agent.process_dataframe(df_raw)
    # Merge results into original frame for ease of filtering downstream
    df_scored = df_raw.copy()
    df_scored = df_scored.merge(results_df, on="transaction_id", how="left")
    # Ensure expected columns exist
    for col in [
        "is_suspicious",
        "risk_category",
        "suspicious_detection_count",
        "high_risk_detected",
        "reasons",
    ]:
        if col not in df_scored.columns:
            df_scored[col] = None


@app.on_event("startup")
def startup_event():
    load_and_score()
    purge_old_resolved_alerts()
    load_doc_validations()
    # Start monthly report scheduler in a daemon thread
    try:
        t = threading.Thread(target=report_scheduler, daemon=True)
        t.start()
    except Exception:
        # Non-fatal
        pass


@app.get("/api/health")
def health():
    size = 0 if df_scored is None else len(df_scored)
    return {"status": "ok", "rows": size, "csv_path": CSV_PATH}


@app.get("/api/flags")
def get_flags(
    customer_id: str | None = Query(default=None),
    customer_ids: str | None = Query(default=None, description="Comma-separated list of customer IDs"),
    regulator: str | None = Query(default=None),
    booking_jurisdiction: str | None = Query(default=None),
    transaction_id: str | None = Query(default=None),
    resolved: bool | None = Query(default=None, description="Filter by resolved status: true/false"),
):
    if df_scored is None:
        return JSONResponse(status_code=500, content={"error": "Data not loaded"})

    # Enforce retention window for resolved alerts
    purge_old_resolved_alerts()

    df = df_scored[df_scored["is_suspicious"] == 1].copy()
    # Filter by transaction_id if provided (exact match)
    if transaction_id:
        df = df[df["transaction_id"].astype(str) == str(transaction_id)]
    # Filter by a single customer_id
    if customer_id:
        df = df[df["customer_id"].astype(str) == str(customer_id)]
    # Or by a list of customer_ids (comma-separated)
    if customer_ids:
        ids = [x.strip() for x in customer_ids.split(",") if x.strip()]
        if len(ids) > 0:
            df = df[df["customer_id"].astype(str).isin(ids)]
    if regulator:
        df = df[df["regulator"].astype(str).str.lower() == regulator.lower()]
    if booking_jurisdiction:
        df = df[df["booking_jurisdiction"].astype(str).str.lower() == booking_jurisdiction.lower()]

    # Filter by resolved status if requested
    if resolved is not None:
        if resolved:
            df = df[df["transaction_id"].astype(str).isin(set(resolved_alerts.keys()))]
        else:
            df = df[~df["transaction_id"].astype(str).isin(set(resolved_alerts.keys()))]

    cols = [
        "transaction_id",
        "amount",
        "currency",
        "regulator",
        "booking_jurisdiction",
        "customer_id",
        "customer_risk_rating",
        "risk_category",
        "suspicious_detection_count",
        "reasons",
        "booking_datetime",
    ]
    present_cols = [c for c in cols if c in df.columns]
    records = df[present_cols].head(500).to_dict(orient="records")
    # annotate with resolved flag
    for r in records:
        tid = str(r.get("transaction_id"))
        r["resolved"] = tid in resolved_alerts
    return records


@app.get("/api/risk/summary")
def risk_summary(
    customer_id: str | None = Query(default=None),
    customer_ids: str | None = Query(default=None, description="Comma-separated list of customer IDs"),
    regulator: str | None = Query(default=None),
    booking_jurisdiction: str | None = Query(default=None),
):
    if df_scored is None:
        return JSONResponse(status_code=500, content={"error": "Data not loaded"})

    flagged = df_scored[df_scored["is_suspicious"] == 1].copy()
    if customer_id:
        flagged = flagged[flagged["customer_id"].astype(str) == str(customer_id)]
    if customer_ids:
        ids = [x.strip() for x in customer_ids.split(",") if x.strip()]
        if len(ids) > 0:
            flagged = flagged[flagged["customer_id"].astype(str).isin(ids)]
    if regulator:
        flagged = flagged[flagged["regulator"].astype(str).str.lower() == regulator.lower()]
    if booking_jurisdiction:
        flagged = flagged[flagged["booking_jurisdiction"].astype(str).str.lower() == booking_jurisdiction.lower()]
    by_category = (
        flagged["risk_category"].value_counts(dropna=False).to_dict()
        if "risk_category" in flagged.columns
        else {}
    )
    by_regulator = (
        flagged["regulator"].value_counts(dropna=False).head(10).to_dict()
        if "regulator" in flagged.columns
        else {}
    )
    suspicious_hist = (
        flagged["suspicious_detection_count"].value_counts().sort_index().to_dict()
        if "suspicious_detection_count" in flagged.columns
        else {}
    )
    total = int(flagged.shape[0])
    return {
        "total_flagged": total,
        "by_category": by_category,
        "by_regulator": by_regulator,
        "suspicious_indicator_hist": suspicious_hist,
    }


@app.get("/api/audit/logs")
def audit_logs():
    if df_scored is None:
        return JSONResponse(status_code=500, content={"error": "Data not loaded"})
    flagged = df_scored[df_scored["is_suspicious"] == 1]
    logs = []
    for _, row in flagged.iterrows():
        logs.append(
            {
                "transaction_id": row.get("transaction_id"),
                "event": row.get("reasons") or "Suspicion flagged",
                "regulator": row.get("regulator"),
                "booking_jurisdiction": row.get("booking_jurisdiction"),
                "amount": row.get("amount"),
                "currency": row.get("currency"),
                "timestamp": row.get("booking_datetime") or "",
            }
        )
    return logs[:500]


@app.get("/api/remediation/tasks")
def remediation_tasks():
    if df_scored is None:
        return JSONResponse(status_code=500, content={"error": "Data not loaded"})
    flagged = df_scored[df_scored["is_suspicious"] == 1]
    tasks = []
    for _, row in flagged.iterrows():
        reasons = str(row.get("reasons") or "")
        recommended = []
        if "EDD" in reasons or str(row.get("edd_required", "")).upper() == "TRUE":
            recommended.append("Perform Enhanced Due Diligence (EDD)")
        if "sanctions" in reasons.lower():
            recommended.append("Run sanctions screening and clear false positives")
        if "SOW" in reasons or str(row.get("sow_documented", "")).upper() == "FALSE":
            recommended.append("Obtain Source of Wealth documentation")
        if "high amount" in reasons.lower():
            recommended.append("Validate unusual amount with client and justification")

        tasks.append(
            {
                "transaction_id": row.get("transaction_id"),
                "risk_category": row.get("risk_category"),
                "actions": recommended or ["Review case details and document outcome"],
                "customer_id": row.get("customer_id"),
                "regulator": row.get("regulator"),
            }
        )
    return tasks[:500]


@app.get("/api/export/fraud.csv")
def export_fraud_csv(resolved: bool | None = Query(default=None, description="Filter by resolved status: true/false; default excludes resolved")):
    if df_scored is None:
        return JSONResponse(status_code=500, content={"error": "Data not loaded"})
    purge_old_resolved_alerts()
    flagged = df_scored[df_scored["is_suspicious"] == 1].copy()
    # Apply resolution filter: default to unresolved only if not specified
    try:
        if resolved is None or resolved is False:
            flagged = flagged[~flagged["transaction_id"].astype(str).isin(set(resolved_alerts.keys()))]
        elif resolved is True:
            flagged = flagged[flagged["transaction_id"].astype(str).isin(set(resolved_alerts.keys()))]
    except Exception:
        # If any failure in filtering, fall back to original flagged
        pass
    buf = io.StringIO()
    flagged.to_csv(buf, index=False)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=fraud_transactions.csv"}
    )


# Monthly reports endpoints
@app.get("/api/reports/monthly")
def reports_monthly_list():
    try:
        purge_old_monthly_reports()
    except Exception:
        pass
    return list_monthly_reports()


@app.post("/api/reports/generate")
def reports_generate(month: str | None = Query(default=None)):
    try:
        purge_old_monthly_reports()
        if month is None:
            month = month_key(datetime.utcnow())
        # If already exists, return summary
        if monthly_report_exists(month):
            return JSONResponse(status_code=200, content={"status": "exists", "month": month})
        rep = generate_monthly_report(month)
        return {"status": "generated", **rep}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate monthly report: {e}")


@app.get("/api/reports/download")
def reports_download(month: str = Query(...), format: str = Query(..., regex="^(csv|json)$")):
    ensure_reports_dir()
    if format == "csv":
        path = os.path.join(REPORTS_DIR, f"{month}.csv")
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail="Report CSV not found")
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        buf = io.StringIO(content)
        buf.seek(0)
        return StreamingResponse(buf, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=report_{month}.csv"})
    else:
        path = os.path.join(REPORTS_DIR, f"{month}.json")
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail="Report JSON not found")
        try:
            import json
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return JSONResponse(status_code=200, content=data)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read report: {e}")


# Document validation proxy credentials are centralized in secrets.py


@app.post("/api/doc/validate")
async def doc_validate(file: UploadFile = File(...)):
    try:
        content = await file.read()
        files = {
            "file": (
                file.filename or "upload",
                content,
                file.content_type or "application/octet-stream",
            )
        }
        primary_url = DOC_VALIDATOR_URL
        resp = requests.post(
            primary_url,
            files=files,
            auth=(DOC_VALIDATOR_USERNAME, DOC_VALIDATOR_PASSWORD),
            timeout=30,
        )
        # Fallback: if using n8n test webhook and not registered, try production webhook path
        if resp.status_code == 404 and "/webhook-test/" in (primary_url or ""):
            alt_url = primary_url.replace("/webhook-test/", "/webhook/")
            try:
                resp = requests.post(
                    alt_url,
                    files=files,
                    auth=(DOC_VALIDATOR_USERNAME, DOC_VALIDATOR_PASSWORD),
                    timeout=30,
                )
            except Exception:
                # If fallback also fails, keep original response
                pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Proxy upload failed: {e}")

    try:
        data = resp.json()
    except Exception:
        data = {"raw": resp.text}

    if resp.status_code >= 400:
        return JSONResponse(status_code=resp.status_code, content={"error": "upstream_error", "detail": data})

    # Persist validation result entry
    try:
        ensure_storage_dir()
        entry = {
            "id": str(uuid.uuid4()),
            "filename": file.filename or "upload",
            "uploaded_at": datetime.utcnow().isoformat() + "Z",
            "upstream": data,
            "decision": "pending",
            "decision_note": "",
            "decided_at": None,
        }
        doc_validations.append(entry)
        save_doc_validations()
        return JSONResponse(status_code=200, content={"status": "ok", "upstream": data, "validation_id": entry["id"]})
    except Exception:
        # If persistence fails, still return success
        return JSONResponse(status_code=200, content={"status": "ok", "upstream": data})


@app.get("/api/doc/validations")
def doc_validations_list():
    try:
        load_doc_validations()
    except Exception:
        pass
    # Return most recent first
    try:
        return sorted(doc_validations, key=lambda x: x.get("uploaded_at", ""), reverse=True)
    except Exception:
        return doc_validations


@app.post("/api/doc/decision")
def doc_validation_decide(id: str = Body(..., embed=True), decision: str = Body(..., embed=True), note: str | None = Body(default=None)):
    if decision not in ("accept", "reject"):
        raise HTTPException(status_code=400, detail="Decision must be 'accept' or 'reject'")
    try:
        found = None
        for v in doc_validations:
            if v.get("id") == id:
                found = v
                break
        if not found:
            raise HTTPException(status_code=404, detail="Validation entry not found")
        found["decision"] = decision
        found["decision_note"] = note or ""
        found["decided_at"] = datetime.utcnow().isoformat() + "Z"
        save_doc_validations()
        return {"status": "updated", "id": id, "decision": decision}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save decision: {e}")


@app.post("/api/alerts/resolve")
def resolve_alert(
    transaction_id: str = Body(..., embed=True),
    note: str | None = Body(default=None),
):
    # Validate transaction exists and is flagged
    if df_scored is None:
        return JSONResponse(status_code=500, content={"error": "Data not loaded"})
    tid = str(transaction_id)
    exists = False
    try:
        exists = any(df_scored[df_scored["is_suspicious"] == 1]["transaction_id"].astype(str) == tid)
    except Exception:
        exists = False
    if not exists:
        raise HTTPException(status_code=404, detail=f"Alert for transaction {tid} not found or not suspicious")
    resolved_alerts[tid] = {
        "note": note or "",
        "resolved_at": datetime.utcnow().isoformat() + "Z",
    }
    return {"status": "resolved", "transaction_id": tid}


@app.get("/api/alerts/resolved")
def list_resolved_alerts():
    purge_old_resolved_alerts()
    return [{"transaction_id": tid, **meta} for tid, meta in resolved_alerts.items()]


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("AML_API_PORT", "8001"))
    uvicorn.run("AI_agents.transcations.api_server:app", host="0.0.0.0", port=port, reload=False)