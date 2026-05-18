"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TOWNS } from "@/app/town/towns";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";

type TownSelectProps = {
  currentTownId: string;
};

export function TownSelect({ currentTownId }: TownSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [_, setHometownId] = useLocalStorage("hometownId", "1");

  return (
    <Select
      value={currentTownId}
      onValueChange={(val) => {
        setHometownId(val);
        startTransition(() => {
          router.push(`/town/${val}`);
        });
      }}
      disabled={isPending}
    >
      <SelectTrigger className="w-fit bg-transparent border-none text-[clamp(1.1rem,2vw,1.85rem)] leading-tight font-black italic tracking-tighter cyber-glitch-text text-white focus:ring-0 focus:ring-offset-0 p-0 shadow-none hover:opacity-80 h-auto">
        {isPending ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Traveling...</span>
          </div>
        ) : (
          <SelectValue placeholder="Select Town" />
        )}
      </SelectTrigger>
      <SelectContent className="bg-[#0B0714]/95 backdrop-blur-xl border-white/15 text-white z-[100]">
        {TOWNS.map((town) => (
          <SelectItem
            key={town.id}
            value={town.id}
            className="cursor-pointer hover:bg-white/10 focus:bg-white/10 focus:text-white"
          >
            <span className="font-bold italic">{town.name}</span>
            <span className="text-brand-secondary ml-2">#{town.id}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
