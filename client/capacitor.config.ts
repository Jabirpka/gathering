import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jabirpka.gathering',
  appName: 'Gathering',
  webDir: 'dist',
  server: {
    url: 'https://gathering-client-six.vercel.app',
    cleartext: false,
  },
};

export default config;
