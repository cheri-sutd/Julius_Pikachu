import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { type ComponentProps } from 'react';
import { Text, Linking } from 'react-native';

type Props = ComponentProps<typeof Text> & { href: string };

export function ExternalLink({ href, ...rest }: Props) {
  const handlePress = async () => {
    if (process.env.EXPO_OS === 'web') {
      // On web, open in new tab
      window.open(href, '_blank');
    } else {
      // On native, use expo-web-browser
      await openBrowserAsync(href, {
        presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
      });
    }
  };

  return (
    <Text
      {...rest}
      onPress={handlePress}
      style={[
        { color: '#0A7EA4', textDecorationLine: 'underline' },
        rest.style
      ]}
    />
  );
}
