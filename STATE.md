# BBTown Project State & Vision

## Vision
A browser-based multiplayer economic simulation. Players live in a 3D city, manage real estate (all houses are party houses), and participate in a fictional stock market.

## Tech Stack
- **Frontend:** Next.js, Tailwind/shadcn, Lucide Icons
- **3D Engine:** React Three Fiber (R3F), @react-three/cannon
- **Backend/DB:** Node.js 22, Prisma with SQLite (local development)
- **Deployment:** Proxmox LXC with PM2

## Current Features
- Basic login with two test accounts.
- Lobby with character selection (placeholder).
- 3D Map with Dev/Player mode toggle.
- Basic Wallet & Building placement.

## Project Status
- **Planning:** Roadmap items have been converted to Kanban tickets.
- **Development:** Sprint 1 started.

## Immediate Roadmap
1. **Loading Bar:** [DONE] Implementation of a progress simulation before entering the city.
2. **Login Redirect:** [DONE] Add functionality to route people to the startpage, that aren't logged in.
3. **Stock Market:** [TODO_CODE] Integration of the "Funny Names" stock exchange with random price movements.
