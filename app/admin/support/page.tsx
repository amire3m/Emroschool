"use client";

import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import {
  Badge,
  DangerButton,
  EmptyState,
  FilterChips,
  Modal,
  PageHeader,
  PrimaryButton,
  type BadgeTone,
} from "@/components/admin/ui";

type Ticket = { id: string; number: string; subject: string; status: string; createdAt: string; updatedAt: string; user: { name: string; email: string }; _count: { messages: number } };
type TicketDetail = Ticket & { messages: { id: string; body: string; createdAt: string; author: { id: string; name: string; role: string } }[] };
const statusLabels: Record<string, string> = { open: "باز", waiting_for_support: "در انتظار پشتیبانی", waiting_for_user: "در انتظار کاربر", closed: "بسته" };
const statusTones: Record<string, BadgeTone> = { open: "emerald", waiting_for_support: "amber", waiting_for_user: "amber", closed: "slate" };

const INPUT_CLASS = "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#03004b] focus:ring-2 focus:ring-[#03004b]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]); const [loading, setLoading] = useState(true); const [selected, setSelected] = useState<TicketDetail | null>(null); const [reply, setReply] = useState(""); const [saving, setSaving] = useState(false); const [filter, setFilter] = useState("all");
  const auth = () => ({ authorization: `Bearer ${getCookie("token") || ""}` });
  const load = async () => { setLoading(true); try { const res = await fetch("/api/admin/support/tickets", { headers: auth() }); const data = await res.json(); if (!res.ok) throw new Error(data.error); setTickets(data.tickets || []); } catch (e) { toast.error(e instanceof Error ? e.message : "دریافت تیکت‌ها ناموفق بود"); } finally { setLoading(false); } };
  const openTicket = async (id: string) => { try { const res = await fetch(`/api/admin/support/tickets/${id}`, { headers: auth() }); const data = await res.json(); if (!res.ok) throw new Error(data.error); setSelected(data.ticket); setReply(""); } catch (e) { toast.error(e instanceof Error ? e.message : "دریافت تیکت ناموفق بود"); } };
  const update = async (status?: string) => { if (!selected) return; if (!status && !reply.trim()) return; setSaving(true); try { const res = await fetch(`/api/admin/support/tickets/${selected.id}`, { method: "PATCH", headers: { ...auth(), "Content-Type": "application/json" }, body: JSON.stringify({ message: reply.trim() || undefined, status }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); toast.success(status === "closed" ? "تیکت بسته شد" : reply.trim() ? "پاسخ ارسال شد" : "وضعیت بروزرسانی شد"); await load(); await openTicket(selected.id); } catch (e) { toast.error(e instanceof Error ? e.message : "بروزرسانی ناموفق بود"); } finally { setSaving(false); } };
  useEffect(() => { load(); }, []);
  const shown = tickets.filter((ticket) => filter === "all" || ticket.status === filter);
  return (
    <div className="mx-auto max-w-6xl space-y-5" dir="rtl">
      <PageHeader title="پشتیبانی کاربران" subtitle="رسیدگی به پیام‌ها و درخواست‌های کاربران" />
      <FilterChips
        options={[
          { value: "all", label: "همه" },
          { value: "waiting_for_support", label: "نیازمند پاسخ" },
          { value: "waiting_for_user", label: "در انتظار کاربر" },
          { value: "closed", label: "بسته" },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="animate-spin text-[#03004b]" />
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="divide-y divide-slate-100">
            {shown.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => openTicket(ticket.id)}
                className="flex w-full flex-col gap-3 p-5 text-right transition hover:bg-slate-50/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b] sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900">#{ticket.number.slice(-6)} · {ticket.subject}</p>
                  <p className="mt-1 text-xs text-slate-500">{ticket.user.name} · {ticket.user.email} · {ticket._count.messages.toLocaleString("fa-IR")} پیام</p>
                </div>
                <Badge tone={statusTones[ticket.status] ?? "slate"}>{statusLabels[ticket.status]}</Badge>
                <span className="text-xs tabular-nums text-slate-500">{new Date(ticket.updatedAt).toLocaleDateString("fa-IR")}</span>
              </button>
            ))}
            {shown.length === 0 && <EmptyState message="تیکتی در این بخش وجود ندارد." />}
          </div>
        </section>
      )}
      {selected && (
        <Modal
          title={`#${selected.number.slice(-6)} · ${selected.subject}`}
          subtitle={`${selected.user.name} · ${selected.user.email}`}
          onClose={() => setSelected(null)}
          maxWidth="max-w-3xl"
          footer={
            <>
              <PrimaryButton disabled={saving || !reply.trim()} onClick={() => update()}>
                <Send size={15} />
                ارسال پاسخ
              </PrimaryButton>
              {selected.status !== "closed" && (
                <DangerButton disabled={saving} onClick={() => update("closed")}>
                  بستن تیکت
                </DangerButton>
              )}
              <select
                value={selected.status}
                onChange={(e) => update(e.target.value)}
                disabled={saving}
                className={INPUT_CLASS}
              >
                <option value="open">باز</option>
                <option value="waiting_for_support">در انتظار پشتیبانی</option>
                <option value="waiting_for_user">در انتظار کاربر</option>
                <option value="closed">بسته</option>
              </select>
            </>
          }
        >
          <div className="max-h-[50vh] space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
            {selected.messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[85%] rounded-2xl p-4 ${message.author.role === "user" ? "mr-auto border border-slate-200 bg-white text-slate-900" : "bg-[#03004b] text-white"}`}
              >
                <p className="mb-1 text-xs font-bold opacity-70">{message.author.name}</p>
                <p className="whitespace-pre-wrap text-sm leading-7">{message.body}</p>
                <p className="mt-2 text-[10px] tabular-nums opacity-60">{new Date(message.createdAt).toLocaleString("fa-IR")}</p>
              </div>
            ))}
          </div>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            maxLength={5000}
            placeholder="پاسخ پشتیبانی..."
            className={`${INPUT_CLASS} mt-4 min-h-24 w-full resize-y leading-7`}
          />
        </Modal>
      )}
    </div>
  );
}
