
import { signInWithEmailAndPassword } from 'firebase/auth';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { auth } from '../../services/firebaseConfig';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogin = async () => {
    if (!email || !password) {
      setError('Please enter email and password.');
      Alert.alert('Missing fields', 'Please enter email and password.');
      return;
    }
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setError(null);
    } catch (err: any) {
      const message = err?.message ?? 'Unable to sign in';
      setError(message);
      Alert.alert('Login failed', message);
    } finally {
      setLoading(false);
    }
  };

  // this is enter key login press handler
  const onKeyPress = (e: any) => {
    const key = e?.key ?? e?.nativeEvent?.key;
    if (key === 'Enter') {
      onLogin();
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>Julius Baer Login</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          onSubmitEditing={onLogin}
          // @ts-ignore web-only
          onKeyPress={onKeyPress}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={onLogin}
          // @ts-ignore web-only
          onKeyPress={onKeyPress}
        />
        <Pressable style={styles.button} onPress={onLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
        </Pressable>
        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { width: 360, borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 20, fontFamily: 'Inter-SemiBold', marginBottom: 12, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  button: { backgroundColor: '#0A7EA4', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontFamily: 'Inter-SemiBold' },
  errorText: { marginTop: 10, color: '#b00020', fontFamily: 'Inter-Medium' },
});
