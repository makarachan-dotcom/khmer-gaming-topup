import { cn } from "@/lib/utils";

export default function GameMark({ label, className }: { label: string; className?: string }) {
  return <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 text-xs font-extrabold tracking-tight text-white ring-1 ring-white/25", className)}>{label}</div>;
}
