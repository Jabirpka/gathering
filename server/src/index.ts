import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { Server as SocketServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { config } from './config';
import { configurePassport } from './config/passport';
import authRoutes from './routes/auth';
import groupRoutes from './routes/groups';
import userRoutes from './routes/users';
import livekitRoutes from './routes/livekit';
import pushRoutes from './routes/push';
import dmRoutes from './routes/dms';
import statusRoutes from './routes/status';
import { setupSocketHandlers } from './socket';
import { errorHandler } from './middleware/error';

export const prisma = new PrismaClient();

const app = express();
const httpServer = createServer(app);

// Allow web client + Capacitor Android/iOS WebView origins
const allowedOrigins = [
  config.clientUrl,
  'capacitor://localhost', // Capacitor Android/iOS
  'http://localhost',
  'https://localhost',
  'http://localhost:5173', // Vite dev server
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (native apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(null, false);
    },
    credentials: true,
  })
);
// Large-ish limits so base64 payloads (avatars, image statuses) fit.
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.nodeEnv === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

configurePassport();
app.use(passport.initialize());
app.use(passport.session());

app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/users', userRoutes);
app.use('/api/livekit', livekitRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/dms', dmRoutes);
app.use('/api/status', statusRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

export const io = new SocketServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  // Voice messages travel as base64 data URLs over the socket.
  maxHttpBufferSize: 2e6,
});

async function setupRedis() {
  try {
    const pubClient = createClient({ url: config.redisUrl });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log('Redis adapter connected');
  } catch {
    console.warn('Redis not available, running without adapter (single node only)');
  }
}

setupRedis();
setupSocketHandlers(io);

// Idempotent, safe self-migration so the app works without a manual
// `prisma db push`. Adds the profile/phone/onboarded columns and relaxes
// googleId/email to nullable (phone-only accounts). Every statement is
// "IF NOT EXISTS"/no-op, so it's safe to run on every boot.
async function ensureSchema() {
  const statements = [
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dateOfBirth" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bio" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "interests" TEXT[] NOT NULL DEFAULT '{}'`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "favoriteSong" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "favoriteMovie" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "city" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "whoAreYou" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "whatCanYouDo" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trust" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lookingFor" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "wantToMeet" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboarded" BOOLEAN NOT NULL DEFAULT true`,
    `ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "category" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT`,
    `ALTER TABLE "User" ALTER COLUMN "googleId" DROP NOT NULL`,
    `ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username")`,
  ];
  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (err) {
      console.warn('ensureSchema step skipped:', err instanceof Error ? err.message : err);
    }
  }
  console.log('Schema ensured (profile / phone / onboarded columns present)');
}

ensureSchema()
  .catch((err) => console.error('ensureSchema failed', err))
  .finally(() => {
    httpServer.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
  });
