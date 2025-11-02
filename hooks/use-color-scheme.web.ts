import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

let overrideScheme: 'light' | 'dark' | null = null;
export function setColorSchemeOverride(s: 'light' | 'dark' | null) { overrideScheme = s; }

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (overrideScheme) {
    return overrideScheme;
  }

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
