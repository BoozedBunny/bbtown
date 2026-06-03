"use client";

import Image from "next/image";
import Link from "next/link";
import { Bot, Code, PenTool, GitFork, ExternalLink } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen text-white overflow-hidden relative brand-bg-overlay font-sans py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute top-4 left-4 z-50">
        <Link
          href="/login"
          className="text-brand-primary hover:text-brand-secondary transition-colors font-bold flex items-center gap-2 cyber-panel px-4 py-2"
        >
          <span>&larr; Back to the Chaos</span>
        </Link>
      </div>

      <div className="max-w-4xl mx-auto z-10 relative">
        <div className="cyber-panel p-8 md:p-12 border-t-4 border-t-brand-primary shadow-2xl">
          {/* Header Section */}
          <div className="mb-12 text-center flex flex-col items-center">
            <div className="relative w-40 h-40 mb-8">
              <div className="absolute inset-0 bg-brand-primary/20 blur-3xl rounded-full animate-pulse" />
              <Image
                src="https://www.boozedbunnytown.com/media/logo.png"
                alt="BoozedBunny Logo"
                fill
                className="object-contain drop-shadow-[0_0_20px_rgba(189,0,255,0.6)] relative z-10"
              />
            </div>
            <h1
              className="text-5xl md:text-7xl font-heading font-black tracking-tighter mb-4 cyber-glitch-text italic"
              data-text="What the h*ck is BoozedBunnyTown?"
            >
              What the h*ck is BoozedBunnyTown?
            </h1>
            <p className="text-brand-secondary font-mono text-sm md:text-base uppercase tracking-[0.2em]">
              The least productive place on the internet.
            </p>
          </div>

          {/* Content Section */}
          <div className="space-y-12 text-gray-300 text-lg leading-relaxed">
            {/* The Project */}
            <section className="bg-black/40 border border-white/10 p-6 md:p-8 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <h2 className="text-3xl font-heading font-bold text-white mb-4 border-b border-brand-primary/30 pb-2">
                The Project
              </h2>
              <p>
                BoozedBunnyTown isn't your typical squeaky-clean town builder.
                It's a browser-based, 3D multiplayer isometric empire where
                chaos is encouraged. Think of it as a social sandbox for
                degenerates, dreamers, and bunnies who have clearly had one too
                many. Build your empire, socialize, or just watch it all
                burn—the choice is yours.
              </p>
            </section>

            {/* Features */}
            <section className="bg-black/40 border border-white/10 p-6 md:p-8 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <h2 className="text-3xl font-heading font-bold text-white mb-6 border-b border-brand-secondary/30 pb-2">
                Loaded Features (To Blow Your Mind)
              </h2>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <li className="flex gap-4">
                  <span className="text-brand-primary text-2xl">🍸</span>
                  <div>
                    <strong className="text-white block mb-1">
                      Party Houses & Establishments
                    </strong>
                    <span className="text-sm">
                      Buy, own, and operate your own venues. Host completely unhinged ragers, supply questionable beverages, and make sure the cops get a reason to show up.
                    </span>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="text-brand-secondary text-2xl">📈</span>
                  <div>
                    <strong className="text-white block mb-1">
                      Real-Time In-Game Stock Market
                    </strong>
                    <span className="text-sm">
                      Trade shares in real-time, exploit market fluctuations, and—best of all—launch your own custom stock on the exchange to scam other bunnies.
                    </span>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="text-brand-primary text-2xl">📦</span>
                  <div>
                    <strong className="text-white block mb-1">
                      Dynamic Cargo & Trading Goods
                    </strong>
                    <span className="text-sm">
                      Buy low, sell high. Trade a variety of products across cities to build your financial empire. Arbitrage is your best friend.
                    </span>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="text-brand-secondary text-2xl">⚔️</span>
                  <div>
                    <strong className="text-white block mb-1">
                      Knockout Arena (Multiplayer Mayhem)
                    </strong>
                    <span className="text-sm">
                      Step into the ring in real-time. Punch, kick, and push other bunnies off the platforms in chaotic, physics-based multiplayer battles.
                    </span>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="text-brand-primary text-2xl">🤖</span>
                  <div>
                    <strong className="text-white block mb-1">
                      Local Gemma AI Integration
                    </strong>
                    <span className="text-sm">
                      Engage in contextual, real-time chat with the local population. NPCs actually remember who you are, know your wallet balance, and judge your financial crimes.
                    </span>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="text-brand-secondary text-2xl">🎭</span>
                  <div>
                    <strong className="text-white block mb-1">
                      Strapi-Powered Infinite Personalities
                    </strong>
                    <span className="text-sm">
                      Build infinite custom characters in the Strapi CMS. Customize their system prompts, personalities, temperatures, and model parameters on the fly.
                    </span>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="text-brand-primary text-2xl">🏛️</span>
                  <div>
                    <strong className="text-white block mb-1">
                      Infinite Cities & Local Treasuries
                    </strong>
                    <span className="text-sm">
                      Explore multiple municipalities (expandable to infinity). Each town features its own bank and central treasury that issues predatory loans and handles zoning.
                    </span>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="text-brand-secondary text-2xl">💳</span>
                  <div>
                    <strong className="text-white block mb-1">
                      Real-Time Ledger Wallet
                    </strong>
                    <span className="text-sm">
                      Track every single coin in real-time. A clean, modern ledger breaks down your earnings and expenses into transaction categories automatically.
                    </span>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="text-brand-primary text-2xl">📰</span>
                  <div>
                    <strong className="text-white block mb-1">
                      Automated Live Newspaper
                    </strong>
                    <span className="text-sm">
                      Read breaking news generated live based on market movements, player bankruptcies, arena fights, and political changes in the towns.
                    </span>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="text-brand-secondary text-2xl">🎰</span>
                  <div>
                    <strong className="text-white block mb-1">
                      High-Stakes Casinos
                    </strong>
                    <span className="text-sm">
                      Gamble away your hard-earned savings on roulette. The house always wins, but maybe you can break the streak. (Spoiler: You won't.)
                    </span>
                  </div>
                </li>
              </ul>
            </section>

            {/* Personal Note */}
            <section className="bg-gradient-to-r from-brand-primary/10 to-brand-secondary/10 border-l-4 border-brand-primary p-6 md:p-8">
              <h2 className="text-2xl font-heading font-bold text-white mb-4">
                A Note from the Creator
              </h2>
              <div className="italic text-gray-400 space-y-4">
                <p>
                  "Look, I just wanted to build a place where my digital bunnies
                  could hang out, have a few drinks, and maybe lose their
                  savings at a roulette table. Things escalated."
                </p>
                <p>
                  "This project is a massive labor of love, fueled by caffeine,
                  late nights, and a complete disregard for sensible game design
                  rules. It's in Alpha right now, which means the duct tape
                  holding it together might fail at any moment. Your data will
                  probably be wiped. The economy might collapse. A bug might
                  turn everyone into a giant carrot. Just roll with it."
                </p>
                <p className="font-bold text-brand-secondary">
                  - Cheers, The Dev
                </p>
              </div>
            </section>
          </div>

          <div className="mt-16 text-center">
            <Link href="/login" className="inline-block group relative">
              <div className="absolute inset-0 bg-brand-primary/20 blur group-hover:bg-brand-primary/40 transition-all" />
              <div className=" bg-brand-primary px-8 py-4 relative transition-all group-hover:translate-x-1 group-hover:-translate-y-1">
                <span className="text-lg font-black uppercase tracking-[0.2em] text-white">
                  Join the Alpha
                </span>
              </div>
            </Link>
          </div>

          {/* The Code Section */}
          <section className="bg-black/40 border border-white/10 p-6 md:p-8 relative overflow-hidden group mt-12">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <h2 className="text-3xl font-heading font-bold text-white mb-4 border-b border-brand-primary/30 pb-2 flex items-center gap-2">
              <Code className="text-brand-primary" /> The Code
            </h2>
            <div className="space-y-8">
              <p className="text-gray-300 leading-relaxed">
                BoozedBunnyTown is a side project where I wanted to see just how
                much artificial intelligence I could incorporate without making
                the game unplayable in the end. So the main goal is to keep the
                code as clean and logical as possible. I try to make the best
                use of all the code the AI generates, while fixing bugs that it
                creates the same way.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Used AI */}
                <div className="bg-white/5 p-4 border border-white/10 rounded-lg">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                    <Bot className="text-brand-secondary" /> Used AI
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li>- Google's Jules (Gemini 3 Flash & 3.1 Pro)</li>
                    <li>- Google AI Studio</li>
                    <li>- Hermes Agent (Workspace / Orchestrator)</li>
                    <li>- ChatGPT Images 2.0</li>
                    <li>- runpod.io with local ComfyUI</li>
                    <li>- meshy.ai</li>
                  </ul>
                </div>

                {/* Used Third Party */}
                <div className="bg-white/5 p-4 border border-white/10 rounded-lg">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                    <Code className="text-brand-primary" /> Tech Stack
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li>
                      - <strong>Node.js</strong>: 22
                    </li>
                    <li>
                      - <strong>Next.js</strong>: 15 (App Router)
                    </li>
                    <li>
                      - <strong>3D Engine</strong>: React Three Fiber,
                      @react-three/drei
                    </li>
                    <li>
                      - <strong>Database</strong>: Prisma with SQLite
                    </li>
                    <li>
                      - <strong>Multiplayer</strong>: Socket.io with Express
                    </li>
                    <li>
                      - <strong>UI</strong>: Tailwind CSS, shadcn/ui
                    </li>
                  </ul>
                </div>

                {/* Hands on Editing */}
                <div className="bg-white/5 p-4 border border-white/10 rounded-lg">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                    <PenTool className="text-purple-400" /> Hands-on Editing
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li>
                      -{" "}
                      <a
                        href="https://blender.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-white flex items-center gap-1"
                      >
                        blender.org <ExternalLink size={12} />
                      </a>
                    </li>
                    <li>
                      -{" "}
                      <a
                        href="https://photopea.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-white flex items-center gap-1"
                      >
                        photopea.com <ExternalLink size={12} />
                      </a>
                    </li>
                    <li>
                      -{" "}
                      <a
                        href="https://pikimov.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-white flex items-center gap-1"
                      >
                        pikimov.com <ExternalLink size={12} />
                      </a>
                    </li>
                  </ul>
                </div>
              </div>

              {/* GitHub Repo */}
              <div className="bg-gradient-to-r from-brand-primary/20 to-brand-secondary/20 p-6 border border-brand-primary/30 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <GitFork className="text-brand-primary" /> Open Source
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    MIT Licensed Repository
                  </p>
                </div>
                <a
                  href="https://github.com/BoozedBunny/bbtown"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cyber-panel px-6 py-3 flex items-center gap-2 hover:bg-white/10 transition-colors text-white font-bold"
                >
                  <GitFork size={20} /> View on GitHub
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Decorative scanline overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[length:100%_2px,3px_100%]" />
    </div>
  );
}
