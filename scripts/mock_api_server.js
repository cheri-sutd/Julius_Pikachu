const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.AML_API_PORT ? Number(process.env.AML_API_PORT) : 8001;

// Sample data
const sampleFlags = [
  {
    transaction_id: 'TXN-1001',
    amount: 15000,
    currency: 'USD',
    regulator: 'SEC',
    booking_jurisdiction: 'US',
    customer_id: 'CUST-01',
    customer_risk_rating: 'High',
    risk_category: 'High Amount',
    suspicious_detection_count: 2,
    reasons: 'High amount; EDD required',
    booking_datetime: '2024-10-01T10:00:00Z',
  },
  {
    transaction_id: 'TXN-1002',
    amount: 3200,
    currency: 'EUR',
    regulator: 'ESMA',
    booking_jurisdiction: 'FR',
    customer_id: 'CUST-02',
    customer_risk_rating: 'Medium',
    risk_category: 'Sanctions',
    suspicious_detection_count: 1,
    reasons: 'Possible sanctions hit',
    booking_datetime: '2024-10-02T11:30:00Z',
  },
  {
    transaction_id: 'TXN-2001',
    amount: 5000,
    currency: 'GBP',
    regulator: 'FCA',
    booking_jurisdiction: 'UK',
    customer_id: 'CUST-03',
    customer_risk_rating: 'Low',
    risk_category: 'Structuring',
    suspicious_detection_count: 3,
    reasons: 'Structuring indicators across multiple days',
    booking_datetime: '2024-10-03T09:45:00Z',
  },
];

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', rows: sampleFlags.length, csv_path: 'mock' });
});

app.get('/api/flags', (req, res) => {
  const { customer_id, customer_ids, regulator, booking_jurisdiction, transaction_id } = req.query;
  let data = [...sampleFlags];
  if (transaction_id) {
    data = data.filter((d) => String(d.transaction_id) === String(transaction_id));
  }
  if (customer_id) {
    data = data.filter((d) => String(d.customer_id) === String(customer_id));
  }
  if (customer_ids) {
    const ids = String(customer_ids)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (ids.length) {
      data = data.filter((d) => ids.includes(String(d.customer_id)));
    }
  }
  if (regulator) {
    data = data.filter((d) => String(d.regulator).toLowerCase() === String(regulator).toLowerCase());
  }
  if (booking_jurisdiction) {
    data = data.filter((d) => String(d.booking_jurisdiction).toLowerCase() === String(booking_jurisdiction).toLowerCase());
  }
  res.json(data);
});

app.get('/api/risk/summary', (req, res) => {
  const by_category = {};
  const by_regulator = {};
  const suspicious_indicator_hist = {};
  sampleFlags.forEach((f) => {
    by_category[f.risk_category] = (by_category[f.risk_category] || 0) + 1;
    by_regulator[f.regulator] = (by_regulator[f.regulator] || 0) + 1;
    suspicious_indicator_hist[f.suspicious_detection_count] = (suspicious_indicator_hist[f.suspicious_detection_count] || 0) + 1;
  });
  res.json({
    total_flagged: sampleFlags.length,
    by_category,
    by_regulator,
    suspicious_indicator_hist,
  });
});

app.get('/api/audit/logs', (req, res) => {
  const logs = sampleFlags.map((row) => ({
    transaction_id: row.transaction_id,
    event: row.reasons,
    regulator: row.regulator,
    booking_jurisdiction: row.booking_jurisdiction,
    amount: row.amount,
    currency: row.currency,
    timestamp: row.booking_datetime,
  }));
  res.json(logs);
});

app.get('/api/remediation/tasks', (req, res) => {
  const tasks = sampleFlags.map((row) => ({
    transaction_id: row.transaction_id,
    risk_category: row.risk_category,
    actions: ['Review case details and document outcome'],
    customer_id: row.customer_id,
    regulator: row.regulator,
  }));
  res.json(tasks);
});

app.get('/api/export/fraud.csv', (req, res) => {
  const header = 'transaction_id,amount,currency,regulator,booking_jurisdiction,customer_id,customer_risk_rating,risk_category,suspicious_detection_count,reasons,booking_datetime\n';
  const rows = sampleFlags
    .map((r) => [
      r.transaction_id,
      r.amount,
      r.currency,
      r.regulator,
      r.booking_jurisdiction,
      r.customer_id,
      r.customer_risk_rating,
      r.risk_category,
      r.suspicious_detection_count,
      JSON.stringify(r.reasons),
      r.booking_datetime,
    ].join(','))
    .join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=fraud_transactions.csv');
  res.send(header + rows);
});

app.listen(PORT, () => {
  console.log(`[mock-api] Listening on http://127.0.0.1:${PORT}`);
});