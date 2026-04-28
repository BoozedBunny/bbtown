import { getSessionUser } from "../../lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createCharacter } from "../actions/character";
import { Button } from "@/components/ui/button";
import { doWork } from "../actions/work";

export default async function LobbyPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-brand-neutral p-4 text-white overflow-hidden relative">
      <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] bg-brand-primary opacity-10 blur-[100px] rounded-full" />
      <div className="absolute bottom-[20%] left-[-5%] w-[30%] h-[30%] bg-brand-secondary opacity-5 blur-[100px] rounded-full" />

      <div className="z-10 w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl">
        <h1 className="text-3xl font-heading font-bold mb-6 text-center bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent">Lobby</h1>

        <div className="mb-8 p-4 bg-brand-primary/10 border border-brand-primary/20 rounded-xl">
          <p className="text-gray-400 text-sm">Logged in as:</p>
          <p className="text-xl font-bold text-white">{user.username}</p>
        </div>

        {!user.character ? (
          <section>
            <h2 className="text-xl font-heading font-semibold mb-4 text-gray-200">Create Your Character</h2>
            <form action={createCharacter} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-1">
                  Character Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all text-white placeholder:text-gray-600"
                  placeholder="Enter name..."
                />
              </div>
              <div>
                <label htmlFor="appearanceColor" className="block text-sm font-medium text-gray-400 mb-1">
                  Brand Color Preference
                </label>
                <select
                  id="appearanceColor"
                  name="appearanceColor"
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all text-white appearance-none"
                >
                  <option value="#BD00FF" className="bg-brand-neutral text-white">Primary Purple</option>
                  <option value="#FFB800" className="bg-brand-neutral text-white">Secondary Gold</option>
                  <option value="#FF4D00" className="bg-brand-neutral text-white">Tertiary Orange</option>
                </select>
              </div>
              <Button
                type="submit"
                className="w-full py-6 bg-brand-primary hover:bg-brand-primary/80 text-white rounded-xl transition font-bold"
              >
                Create Character
              </Button>
            </form>
          </section>
        ) : (
          <section className="text-center">
            <div className="mb-8">
              <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-2 font-bold">Your Character</h2>
              <p className="text-3xl font-heading font-bold text-white mt-2">{user.character.name}</p>
              <div
                className="w-20 h-20 mx-auto mt-6 rounded-2xl border-4 border-white/10 shadow-[0_0_30px_rgba(255,255,255,0.1)] flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: user.character.appearanceColor }}
              >
                 <div className="w-full h-full bg-gradient-to-br from-white/20 to-transparent" />
              </div>
              <div className="mt-6 flex flex-col items-center gap-2">
                <span className="text-xl text-brand-secondary font-bold">💰 ${user.character.wallet.toLocaleString()}</span>
                <form action={doWork}>
                  <Button type="submit" variant="outline" className="text-sm border-white/20 text-white hover:bg-white/10">
                    ⚒️ Work (+ $500)
                  </Button>
                </form>
              </div>
            </div>

            <Link href="/town/1" className="block">
              <Button className="w-full py-8 text-xl font-bold bg-brand-secondary hover:bg-brand-secondary/80 text-brand-neutral rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(255,184,0,0.2)]">
                ENTER TOWN
              </Button>
            </Link>
          </section>
        )}

        <div className="mt-8 text-center">
          <Link href="/login" className="text-xs text-gray-500 hover:text-white transition-colors uppercase tracking-widest">
            Switch Account
          </Link>
        </div>
      </div>
    </div>
  );
}
