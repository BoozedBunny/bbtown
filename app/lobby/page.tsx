import { getSessionUser } from "../../lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createCharacter } from "../actions/character";
import { Button } from "@/components/ui/button";
import { doWork } from "../actions/work";
import { LobbyTownEntryClient } from "./LobbyTownEntryClient";
import { getTownPreloadManifest } from "../town/[townId]/preload-manifest";

export default async function LobbyPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  const townHref = "/town/1";
  const preloadManifest = getTownPreloadManifest();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-white overflow-hidden relative brand-bg-overlay font-sans">
      <div className="z-10 w-full max-w-md cyber-panel p-8 border-l-4 border-l-brand-secondary">
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 bg-brand-secondary/20 blur-xl rounded-full" />
            <Image
              src="/logo.png"
              alt="BoozedBunny Logo"
              fill
              className="object-contain relative z-10"
            />
          </div>
          <h1 className="text-3xl font-heading font-black italic tracking-tighter cyber-glitch-text" data-text="BB_LOBBY_CONTROL">
            BB_LOBBY_CONTROL
          </h1>
          <p className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.3em] mt-1">Authorized Access Only</p>
        </div>

        <div className="mb-8 p-6 bg-black/40 border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-2">
             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          </div>
          <p className="text-[10px] font-mono text-brand-primary uppercase tracking-widest mb-1">Authenticated_User</p>
          <p className="text-2xl font-black text-white italic">{user.username}</p>
          <div className="mt-4 flex gap-1">
             {[...Array(12)].map((_, i) => (
               <div key={i} className="w-2 h-[1px] bg-white/10" />
             ))}
          </div>
        </div>

        {!user.character ? (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-brand-primary mb-6 flex items-center gap-2">
               <span className="w-2 h-2 bg-brand-primary" />
               New_Avatar_Registry
            </h2>
            <form action={createCharacter} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="name" className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest block">
                  Identifier
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  className="w-full px-4 py-3 bg-black/60 border border-white/10 text-white font-mono focus:outline-none focus:border-brand-primary transition-colors"
                  placeholder="Subject_Name"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="appearanceColor" className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest block">
                  Visual_Signature
                </label>
                <div className="relative">
                  <select
                    id="appearanceColor"
                    name="appearanceColor"
                    required
                    className="w-full px-4 py-3 bg-black/60 border border-white/10 text-white font-mono focus:outline-none focus:border-brand-primary transition-colors appearance-none"
                  >
                    <option value="#BD00FF">Primary Purple</option>
                    <option value="#FFB800">Secondary Gold</option>
                    <option value="#FF4D00">Tertiary Orange</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-primary">▼</div>
                </div>
              </div>
              <button
                type="submit"
                className="group relative w-full block"
              >
                <div className="absolute inset-0 bg-brand-primary/20 blur group-hover:bg-brand-primary/40 transition-all" />
                <div className="cyber-skew bg-brand-primary px-6 py-4 relative transition-all group-hover:translate-x-1 group-hover:-translate-y-1 text-center">
                   <span className="text-sm font-black uppercase tracking-[0.2em] text-white">Initialize_Deployment</span>
                </div>
              </button>
            </form>
          </section>
        ) : (
          <section className="text-center animate-in fade-in duration-500">
            <div className="mb-8">
              <div className="flex items-center justify-center gap-3 mb-6">
                 <div className="h-px flex-1 bg-white/5" />
                 <h2 className="text-[10px] font-mono font-black text-gray-500 uppercase tracking-[0.3em]">Avatar_Status</h2>
                 <div className="h-px flex-1 bg-white/5" />
              </div>

              <div className="relative inline-block">
                <div
                  className="w-24 h-24 rounded-none border-2 border-white/20 relative z-10 flex items-center justify-center overflow-hidden cyber-skew"
                  style={{ backgroundColor: user.character.appearanceColor }}
                >
                   <div className="w-full h-full bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[length:200%_200%] animate-[scanline_4s_linear_infinite]" />
                </div>
                <div className="absolute -inset-2 bg-brand-primary/10 blur-md rounded-full -z-10" />
              </div>

              <p className="text-3xl font-heading font-black text-white mt-6 italic tracking-tighter uppercase">{user.character.name}</p>

              <div className="mt-8 flex flex-col items-center gap-4">
                <div className="px-6 py-2 bg-brand-primary/10 border-x border-brand-primary text-brand-secondary font-black font-mono tracking-tighter">
                   CREDITS: ${user.character.wallet.toLocaleString()}
                </div>
                <form action={doWork}>
                  <button type="submit" className="text-[10px] font-mono font-bold text-gray-400 hover:text-brand-primary transition-colors flex items-center gap-2 uppercase tracking-widest border border-white/5 px-4 py-2 hover:bg-white/5">
                    ⚒️ run_work_routine (+ $500)
                  </button>
                </form>
              </div>
            </div>

            <LobbyTownEntryClient
              townHref={townHref}
              glbAssets={preloadManifest.glbAssets}
              staticAssets={preloadManifest.staticAssets}
            />
          </section>
        )}

        <div className="mt-12 text-center">
          <Link href="/login" className="text-[10px] font-mono text-gray-600 hover:text-white transition-colors uppercase tracking-[0.2em]">
            {`>> logout_and_reauth`}
          </Link>
        </div>
      </div>

       {/* Decorative scanline overlay */}
       <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[length:100%_2px,3px_100%]" />
    </div>
  );
}
