import { ChevronDown } from "lucide-react";
import React, { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

export function CompactDisclosure({ label, summary, children, className }: { label: string; summary: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return <section className={cn("surface overflow-hidden rounded-2xl", className)}><button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left"><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-900">{label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{summary}</span></span><ChevronDown className={cn("h-4 w-4 shrink-0 text-indigo-600 transition-transform", open && "rotate-180")} /></button>{open && <div className="border-t border-slate-100 px-4 pb-4 pt-3 text-xs leading-6 text-slate-600">{children}</div>}</section>;
}
