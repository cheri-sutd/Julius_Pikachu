
import { signInWithEmailAndPassword } from 'firebase/auth';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View, ImageBackground } from 'react-native';
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
    <ImageBackground
      source={require('../../assets/images/login_page.jpg')}
      style={styles.root}
      resizeMode="cover"
    >
      {/* global dim overlay to improve contrast */}
      <View style={styles.overlay} />
      {/* center emphasis behind the card to make controls stand out */}
      <View style={styles.centerStack}>
        <View style={styles.centerEmphasis} />
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // removed deprecated resizeMode in style; using ImageBackground prop instead
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  centerStack: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  centerEmphasis: { position: 'absolute', width: 420, height: 420, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.45)' },
  card: { width: 360, borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 16, backgroundColor: '#fff', zIndex: 2 },
  title: { fontSize: 20, fontFamily: 'Inter-SemiBold', marginBottom: 12, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  button: { backgroundColor: '#0A7EA4', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontFamily: 'Inter-SemiBold' },
  errorText: { marginTop: 10, color: '#b00020', fontFamily: 'Inter-Medium' },
});
