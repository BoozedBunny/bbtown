"use client";

import { useState } from "react";
import Image from "next/image";
import { createCharacter, updateCharacter } from "../actions/character";

const AVATARS = [
  { id: "bunny", label: "Bunny", src: "https://www.boozedbunnytown.com/media/avatars/bunny_avatar.webp" },
  { id: "cowie", label: "Cowie", src: "https://www.boozedbunnytown.com/media/avatars/cowie_avatar.webp" },
];

export function AvatarSelection({
  initialAvatar = "bunny",
  initialName = "",
  mode = "create",
}: {
  initialAvatar?: string;
  initialName?: string;
  mode?: "create" | "edit";
}) {
  const [selectedAvatar, setSelectedAvatar] = useState(initialAvatar);
  const [name, setName] = useState(initialName);

  return (
    <form action={mode === "create" ? createCharacter : updateCharacter} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="name" className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest block">
          Identifier
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 bg-black/60 border border-white/10 text-white font-mono focus:outline-none focus:border-brand-primary transition-colors"
          placeholder="Subject_Name"
        />
      </div>

      <div className="space-y-4">
        <label className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest block">
          Avatar_Selection
        </label>
        <div className="grid grid-cols-2 gap-4">
          {AVATARS.map((avatar) => (
            <label
              key={avatar.id}
              className={`relative cursor-pointer group border-2 transition-all p-2 flex flex-col items-center gap-2 ${
                selectedAvatar === avatar.id
                  ? "border-brand-primary bg-brand-primary/10"
                  : "border-white/5 bg-black/40 hover:border-white/20"
              }`}
            >
              <input
                type="radio"
                name="avatar"
                value={avatar.id}
                checked={selectedAvatar === avatar.id}
                onChange={() => setSelectedAvatar(avatar.id)}
                className="sr-only"
              />
              <div className="relative w-32 h-32 overflow-hidden cyber-skew">
                <Image
                  src={avatar.src}
                  alt={avatar.label}
                  fill
                  className="object-cover"
                />
              </div>
              <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${
                selectedAvatar === avatar.id ? "text-brand-primary" : "text-gray-500"
              }`}>
                {avatar.label}
              </span>
              {selectedAvatar === avatar.id && (
                <div className="absolute top-1 right-1">
                  <div className="w-2 h-2 bg-brand-primary animate-pulse" />
                </div>
              )}
            </label>
          ))}
        </div>
      </div>

      {mode === "create" && (
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
      )}

      <button
        type="submit"
        className="group relative w-full block"
      >
        <div className="absolute inset-0 bg-brand-primary/20 blur group-hover:bg-brand-primary/40 transition-all" />
        <div className="cyber-skew bg-brand-primary px-6 py-4 relative transition-all group-hover:translate-x-1 group-hover:-translate-y-1 text-center">
           <span className="text-sm font-black uppercase tracking-[0.2em] text-white">
             {mode === "create" ? "Initialize_Deployment" : "Update_Profile"}
           </span>
        </div>
      </button>
    </form>
  );
}
