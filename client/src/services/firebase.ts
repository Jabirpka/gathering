import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

// Public web config — safe to ship in the client. Provide via Vite env vars:
//   VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
//   VITE_FIREBASE_APP_ID, VITE_FIREBASE_MESSAGING_SENDER_ID (optional)
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

/** True only when the phone-auth config is present, so the UI can degrade gracefully. */
export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

const app: FirebaseApp | null = firebaseConfigured ? (getApps()[0] ?? initializeApp(config)) : null;
export const firebaseAuth: Auth | null = app ? getAuth(app) : null;
