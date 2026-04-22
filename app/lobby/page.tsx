import { getSessionUser } from "../../lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createCharacter } from "../actions/character";

export default async function LobbyPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 text-black">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Lobby</h1>

        <div className="mb-8 p-4 bg-blue-50 rounded-md">
          <p className="text-gray-600">Logged in as: <span className="font-semibold text-blue-700">{user.username}</span></p>
        </div>

        {!user.character ? (
          <section>
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Create Your Character</h2>
            <form action={createCharacter} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Character Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter name..."
                />
              </div>
              <div>
                <label htmlFor="appearanceColor" className="block text-sm font-medium text-gray-700 mb-1">
                  Favorite Color
                </label>
                <select
                  id="appearanceColor"
                  name="appearanceColor"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="orange">Orange</option>
                  <option value="blue">Blue</option>
                  <option value="green">Green</option>
                  <option value="red">Red</option>
                  <option value="purple">Purple</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-semibold"
              >
                Create Character
              </button>
            </form>
          </section>
        ) : (
          <section className="text-center">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-700">Character Details</h2>
              <p className="text-2xl font-bold text-gray-900 mt-2">{user.character.name}</p>
              <div
                className="w-16 h-16 mx-auto mt-4 rounded-full border-4 border-white shadow-inner"
                style={{ backgroundColor: user.character.appearanceColor }}
              ></div>
            </div>

            <Link
              href="/town/1"
              className="inline-block w-full py-3 px-6 bg-green-600 text-white rounded-md hover:bg-green-700 transition text-lg font-bold shadow-lg"
            >
              Go to Town
            </Link>
          </section>
        )}

        <div className="mt-8 text-center">
          <Link href="/login" className="text-sm text-gray-500 hover:underline">
            Switch Account
          </Link>
        </div>
      </div>
    </div>
  );
}
