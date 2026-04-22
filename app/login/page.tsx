"use client";

import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const handleLogin = (username: string) => {
    // Simple mock auth: set a cookie
    document.cookie = `mock_user=${username}; path=/; max-age=3600`;
    router.push("/lobby");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-black">
      <div className="p-8 bg-white rounded shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">Login to BB-Town</h1>
        <div className="space-y-4">
          <button
            onClick={() => handleLogin("Player1")}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Login as Player1
          </button>
          <button
            onClick={() => handleLogin("Player2")}
            className="w-full py-2 px-4 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            Login as Player2
          </button>
        </div>
      </div>
    </div>
  );
}
