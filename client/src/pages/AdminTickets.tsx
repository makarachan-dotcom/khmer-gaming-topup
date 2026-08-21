import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, LifeBuoy, Loader2, MessageSquareText, ShieldAlert } from "lucide-react";
import { useState } from "react";

const ticketLabels: Record<string, string> = { open: "Ticket ថ្មី", reviewing: "កំពុងពិនិត្យ", resolved: "បានដោះស្រាយ", closed: "បានបិទ" };

export default function AdminTickets() {
  const { user, loading } = useAuth();
  const isAdmin = user?.email?.toLowerCase() === "chanmakara672@gmail.com" || user?.role === "admin";
  if (loading) return <div className="min-h-screen bg-slate-50" />;
  if (!isAdmin) return <div className="grid min-h-screen place-items-center bg-slate-50 p-4"><div className="rounded-2xl bg-white p-6 text-center shadow-xl"><ShieldAlert className="mx-auto h-8 w-8 text-rose-600" /><p className="mt-3 text-sm font-bold text-slate-900">Admin access only</p></div></div>;
  return <DashboardLayout><main className="mx-auto max-w-5xl pb-10"><p className="text-xs font-bold tracking-[0.14em] text-indigo-700">CUSTOMER SUPPORT</p><h1 className="mt-1 font-display text-3xl font-bold text-slate-950">Ticket ការបញ្ជាទិញ</h1><p className="mt-2 text-sm text-slate-500">ពិនិត្យសំណើជំនួយដែលភ្ជាប់នឹង Top-up និង SMM purchase ID របស់អតិថិជន។</p><TicketList /></main></DashboardLayout>;
}

function TicketList() {
  const tickets = trpc.admin.orderSupportTickets.useQuery();
  const utils = trpc.useUtils();
  const review = trpc.admin.reviewOrderSupportTicket.useMutation({ onSuccess: () => utils.admin.orderSupportTickets.invalidate() });
  if (tickets.isLoading) return <div className="mt-6 grid min-h-40 place-items-center rounded-2xl border border-slate-200 bg-white"><Loader2 className="h-5 w-5 animate-spin text-indigo-600" /></div>;
  if (!tickets.data?.length) return <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-500">មិនទាន់មាន ticket ពីអតិថិជនទេ។</div>;
  return <section className="mt-6 space-y-3">{tickets.data.map(({ ticket, order, customer }) => <TicketCard key={ticket.id} ticket={ticket} order={order} customer={customer} pending={review.isPending} onSave={(status, adminReply) => review.mutate({ ticketId: ticket.id, status, adminReply })} />)}</section>;
}

function TicketCard({ ticket, order, customer, pending, onSave }: { ticket: { id: string; ticketNumber: string; subject: string; message: string; status: "open" | "reviewing" | "resolved" | "closed"; adminReply: string | null; createdAt: Date | string }; order: { orderNumber: string; trackingCode: string; productName: string; status: string }; customer: { id: number | null; displayName: string | null; email: string | null } | null; pending: boolean; onSave: (status: "open" | "reviewing" | "resolved" | "closed", reply: string) => void }) {
  const [status, setStatus] = useState(ticket.status); const [reply, setReply] = useState(ticket.adminReply ?? "");
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-indigo-50 px-2 py-1 font-mono text-[10px] font-bold text-indigo-700">{ticket.ticketNumber}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{ticketLabels[ticket.status]}</span></div><h2 className="mt-3 text-sm font-bold text-slate-950">{ticket.subject}</h2><p className="mt-2 text-xs leading-6 text-slate-600">{ticket.message}</p></div><time className="text-[10px] text-slate-400">{new Date(ticket.createdAt).toLocaleString("km-KH")}</time></div><div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs"><p className="font-bold text-slate-800">{order.productName}</p><p className="mt-1 font-mono text-[10px] text-indigo-700">{order.trackingCode} · {order.orderNumber}</p><p className="mt-1 text-[10px] text-slate-500">Customer: {customer?.displayName ?? customer?.email ?? "—"} · Order: {order.status}</p></div><div className="mt-4 grid gap-2"><textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="ឆ្លើយតបទៅអតិថិជន…" className="min-h-20 rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-indigo-500" /><div className="flex flex-wrap gap-2"><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-9 rounded-lg border border-slate-200 px-2 text-xs font-bold text-slate-700"><option value="open">Ticket ថ្មី</option><option value="reviewing">កំពុងពិនិត្យ</option><option value="resolved">បានដោះស្រាយ</option><option value="closed">បានបិទ</option></select><button disabled={pending} onClick={() => onSave(status, reply)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" />រក្សាទុកការឆ្លើយតប</button></div></div></article>;
}
