# BoozedBunnyTown is a 3D browser based Multiplayer Game

This project is a browser-based 3D multiplayer game built with Next.js, React Three Fiber, Prisma, and Socket.io.

## Tech Stack
- **Node.js**: 22
- **Next.js**: 15 (App Router)
- **3D Engine**: React Three Fiber, @react-three/drei
- **Database**: Prisma with SQLite
- **Multiplayer**: Socket.io with a custom Express server
- **UI**: Tailwind CSS, shadcn/ui

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Database
```bash
npx prisma migrate dev --name init
npx ts-node --esm prisma/seed.ts
```

### 3. Run Development Server
```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Production
To run in production:
```bash
npm run build
npm start
```
(For PM2, use `pm2 start "npm start" --name bbtown`)
