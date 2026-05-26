"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

type TownSelectProps = {
  currentTownId: string;
  onTownChange: (id: any) => void;
};

type TownOption = {
  id: string;
  name: string;
};

export function TownSelect({ currentTownId, onTownChange }: TownSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [, setHometownId] = useLocalStorage("hometownId", "");
  const [towns, setTowns] = useState<TownOption[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadTowns = async () => {
      try {
        const res = await fetch("/api/towns", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { towns?: TownOption[] };
        if (cancelled) return;
        setTowns((json.towns ?? []).filter((town) => town.id && town.name));
      } catch (error) {
        console.error("TownSelect: failed to load towns", error);
        if (!cancelled) setTowns([]);
      }
    };

    void loadTowns();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Select
      value={currentTownId}
      onValueChange={(val) => {
        setHometownId(val);
        onTownChange(val);
        startTransition(() => {
          router.push(`/town/${val}`);
        });
      }}
      disabled={isPending || towns.length === 0}
    >
      <SelectTrigger className="w-fit bg-transparent border-none text-[clamp(1.1rem,2vw,1.85rem)] leading-tight font-black italic tracking-tighter cyber-glitch-text text-white focus:ring-0 focus:ring-offset-0 p-0 shadow-none hover:opacity-80 h-auto">
        {isPending ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Traveling...</span>
          </div>
        ) : (
          <SelectValue placeholder={towns.length ? "Select Town" : "No towns available"} />
        )}
      </SelectTrigger>
      <SelectContent className="bg-[#0B0714]/95 backdrop-blur-xl border-white/15 text-white z-[100]">
        {towns.map((town) => (
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
