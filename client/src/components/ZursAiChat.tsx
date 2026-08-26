import { cn } from "@/lib/utils";
import { ArrowLeft, Bot, Send, Sparkles, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { useLocation } from "wouter";
import { aiOpenIntentKey, openZursAiChat } from "@/lib/zursAiEvents";

export type ZursAiMessage = { role: "user" | "assistant"; content: string };
type ZursAiRecommendation = { gameId: string; name: string; href: string };
export { openZursAiChat } from "@/lib/zursAiEvents";

const prompts = [
  "ណែនាំកញ្ចប់ Mobile Legends",
  "តើត្រូវការលេខ ID អ្វីខ្លះ?",
  "មាន event ហ្គេមថ្មីអ្វីខ្លះ?",
];

function chatSessionId() {
  const key = "zurs:ai:session";
  const current = window.localStorage.getItem(key);
  if (current && /^[a-zA-Z0-9_-]{12,80}$/.test(current)) return current;
  const created = crypto.randomUUID().replace(/-/g, "");
  window.localStorage.setItem(key, created);
  return created;
}

export default function ZursAiChat({ initialOpen = false }: { initialOpen?: boolean }) {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(initialOpen);
  const [messages, setMessages] = useState<ZursAiMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [recommendations, setRecommendations] = useState<ZursAiRecommendation[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("zurs:open-ai-chat", show);
    if (window.sessionStorage.getItem(aiOpenIntentKey) === "1") {
      window.sessionStorage.removeItem(aiOpenIntentKey);
      show();
    }
    return () => window.removeEventListener("zurs:open-ai-chat", show);
  }, []);

  useEffect(() => {
    if (location === "/ai") setOpen(true);
  }, [location]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [messages, isThinking]);

  const close = () => {
    if (isThinking) return;
    if (location === "/ai") {
      setLocation("/");
      return;
    }
    setOpen(false);
  };

  const send = async (raw: string) => {
    const content = raw.trim();
    if (!content || isThinking) return;
    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setRecommendations([]);
    setInput("");
    setIsThinking(true);
    try {
      const response = await fetch("/api/ai/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-ZURS-Chat-Session": chatSessionId() },
        body: JSON.stringify({ messages: nextMessages }),
      });
      if (!response.ok || !response.body) throw new Error(response.status === 429 ? "assistant_busy" : "assistant_unavailable");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistant = "";
      const pushAssistant = () => setMessages((current) => {
        const last = current.at(-1);
        const next = { role: "assistant" as const, content: assistant || "__streaming__" };
        return last?.role === "assistant" ? [...current.slice(0, -1), next] : [...current, next];
      });
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const data = frame.split("\n").find((line) => line.startsWith("data:"))?.replace(/^data:\s*/, "");
          if (!data || data === "[DONE]") continue;
          try {
            const payload = JSON.parse(data) as { delta?: string; error?: string; recommendations?: ZursAiRecommendation[] };
            if (payload.error === "retry_message") {
              assistant = "សូមផ្ញើសារឡើងវិញ។";
              pushAssistant();
              continue;
            }
            if (payload.error === "assistant_busy") {
              assistant = "សេវាជំនួយកំពុងរវល់បន្តិច។ សូមសាកម្ដងទៀតបន្តិចក្រោយ។";
              pushAssistant();
              continue;
            }
            if (payload.delta) {
              assistant += payload.delta;
              pushAssistant();
            }
            if (Array.isArray(payload.recommendations)) setRecommendations(payload.recommendations.filter((item) => /^\/topup\/[a-zA-Z0-9_%.-]+$/.test(item.href)).slice(0, 2));
          } catch { /* Ignore transport keep-alives. */ }
        }
      }
      if (!assistant) setMessages((current) => [...current, { role: "assistant", content: "សុំអភ័យទោស ខ្ញុំមិនអាចឆ្លើយបានឥឡូវនេះទេ។ សូមសាកម្ដងទៀត។" }]);
    } catch (error) {
      const content = error instanceof Error && error.message === "assistant_busy"
        ? "សេវាជំនួយកំពុងរវល់បន្តិច។ សូមសាកម្ដងទៀតបន្តិចក្រោយ។"
        : "សុំអភ័យទោស ខ្ញុំមិនអាចឆ្លើយបានឥឡូវនេះទេ។ សូមសាកម្ដងទៀត។";
      setMessages((current) => [...current, { role: "assistant", content }]);
    } finally {
      setIsThinking(false);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  };

  if (!open) return null;
  return (
    <section className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#081321] text-slate-100" role="dialog" aria-modal="true" aria-label="ZURS AI">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-[#0d1c2e]/95 px-4 backdrop-blur-xl sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={close} disabled={isThinking} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 disabled:opacity-40" aria-label="ត្រឡប់ក្រោយ"><ArrowLeft className="h-5 w-5" /></button>
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-blue-600 shadow-lg shadow-cyan-500/20"><Bot className="h-5 w-5 text-slate-950" /></div>
          <div className="min-w-0"><p className="truncate text-sm font-extrabold tracking-wide text-white">ZURS AI</p><p className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-cyan-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Online · ជំនួយការ 24/7</p></div>
        </div>
        <button type="button" onClick={close} disabled={isThinking} className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40" aria-label="បិទឆាត"><X className="h-5 w-5" /></button>
      </header>

      <div className="relative flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute left-[16%] top-[8%] h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" /><div className="absolute bottom-[12%] right-[10%] h-64 w-64 rounded-full bg-blue-600/10 blur-3xl" /></div>
        <div className="relative mx-auto flex min-h-full max-w-3xl flex-col gap-4">
          {!messages.length ? <div className="my-auto py-10 text-center"><div className="zurs-ai-orb mx-auto grid h-20 w-20 place-items-center rounded-full border border-cyan-200/20 bg-cyan-400/10 shadow-[0_0_70px_rgba(34,211,238,0.22)] motion-reduce:animate-none"><Sparkles className="h-8 w-8 text-cyan-200" /></div><h1 className="mt-5 text-2xl font-extrabold tracking-tight text-white">សួស្តី ខ្ញុំគឺ ZURS AI</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">សួរអំពីហ្គេម កញ្ចប់ top-up និងរបៀបដាក់លេខ ID បានគ្រប់ពេល។</p><div className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">{prompts.map((prompt) => <button type="button" key={prompt} onClick={() => send(prompt)} className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs font-bold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-cyan-300/10">{prompt}</button>)}</div></div> : null}
          {messages.map((message, index) => <article key={`${message.role}-${index}`} className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}><div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm", message.role === "user" ? "order-2 rounded-tr-md bg-gradient-to-br from-cyan-300 to-blue-500 font-medium text-slate-950" : "rounded-tl-md border border-white/10 bg-white/[0.06] text-slate-100")}><div className="prose prose-invert prose-sm max-w-none">{message.role === "assistant" ? (message.content === "__streaming__" ? "" : <Streamdown>{message.content}</Streamdown>) : <p className="whitespace-pre-wrap">{message.content}</p>}</div></div><div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl", message.role === "user" ? "order-1 bg-white/10 text-slate-300" : "bg-cyan-400/15 text-cyan-200")} >{message.role === "user" ? <UserRound className="h-4 w-4" /> : <Bot className="h-4 w-4" />}</div></article>)}
          {isThinking ? <div className="flex items-center gap-3"><div className="zurs-ai-orb grid h-9 w-9 place-items-center rounded-xl border border-cyan-200/15 bg-cyan-400/10 motion-reduce:animate-none"><Sparkles className="h-4 w-4 text-cyan-100" /></div><span className="text-xs font-semibold text-cyan-100/70">ZURS AI កំពុងគិត…</span></div> : null}
          {recommendations.length ? <div className="ml-11 flex flex-wrap gap-2">{recommendations.map((item) => <a key={item.gameId} href={item.href} className="group flex min-w-36 items-center justify-between gap-3 rounded-xl border border-cyan-200/20 bg-cyan-300/[0.07] px-3 py-2.5 text-xs font-bold text-cyan-50 transition hover:-translate-y-0.5 hover:border-cyan-200/45 hover:bg-cyan-300/[0.14]"><span className="line-clamp-1">{item.name}</span><span className="text-[10px] text-cyan-300 group-hover:text-cyan-100">មើលកញ្ចប់</span></a>)}</div> : null}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); void send(input); }} className="shrink-0 border-t border-white/10 bg-[#0d1c2e]/95 p-3 backdrop-blur-xl sm:px-6"><div className="mx-auto flex max-w-3xl items-end gap-2"><textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value.slice(0, 800))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(input); } }} placeholder="សួរ ZURS AI…" disabled={isThinking} rows={1} className="min-h-11 max-h-32 flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/15 disabled:opacity-50" /><button type="submit" disabled={!input.trim() || isThinking} className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-300 text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40" aria-label="ផ្ញើសារ"><Send className="h-4 w-4" /></button></div><p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-slate-500">ZURS AI ណែនាំព័ត៌មាន និងកញ្ចប់ប៉ុណ្ណោះ។ ការទូទាត់នៅមិនទាន់បើកក្នុងឆាតទេ។</p></form>
    </section>
  );
}
