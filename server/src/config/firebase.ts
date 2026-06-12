import { initializeApp, cert, type App } from 'firebase-admin/app';

let app: App | null = null;
let initAttempted = false;

/**
 * Lazily initializes the Firebase Admin SDK from env vars so the server
 * still boots fine (push notifications just become a no-op) if Firebase
 * hasn't been configured yet.
 *
 * Required env vars:
 *  - FIREBASE_PROJECT_ID
 *  - FIREBASE_CLIENT_EMAIL
 *  - FIREBASE_PRIVATE_KEY — either the raw PEM with literal "\n" sequences
 *    for newlines, or (recommended, to avoid env var UIs mangling the
 *    multi-line value) the whole PEM base64-encoded as a single line.
 */
export function getFirebaseApp(): App | null {
  if (app) return app;
  if (initAttempted) return null;
  initAttempted = true;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('Firebase Admin not configured — push notifications disabled (missing FIREBASE_* env vars)');
    return null;
  }

  if (!privateKey.includes('PRIVATE KEY')) {
    privateKey = Buffer.from(privateKey, 'base64').toString('utf8');
  }
  privateKey = privateKey.replace(/\\n/g, '\n');

  try {
    app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    console.log('Firebase Admin initialized — push notifications enabled');
    return app;
  } catch (err) {
    console.error('Failed to initialize Firebase Admin', err);
    return null;
  }
}
