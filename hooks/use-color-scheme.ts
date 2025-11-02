import { useColorScheme as useRNColorScheme } from 'react-native';

let overrideScheme: 'light' | 'dark' | null = null;

export function setColorSchemeOverride(s: 'light' | 'dark' | null) {
  overrideScheme = s;
}

export function useColorScheme() {
  const rn = useRNColorScheme();
  return overrideScheme ?? rn;
}