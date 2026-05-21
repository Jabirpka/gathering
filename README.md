# Gathering

> Watch together, anywhere. Group video calls, synchronized video watching, and real-time interaction for up to 1,000 participants.

## Features

- **Google Authentication** — Sign in with Google, no passwords needed
- **Group Management** — Create groups with invite codes; approve members or make public
- **Video Calls** — WebRTC-based calls via LiveKit SFU, scales to 1,000 participants
- **Watch Parties** — Synchronized video playback (YouTube + direct URLs); host controls play/pause/seek
- **Live Chat** — Real-time text chat in every room and group
- **Video Comments** — Timestamped comments that appear as video overlays
- **Scheduled Events** — Book watch parties, calls, and meetups in advance
- **Meetup Midpoint** — Google Maps midpoint calculator to find the fairest meeting location

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| State | Zustand + React Query |
| Backend | Node.js + Express + TypeScript |
| Real-time | Socket.io (Redis adapter for horizontal scaling) |
| Video calls | LiveKit (SFU — scales to 1,000 users) |
| Video sync | Custom Socket.io protocol |
| Database | PostgreSQL + Prisma ORM |
| Auth | Google OAuth 2.0 + JWT |
| Cache/Scale | Redis |

## Prerequisites

- Node.js 18+
- Docker & Docker Compose (for PostgreSQL, Redis, LiveKit)
- A Google Cloud project with OAuth 2.0 credentials
- (Optional) A Google Maps API key for midpoint calculation

## Quick Start

### 1. Clone and install

```bash
git clone <repo>
cd gathering
npm run setup
```

### 2. Configure environment

```bash
cp .env.example server/.env
# Edit server/.env with your credentials
```

Required values:
```env
GOOGLE_CLIENT_ID=...        # from Google Cloud Console
GOOGLE_CLIENT_SECRET=...    # from Google Cloud Console
SESSION_SECRET=<random 32+ chars>
JWT_SECRET=<random 32+ chars>
```

### 3. Start infrastructure

```bash
docker-compose up -d
```

### 4. Set up database

```bash
cd server
npm run prisma:migrate   # creates tables
npm run prisma:generate  # generates Prisma client
```

### 5. Start development servers

```bash
# From root:
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- LiveKit: ws://localhost:7880

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable the **Google+ API** / **Google Identity**
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URI: `http://localhost:3001/api/auth/google/callback`
6. Copy Client ID and Secret into `.env`

## Google Maps Setup (optional)

1. Enable **Geocoding API** in Google Cloud Console
2. Create an API key and add to `.env` as `GOOGLE_MAPS_API_KEY`
3. Add to `client/index.html`: `<script>window.__GOOGLE_MAPS_KEY__ = 'YOUR_KEY'</script>`

## Architecture Notes

### Video Calls (LiveKit)
LiveKit uses a **Selective Forwarding Unit (SFU)** architecture. Participants send one stream to the server, which selectively forwards streams to each subscriber — enabling 1,000+ concurrent participants without exponential bandwidth growth.

In production, deploy LiveKit server separately (or use [LiveKit Cloud](https://livekit.io)) and update `LIVEKIT_WS_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`.

### Synchronized Video
A **host-controlled sync protocol** runs over Socket.io:
1. Host emits `video:sync` on play/pause/seek with timestamp
2. Server validates host identity and rebroadcasts
3. Clients apply latency compensation (`targetTime = eventTime + networkLatency`)
4. Background drift correction re-syncs every 5s if off by >2s

### Scaling
Socket.io uses a **Redis pub/sub adapter**, allowing horizontal scaling across multiple server nodes. All socket events are broadcast via Redis channels.

## Project Structure

```
gathering/
├── client/          # React frontend (Vite)
│   └── src/
│       ├── components/   # UI components
│       ├── pages/        # Route pages
│       ├── hooks/        # Custom hooks
│       ├── store/        # Zustand stores
│       └── services/     # API clients
├── server/          # Express backend
│   └── src/
│       ├── routes/       # REST API routes
│       ├── socket/       # Socket.io handlers
│       ├── middleware/   # Auth, error handlers
│       └── config/       # Passport, env config
│   └── prisma/
│       └── schema.prisma # Database schema
└── docker-compose.yml
```
