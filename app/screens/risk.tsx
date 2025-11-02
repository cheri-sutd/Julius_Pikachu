import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { api } from '../utils/api';

export default function RiskScoring() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    total_flagged: number;
    by_category: Record<string, number>;
    by_regulator: Record<string, number>;
    suspicious_indicator_hist: Record<string, number>;
  } | null>(null);

  // controls
  const [topN] = useState(8);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.riskSummary();
        if (mounted) setSummary(data);
      } catch (e: any) {
        setError(e?.message || 'Failed to load risk summary');
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // helpers to transform and filter
  const sortDesc = (entries: [string, number][]) => entries.sort((a, b) => b[1] - a[1]);
  const limitTopN = (entries: [string, number][]) => entries.slice(0, Math.max(1, topN));
  const maxVal = (entries: [string, number][]) => entries.reduce((m, [, v]) => Math.max(m, v), 0) || 1;

  const catData = useMemo(() => {
    if (!summary) return [] as [string, number][];
    return limitTopN(sortDesc(Object.entries(summary.by_category)));
  }, [summary, topN]);
  const regData = useMemo(() => {
    if (!summary) return [] as [string, number][];
    return limitTopN(sortDesc(Object.entries(summary.by_regulator)));
  }, [summary, topN]);
  const indData = useMemo(() => {
    if (!summary) return [] as [string, number][];
    return limitTopN(sortDesc(Object.entries(summary.suspicious_indicator_hist)));
  }, [summary, topN]);

  const BarList = ({ data, color, sectionKey }: { data: [string, number][]; color: string; sectionKey: string }) => {
    const max = maxVal(data);
    return (
      <View>
        {data.map(([label, value]) => {
          const key = `${sectionKey}:${label}`;
          const pct = Math.max(4, Math.round((value / max) * 100));
          return (
            <View key={label}>
              <Pressable style={styles.barRow} onPress={() => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))}>
                <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                </View>
                <Text style={styles.barValue}>{value}</Text>
              </Pressable>
              {expanded[key] && (
                <View style={styles.detailsBox}>
                  {sectionKey === 'cat' && (
                    <>
                      <Text style={styles.detailsText}>• High-risk clients: ABC Corp, XYZ Ltd, Global Trading Inc</Text>
                      <Text style={styles.detailsText}>• Transaction types: Large cash deposits, wire transfers to high-risk jurisdictions</Text>
                      <Text style={styles.detailsText}>• Common patterns: Structuring, unusual transaction timing</Text>
                    </>
                  )}
                  {sectionKey === 'reg' && (
                    <>
                      <Text style={styles.detailsText}>• Regulated entities: First National Bank, Metro Credit Union</Text>
                      <Text style={styles.detailsText}>• Compliance issues: KYC documentation gaps, delayed reporting</Text>
                      <Text style={styles.detailsText}>• Key violations: BSA reporting thresholds, customer due diligence</Text>
                    </>
                  )}
                  {sectionKey === 'ind' && (
                    <>
                      <Text style={styles.detailsText}>• Flagged accounts: Account #12345, #67890, #54321</Text>
                      <Text style={styles.detailsText}>• Alert triggers: Velocity checks, geographic anomalies, amount thresholds</Text>
                      <Text style={styles.detailsText}>• Risk factors: PEP connections, sanctions screening hits</Text>
                    </>
                  )}
                  <Text style={styles.detailsHint}>Detailed transaction records available in Audit Trail section.</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const PieChart = ({ data, colors }: { data: [string, number][]; colors: string[] }) => {
    const total = data.reduce((s, [, v]) => s + v, 0) || 1;
    const size = 180;
    const stroke = 28;
    const r = (size - stroke) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const C = 2 * Math.PI * r;
    let offset = 0;
    return (
      <View style={styles.pieWrap}>
        <Svg width={size} height={size}>
          {data.map(([label, value], i) => {
            const seg = (value / total) * C;
            const dasharray = `${seg} ${C - seg}`;
            const circle = (
              <Circle
                key={label}
                cx={cx}
                cy={cy}
                r={r}
                stroke={colors[i % colors.length]}
                strokeWidth={stroke}
                strokeDasharray={dasharray}
                strokeDashoffset={offset}
                fill="none"
              />
            );
            offset += seg;
            return circle;
          })}
        </Svg>
        <View style={styles.legend}>
          {data.map(([label, value], i) => (
            <View key={label} style={styles.legendRow}>
              <View style={[styles.legendSwatch, { backgroundColor: colors[i % colors.length] }]} />
              <Text style={styles.legendText} numberOfLines={1}>{label}</Text>
              <Text style={styles.legendValue}>{Math.round((value / total) * 100)}%</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Risk Scoring</Text>
      {loading && <ActivityIndicator />}
      {error && <Text style={styles.error}>{error}</Text>}
      {!loading && !error && summary && (
        <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
          <View style={styles.panel}>
            <Text style={styles.section}>Totals</Text>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Flagged transactions</Text>
              <Text style={styles.kpiValue}>{summary.total_flagged}</Text>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.section}>By Category</Text>
            <PieChart data={catData} colors={["#1a73e8", "#4fc3f7", "#1565c0", "#90caf9", "#0d47a1"]} />
            <BarList data={catData} color="#1a73e8" sectionKey="cat" />
          </View>

          <View style={styles.panel}>
            <Text style={styles.section}>Top Regulators</Text>
            <PieChart data={regData} colors={["#34a853", "#66bb6a", "#1b5e20", "#a5d6a7", "#2e7d32"]} />
            <BarList data={regData} color="#34a853" sectionKey="reg" />
          </View>

          <View style={styles.panel}>
            <Text style={styles.section}>Suspicious Indicators</Text>
            <PieChart data={indData} colors={["#fbbc05", "#ffd54f", "#f57f17", "#ffe082", "#ffa000"]} />
            <BarList data={indData} color="#fbbc05" sectionKey="ind" />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 8, padding: 16 },
  title: { fontSize: 22, fontFamily: 'Inter-SemiBold', marginBottom: 8 },
  section: { fontSize: 16, fontFamily: 'Inter-Medium', marginTop: 12, marginBottom: 6 },
  body: { fontSize: 14, fontFamily: 'Inter-Regular' },
  error: { color: '#b00020', marginTop: 8 },
  panel: { marginTop: 8 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { borderColor: '#ddd', borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, flexGrow: 1, minWidth: 160 },
  kpiBox: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  kpiLabel: { fontSize: 14, color: '#666' },
  kpiValue: { fontSize: 24, fontFamily: 'Inter-SemiBold' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  barLabel: { flexBasis: 160, flexShrink: 1 },
  barTrack: { flex: 1, height: 18, backgroundColor: '#eee', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: 18, borderRadius: 999 },
  barValue: { width: 40, textAlign: 'right', fontFamily: 'Inter-Regular' },
  // newly added styles for dropdown details and pie chart legend
  detailsBox: { marginTop: 6, backgroundColor: '#f7f7f7', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#eee' },
  detailsText: { fontSize: 13, color: '#333' },
  detailsHint: { fontSize: 12, color: '#777', marginTop: 4 },
  pieWrap: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 8 },
  legend: { minWidth: 160, flexGrow: 1 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  legendSwatch: { width: 12, height: 12, borderRadius: 2 },
  legendText: { flex: 1, fontSize: 13 },
  legendValue: { width: 44, textAlign: 'right', fontSize: 13 },
});