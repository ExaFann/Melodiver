# 🎵 Melodiver

A full-stack music streaming and visualization web app with real-time audio analysis.

🔗 **[Live Demo](https://melodiver.reddesert-71235324.eastus.azurecontainerapps.io/)**

## Features

- **Audio Streaming & Library Management** — Upload tracks or import directly from YouTube via yt-dlp; organize music into albums with custom cover art
- **Real-Time Visualizations** — 2D waveform renderer (line / bars / mirror with trail persistence) and an interactive 3D particle system powered by Three.js, driven by Web Audio API FFT analysis
- **Configurable Transfer Functions** — Choose from linear, exponential, threshold, harmonic, and inverse mapping modes with adjustable frequency-band channel routing (bass → size, mid → color, treble → brightness, etc.)
- **Auth & User Management** — JWT-based authentication with registration, login, profile editing, and admin user management panel
- **One-Command Deployment** — Multi-stage Dockerfile + Docker Compose with persistent volumes for database and uploads

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, Next.js 16 (App Router), TypeScript, Tailwind CSS |
| 3D / Viz | Three.js, @react-three/fiber, @react-three/drei, Web Audio API |
| Backend | Next.js API Routes, SQLite (better-sqlite3), JWT (jose) |
| Media | yt-dlp, FFmpeg |
| Infra | Docker, Azure Container Apps |

## Getting Started

### Prerequisites

- Node.js 20+
- FFmpeg (for audio duration detection)
- yt-dlp (for YouTube imports)

### Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Docker

```bash
docker compose up --build
```

The app will be available at `http://localhost:3000`. Data is persisted via Docker volumes.

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main player UI
│   ├── api/
│   │   ├── albums/           # Album CRUD
│   │   ├── auth/             # Register, login, profile, etc.
│   │   └── tracks/           # Track CRUD & YouTube import
│   └── uploads/              # Static file serving route
├── components/
│   ├── Visualizer.tsx         # 2D waveform canvas
│   ├── ParticleVisualizer.tsx # 3D particle system
│   ├── AlbumList.tsx          # Album/track sidebar
│   ├── AuthPage.tsx           # Login/register forms
│   └── UserManagementPanel.tsx
├── hooks/
│   ├── useAudioPlayer.ts     # Web Audio API playback
│   ├── useAuth.tsx            # JWT auth context
│   └── useApi.ts              # API client helpers
├── lib/
│   ├── auth.ts                # JWT verification
│   ├── db.ts                  # SQLite connection
│   ├── media.ts               # yt-dlp & FFmpeg helpers
│   └── schema.ts              # DB schema & seed data
└── types/
    └── music.ts               # Shared TypeScript types
```

## License

MIT
