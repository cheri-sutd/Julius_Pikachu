import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, ActivityIndicator, View } from 'react-native';
import { NativeNavigator } from './navigator';
import { useFonts } from 'expo-font';
import Login from './screens/login';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../services/firebaseConfig';

export default function App() {
  const [fontsLoaded] = useFonts({
    'Inter-Regular': require('../assets/fonts/Inter_24pt-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter_24pt-Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter_24pt-SemiBold.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter_24pt-Bold.ttf'),
  });
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    if (fontsLoaded) {
      const AnyText: any = Text as any;
      AnyText.defaultProps = AnyText.defaultProps || {};
      AnyText.defaultProps.style = [AnyText.defaultProps.style, { fontFamily: 'Inter-Regular' }];
    }
  }, [fontsLoaded]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  if (!fontsLoaded || user === undefined) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#0A7EA4" />
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.container}>
      {user ? <NativeNavigator /> : <Login />}
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});