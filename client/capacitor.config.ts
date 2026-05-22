import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jabirpka.gathering',
  appName: 'Gathering',
  webDir: 'dist',
  server: {
    // Allow mixed content (HTTP/HTTPS) for API calls
    allowNavigation: ['gathering-server-production.up.railway.app'],
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
