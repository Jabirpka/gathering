import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jabirpka.gathering',
  appName: 'Gathering',
  webDir: 'dist',
  plugins: {
    Browser: {
      presentationStyle: 'popover',
    },
  },
};

export default config;
