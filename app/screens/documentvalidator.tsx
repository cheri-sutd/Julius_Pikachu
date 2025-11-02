import React, { useRef, useState, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, ActivityIndicator, Platform } from 'react-native';
import { API_BASE, api } from '../utils/api';

export default function DocumentValidator() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [validationId, setValidationId] = useState<string | null>(null);
  const [validations, setValidations] = useState<any[]>([]);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.listDocValidations();
        setValidations(data);
      } catch (e: any) {
        // non-fatal
      }
    };
    load();
  }, []);

  const onPick = () => {
    if (Platform.OS === 'web') {
      inputRef.current?.click();
    }
  };

  const onFileSelected = (e: any) => {
    const f = e?.target?.files?.[0] as File | undefined;
    if (f) {
      setFile(f);
      setResult(null);
      setError(null);
    }
  };

  const makeFormData = () => {
    const fd = new FormData();
    if (file) {
      fd.append('file', file, file.name);
      fd.append('filename', file.name);
    }
    return fd;
  };

  const uploadViaProxy = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = makeFormData();
      const res = await fetch(`${API_BASE}/doc/validate`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Proxy upload failed: ${res.status} ${text}`);
      }
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = await res.text();
      }
      setResult(data);
      try {
        setValidationId(data?.validation_id || null);
        const list = await api.listDocValidations();
        setValidations(list);
      } catch {}
    } catch (e: any) {
      setError(e?.message || 'Upload via proxy failed');
    } finally {
      setLoading(false);
    }
  };

  // Removed legacy direct upload to n8n; all uploads go via proxy

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Document Validator</Text>
      <Text style={styles.subtitle}>Upload a document to validate via proxy.</Text>

      {Platform.OS === 'web' && (
        <input
          ref={inputRef as any}
          type="file"
          style={{ display: 'none' }}
          onChange={onFileSelected}
        />
      )}

  <View style={styles.row}>
    <Pressable style={styles.btn} onPress={onPick}><Text style={styles.btnText}>{file ? 'Change file' : 'Choose file'}</Text></Pressable>
    <Text style={styles.fileName}>{file ? file.name : 'No file selected'}</Text>
  </View>

  <View style={styles.row}>
    <Pressable style={styles.btn} onPress={uploadViaProxy}><Text style={styles.btnText}>Upload</Text></Pressable>
  </View>

      {loading && (
        <View style={{ marginTop: 12 }}>
          <ActivityIndicator />
          <Text style={styles.note}>Uploading…</Text>
        </View>
      )}

      {error && (
        <Text style={styles.error}>{error}</Text>
      )}

      {result && (
        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>Validation Output</Text>
          {(() => {
            let outputText = '';
            if (result && typeof result === 'object' && 'output' in result) {
              const out = (result as any).output;
              if (typeof out === 'string') {
                try { outputText = JSON.stringify(JSON.parse(out), null, 2); } catch { outputText = out; }
              } else {
                outputText = JSON.stringify(out, null, 2);
              }
            } else if (result && typeof result === 'object' && (result as any).upstream) {
              outputText = JSON.stringify((result as any).upstream, null, 2);
            } else {
              outputText = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
            }
            return <Text style={styles.resultBody}>{outputText}</Text>;
          })()}
          { (validationId || result?.validation_id) && (
            <View style={[styles.row, { marginTop: 12 }]}> 
              <Pressable style={[styles.btn, styles.acceptBtn]} onPress={async () => {
                try {
                  const id = validationId || result?.validation_id;
                  await api.decideDocValidation(id as string, 'accept');
                  const data = await api.listDocValidations();
                  setValidations(data);
                } catch (e: any) { setError(e?.message || 'Failed to accept'); }
              }}>
                <Text style={styles.btnText}>Accept</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.rejectBtn]} onPress={async () => {
                try {
                  const id = validationId || result?.validation_id;
                  await api.decideDocValidation(id as string, 'reject');
                  const data = await api.listDocValidations();
                  setValidations(data);
                } catch (e: any) { setError(e?.message || 'Failed to reject'); }
              }}>
                <Text style={styles.btnText}>Reject</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      <Text style={styles.subtitle}>Past Validations</Text>
      {validations.length === 0 ? (
        <Text style={styles.note}>No past validations yet.</Text>
      ) : (
        <View style={styles.historyBox}>
          {validations.slice(0, 10).map((v) => (
            <View key={v.id} style={styles.historyRow}>
              <Text style={styles.historyText}>{v.filename} • {v.uploaded_at} • {v.decision || 'pending'}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 20, fontFamily: 'Inter-SemiBold' },
  subtitle: { color: '#666', marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  fileName: { marginLeft: 12, color: '#333' },
  error: { color: 'crimson', marginTop: 12 },
  note: { color: '#666', marginTop: 8 },
  resultBox: { marginTop: 16, padding: 12, backgroundColor: '#f7f7f7', borderRadius: 12, borderWidth: 1, borderColor: '#eee' },
  resultTitle: { fontFamily: 'Inter-SemiBold', marginBottom: 6 },
  resultBody: { fontFamily: 'Inter-Regular', fontSize: 12 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  kvKey: { fontFamily: 'Inter-SemiBold', color: '#333' },
  kvVal: { fontFamily: 'Inter-Regular', color: '#555', flex: 1 },
  historyBox: { marginTop: 8, borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 8 },
  historyRow: { paddingVertical: 4 },
  historyText: { fontSize: 12, color: '#333' },
  btn: { backgroundColor: '#1a73e8', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16 },
  btnText: { color: '#fff', fontFamily: 'Inter-SemiBold' },
  btnSecondary: { backgroundColor: '#eee', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16 },
  btnSecondaryText: { color: '#333', fontFamily: 'Inter-SemiBold' },
  btnDisabled: { backgroundColor: '#ddd' },
  btnDisabledText: { color: '#888' },
  acceptBtn: { backgroundColor: '#059669' },
  rejectBtn: { backgroundColor: '#dc2626' },
  linkBtn: { paddingVertical: 6, paddingHorizontal: 10, alignSelf: 'flex-start' },
  linkBtnText: { color: '#1a73e8', fontFamily: 'Inter-Medium' },
});