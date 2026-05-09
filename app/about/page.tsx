"use client";

import Image from "next/image";
import Link from "next/link";

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
                Features (If You Can Call Them That)
              </h2>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <li className="flex gap-4">
                  <span className="text-brand-primary text-2xl">🍸</span>
                  <div>
                    <strong className="text-white block mb-1">
                      Party Houses
                    </strong>
                    <span className="text-sm">
                      Host absolutely unhinged ragers. If the cops don't show
                      up, you didn't do it right.
                    </span>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="text-brand-secondary text-2xl">🎰</span>
                  <div>
                    <strong className="text-white block mb-1">Casinos</strong>
                    <span className="text-sm">
                      Gamble away your hard-earned carrot-coins. The house
                      always wins, but maybe today is your day? (It isn't.)
                    </span>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="text-brand-primary text-2xl">🏗️</span>
                  <div>
                    <strong className="text-white block mb-1">
                      Isometric Building
                    </strong>
                    <span className="text-sm">
                      Stack blocks, decorate your squalor, and create
                      architectural monstrosities in glorious 3D.
                    </span>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="text-brand-secondary text-2xl">👥</span>
                  <div>
                    <strong className="text-white block mb-1">
                      Multiplayer Mayhem
                    </strong>
                    <span className="text-sm">
                      Interact with other questionable individuals in real-time.
                      Make friends, make enemies, make questionable life
                      choices.
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
              <div className="cyber-skew bg-brand-primary px-8 py-4 relative transition-all group-hover:translate-x-1 group-hover:-translate-y-1">
                <span className="text-lg font-black uppercase tracking-[0.2em] text-white">
                  Join the Alpha
                </span>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Decorative scanline overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[length:100%_2px,3px_100%]" />
    </div>
  );
}
