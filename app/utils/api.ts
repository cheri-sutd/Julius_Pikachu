// API configuration
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'http://example.invalid/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`API ${path} failed: ${res.status} ${msg}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string; rows: number; csv_path: string }>(`/health`),
  flags: (params?: { customer_id?: string; customer_ids?: string[]; regulator?: string; booking_jurisdiction?: string; transaction_id?: string; resolved?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.customer_id) q.set('customer_id', params.customer_id);
    if (params?.customer_ids && params.customer_ids.length) q.set('customer_ids', params.customer_ids.join(','));
    if (params?.regulator) q.set('regulator', params.regulator);
    if (params?.booking_jurisdiction) q.set('booking_jurisdiction', params.booking_jurisdiction);
    if (params?.transaction_id) q.set('transaction_id', params.transaction_id);
    if (typeof params?.resolved === 'boolean') q.set('resolved', String(params.resolved));
    const qs = q.toString();
    return request<any[]>(`/flags${qs ? `?${qs}` : ''}`);
  },
  riskSummary: (params?: { customer_id?: string; customer_ids?: string[]; regulator?: string; booking_jurisdiction?: string }) => {
    const q = new URLSearchParams();
    if (params?.customer_id) q.set('customer_id', params.customer_id);
    if (params?.customer_ids && params.customer_ids.length) q.set('customer_ids', params.customer_ids.join(','));
    if (params?.regulator) q.set('regulator', params.regulator);
    if (params?.booking_jurisdiction) q.set('booking_jurisdiction', params.booking_jurisdiction);
    const qs = q.toString();
    return request<{ total_flagged: number; by_category: Record<string, number>; by_regulator: Record<string, number>; suspicious_indicator_hist: Record<string, number> }>(`/risk/summary${qs ? `?${qs}` : ''}`);
  },
  auditLogs: () => request<any[]>(`/audit/logs`),
  remediationTasks: () => request<any[]>(`/remediation/tasks`),
  exportFraudCsvUrl: (opts?: { resolved?: boolean }) => {
    const q = new URLSearchParams();
    if (typeof opts?.resolved === 'boolean') q.set('resolved', String(opts.resolved));
    const qs = q.toString();
    return `${API_BASE}/export/fraud.csv${qs ? `?${qs}` : ''}`;
  },
  // Monthly reports endpoints
  listMonthlyReports: () => request<any[]>(`/reports/monthly`),
  generateMonthlyReport: (month?: string) => {
    const q = new URLSearchParams();
    if (month) q.set('month', month);
    const qs = q.toString();
    return request<{ status: string }>(`/reports/generate${qs ? `?${qs}` : ''}`, { method: 'POST' });
  },
  downloadMonthlyReportUrl: (month: string, format: 'csv' | 'json') => {
    const q = new URLSearchParams();
    q.set('month', month);
    q.set('format', format);
    return `${API_BASE}/reports/download?${q.toString()}`;
  },
  resolveAlert: (transaction_id: string, note?: string) => request<{ status: string; transaction_id: string }>(`/alerts/resolve`, {
    method: 'POST',
    body: JSON.stringify({ transaction_id, note })
  }),
  listResolvedAlerts: () => request<any[]>(`/alerts/resolved`),
  // Document validator persistence
  listDocValidations: () => request<any[]>(`/doc/validations`),
  decideDocValidation: (id: string, decision: 'accept' | 'reject', note?: string) => request<{ status: string; id: string; decision: string }>(`/doc/decision`, {
    method: 'POST',
    body: JSON.stringify({ id, decision, note })
  }),
};