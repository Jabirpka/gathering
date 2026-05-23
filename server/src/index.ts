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
import eventRoutes from './routes/events';
import livekitRoutes from './routes/livekit';
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/events', eventRoutes);
app.use('/api/livekit', livekitRoutes);

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

httpServer.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
