"use client";

import { useEffect, useState } from "react";
import {
  BadgePercent,
  Check,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  MessageCircle,
  Pencil,
  RefreshCcw,
  Save,
  Settings2,
  Trash2,
  HandCoins,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import ExportActions from "@/components/admin/export-actions";
import {
  Badge,
  DangerButton,
  EmptyState,
  FilterChips,
  Modal,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatCard,
} from "@/components/admin/ui";
import {
  isBaleReconciliationEligible,
  selectBaleReconciliationAttempt,
} from "@/lib/bale-payment-reconciliation";

type Order = {
  id: string;
  orderNumber: string;
  amountTomans: number;
  amountRials: number;
  method: string;
  status: string;
  activeAttemptId?: string | null;
  baleTransactionRef?: string | null;
  manualReference?: string | null;
  manualNote?: string | null;
  receiptUrl?: string | null;
  baleInvoiceUrl?: string | null;
  payerBaleId?: string | null;
  payerBaleName?: string | null;
  hasBalePayerEvidence?: boolean;
  payerCardNumber?: string | null;
  payerCardMasked?: string | null;
  payerBankName?: string | null;
  payerBankSlug?: string | null;
  createdAt: string;
  updatedAt: string;
  reviewVersion: number;
  reviewDecisions?: PaymentReviewDecision[];
  paymentGrant?: PaymentGrant | null;
  receiptSubmittedAt?: string | null;
  reviewedAt?: string | null;
  paidAt?: string | null;
  expiresAt?: string | null;
  attempts: PaymentAttempt[];
  user: {
    name: string;
    email: string;
    phone?: string | null;
    nationalCode?: string | null;
  };
  course: { title: string; price: number };
  reviewer?: { name: string; email: string } | null;
  createdBy?: { name: string; email: string } | null;
  application?: {
    fullName: string;
    email: string;
    phone: string;
    nationalCode?: string | null;
    birthDate?: string | null;
    province: string;
    city: string;
    address: string;
    postalCode: string;
    workHistory?: string | null;
    artHistory?: string | null;
    educationLevel: string;
    educationField: string;
    reason: string;
    knowsInstructors: boolean;
    familiarityDetails?: string | null;
    instagramId?: string | null;
    virtualPhone: string;
    landline?: string | null;
    discountLabel?: string | null;
    discountPercent?: number | null;
    finalAmountTomans: number;
    discountDocumentUrl?: string | null;
  } | null;
};
type PaymentAttempt = {
  id: string;
  sequence: number;
  method: string;
  status: string;
  amountRials: number;
  balePaymentId?: string | null;
  baleTrackingNumber?: string | null;
  baleReceiptReference?: string | null;
  baleVerificationStatus: string;
  rejectionReason?: string | null;
  createdAt: string;
  expiresAt?: string | null;
  baleInvoiceSentAt?: string | null;
  balePreCheckoutAt?: string | null;
  paidAt?: string | null;
  submittedAt?: string | null;
  invalidatedAt?: string | null;
};
type PaymentReviewDecision = {
  id: string;
  action: string;
  reason?: string | null;
  fromStatus: string;
  toStatus: string;
  reviewVersion: number;
  createdAt: string;
  reviewer?: { id: string; name: string; email: string } | null;
};
type PaymentGrant = {
  sourceId: string;
  active: boolean;
  revokedAt?: string | null;
};
type Settings = {
  cardNumber?: string | null;
  cardHolder?: string | null;
  cardInstructions?: string | null;
};
type Discount = {
  id: string;
  label: string;
  code: string;
  percent: number;
  active: boolean;
  requiresDocument: boolean;
};
type Application = {
  id: string;
  status: string;
  fullName: string;
  course: { title: string };
  finalAmountTomans: number;
};
const labels: Record<string, string> = {
  pending: "در انتظار پرداخت",
  awaiting_receipt: "در انتظار رسید",
  under_review: "نیازمند بررسی",
  paid: "موفق",
  rejected: "رد شده",
  expired: "منقضی",
  invalidated: "باطل شده",
  paid_duplicate: "پرداخت تکراری",
  review_reopened: "بازبینی مجدد",
};
const reviewActionLabels: Record<string, string> = {
  approve: "تأیید رسید",
  reject: "رد رسید",
  reopen_rejection: "بازگشایی رد",
  reverse_approval: "بازگشت تأیید",
};
const verificationLabels: Record<string, string> = {
  unverified: "تأیید نشده",
  received: "شواهد دریافت شده",
  successful_payment: "رویداد پرداخت موفق بله",
  inquiry_paid: "تأییدشده با استعلام بله",
};
const emptyDiscount = {
  label: "",
  code: "",
  percent: 0,
  active: true,
  requiresDocument: true,
};
const f = (value?: string | null) =>
  value ? new Date(value).toLocaleString("fa-IR") : "-";

const INPUT =
  "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#03004b] focus:ring-2 focus:ring-[#03004b]/15";

function orderStatusTone(status: string): "amber" | "emerald" | "red" | "slate" {
  if (status === "paid" || status === "paid_duplicate") return "emerald";
  if (status === "rejected") return "red";
  if (
    status === "pending" ||
    status === "awaiting_receipt" ||
    status === "under_review" ||
    status === "review_reopened"
  )
    return "amber";
  return "slate";
}

function PaymentsAdminPage() {
  const [tab, setTab] = useState<"card" | "bale" | "manual" | "discounts">(
    "card",
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Order | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [discountForm, setDiscountForm] = useState(emptyDiscount);
  const [editing, setEditing] = useState<string | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationsError, setApplicationsError] = useState("");
  const [manualForm, setManualForm] = useState({
    applicationId: "",
    reference: "",
    note: "",
  });
  const auth = () => ({ Authorization: `Bearer ${getCookie("token")}` });
  async function load() {
    try {
      const response = await fetch("/api/admin/payments", { headers: auth() });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "دریافت پرداخت‌ها ناموفق بود");
        return null;
      }
      const nextOrders = data.orders || [];
      setOrders(nextOrders);
      setSettings(data.settings || {});
      return nextOrders as Order[];
    } catch {
      toast.error("ارتباط برای دریافت پرداخت‌ها برقرار نشد");
      return null;
    } finally {
      setLoading(false);
    }
  }
  async function loadDiscounts() {
    const response = await fetch("/api/admin/discount-codes", {
      headers: auth(),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error || "دریافت کدها ناموفق بود");
      return;
    }
    setDiscounts(data.discountCodes || []);
  }
  async function loadApplications() {
    setApplicationsError("");
    const response = await fetch("/api/course-applications?admin=1", {
      headers: auth(),
    });
    const data = await response.json();
    if (!response.ok) {
      setApplicationsError(data.error || "دریافت درخواست‌ها ناموفق بود");
      return;
    }
    setApplications(
      (data.applications || []).filter((application: Application) =>
        ["pending", "pending_payment"].includes(application.status),
      ),
    );
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (tab === "discounts") loadDiscounts();
  }, [tab]);
  useEffect(() => {
    if (tab === "manual") loadApplications();
  }, [tab]);
  async function saveSettings() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/payments", {
        method: "PATCH",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSettings(data.settings);
      toast.success("تنظیمات ذخیره شد");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ذخیره ناموفق بود");
    } finally {
      setSaving(false);
    }
  }
  async function review(
    id: string,
    action: "approve" | "reject" | "reopen_rejection" | "reverse_approval",
    expectedReviewVersion: number,
    requireReason: boolean,
  ) {
    const reason = requireReason
      ? window.prompt("دلیل این اصلاح را وارد کنید (الزامی):")?.trim()
      : undefined;
    if (requireReason && !reason) return;
    const response = await fetch(`/api/admin/payments/${id}`, {
      method: "PATCH",
      headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason, expectedReviewVersion }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error || "عملیات ناموفق بود");
      if (response.status === 409) {
        const refreshed = await load();
        const updated = refreshed?.find((order) => order.id === id);
        if (updated) setDetail(updated);
      }
      return;
    }
    toast.success(
      action === "approve"
        ? "پرداخت تأیید شد"
        : action === "reject"
          ? "پرداخت رد شد"
          : action === "reopen_rejection"
            ? "رد پرداخت بازگشایی شد"
            : "تأیید پرداخت بازگردانده شد",
    );
    const refreshed = await load();
    const updated = refreshed?.find((order) => order.id === id);
    if (updated) setDetail(updated);
  }
  function resetDiscount() {
    setDiscountForm(emptyDiscount);
    setEditing(null);
  }
  async function saveDiscount() {
    try {
      const response = await fetch("/api/admin/discount-codes", {
        method: editing ? "PATCH" : "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify(
          editing ? { ...discountForm, id: editing } : discountForm,
        ),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(editing ? "کد بروزرسانی شد" : "کد افزوده شد");
      resetDiscount();
      loadDiscounts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ذخیره ناموفق بود");
    }
  }
  async function removeDiscount(id: string) {
    if (!confirm("این کد حذف شود؟")) return;
    const response = await fetch("/api/admin/discount-codes", {
      method: "DELETE",
      headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) {
      toast.error("حذف کد ناموفق بود");
      return;
    }
    toast.success("کد حذف شد");
    loadDiscounts();
  }
  async function createManualPayment() {
    if (!manualForm.applicationId) {
      toast.error("درخواست ثبت‌نام را انتخاب کنید");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/payments/manual", {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify(manualForm),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "ثبت پرداخت دستی ناموفق بود");
      toast.success("پرداخت دستی ثبت و کاربر در دوره ثبت‌نام شد");
      setManualForm({ applicationId: "", reference: "", note: "" });
      await Promise.all([load(), loadApplications()]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ثبت پرداخت دستی ناموفق بود",
      );
    } finally {
      setSaving(false);
    }
  }
  const card = orders.filter((order) => order.method === "card_to_card");
  const bale = orders.filter((order) => order.method === "bale_wallet");
  const manual = orders.filter((order) => order.method === "manual");
  const shown = tab === "card" ? card : tab === "bale" ? bale : manual;
  if (loading)
    return (
      <div className="flex min-h-[50vh] items-center justify-center" dir="rtl">
        <Loader2 className="animate-spin text-slate-400" />
      </div>
    );
  return (
    <div className="mx-auto max-w-6xl space-y-5" dir="rtl">
      <PageHeader
        title="مرکز پرداخت آکادمی"
        subtitle="پیگیری پرداخت‌ها، بررسی رسیدها و مدیریت تخفیف‌ها."
        actions={
          <ExportActions
            endpoint="/api/admin/exports/payments"
            title="گزارش پرداخت‌های آکادمی"
            fileName="گزارش-پرداخت‌ها"
          />
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="کارت‌به‌کارت"
          value={card.length.toLocaleString("fa-IR")}
          sub={`${card.length.toLocaleString("fa-IR")} سفارش`}
          icon={CreditCard}
          tone="bg-slate-100 text-slate-600"
        />
        <StatCard
          label="کیف پول بله"
          value={bale.length.toLocaleString("fa-IR")}
          sub={`${bale.length.toLocaleString("fa-IR")} سفارش`}
          icon={MessageCircle}
          tone="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="پرداخت دستی"
          value={manual.length.toLocaleString("fa-IR")}
          sub={`${manual.length.toLocaleString("fa-IR")} ثبت`}
          icon={HandCoins}
          tone="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="کدهای تخفیف"
          value={discounts.length.toLocaleString("fa-IR")}
          sub="مدیریت گروه‌ها"
          icon={BadgePercent}
          tone="bg-amber-50 text-amber-600"
        />
      </div>
      <FilterChips
        value={tab}
        onChange={(value) => setTab(value as typeof tab)}
        options={[
          { value: "card", label: "کارت‌به‌کارت" },
          { value: "bale", label: "کیف پول بله" },
          { value: "manual", label: "پرداخت دستی" },
          { value: "discounts", label: "کدهای تخفیف" },
        ]}
      />
      {tab === "discounts" ? (
        <DiscountManager
          items={discounts}
          form={discountForm}
          setForm={setDiscountForm}
          editing={editing}
          onSave={saveDiscount}
          onEdit={(item) => {
            setDiscountForm({
              label: item.label,
              code: item.code,
              percent: item.percent,
              active: item.active,
              requiresDocument: item.requiresDocument,
            });
            setEditing(item.id);
          }}
          onReset={resetDiscount}
          onRemove={removeDiscount}
        />
      ) : (
        <>
          {tab === "manual" && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 md:p-6">
              <h2 className="text-base font-black text-slate-900">ثبت پرداخت دستی</h2>
              <p className="mt-1 text-xs text-slate-500">
                فقط درخواست‌های در انتظار پرداخت قابل انتخاب هستند. ثبت موفق،
                پرداخت و ثبت‌نام دوره را نهایی می‌کند.
              </p>
              {applicationsError ? (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                  {applicationsError}
                </p>
              ) : (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-bold text-slate-900 md:col-span-2">
                    درخواست ثبت‌نام
                    <select
                      value={manualForm.applicationId}
                      onChange={(event) =>
                        setManualForm({
                          ...manualForm,
                          applicationId: event.target.value,
                        })
                      }
                      className={`${INPUT} mt-2 w-full`}
                    >
                      <option value="">انتخاب کنید</option>
                      {applications.map((application) => (
                        <option key={application.id} value={application.id}>
                          {application.fullName} - {application.course.title} -{" "}
                          {application.finalAmountTomans.toLocaleString(
                            "fa-IR",
                          )}{" "}
                          تومان
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-bold text-slate-900">
                    شماره پیگیری (اختیاری)
                    <input
                      value={manualForm.reference}
                      onChange={(event) =>
                        setManualForm({
                          ...manualForm,
                          reference: event.target.value,
                        })
                      }
                      className={`${INPUT} mt-2 w-full`}
                    />
                  </label>
                  <label className="text-sm font-bold text-slate-900">
                    یادداشت (اختیاری)
                    <input
                      value={manualForm.note}
                      onChange={(event) =>
                        setManualForm({
                          ...manualForm,
                          note: event.target.value,
                        })
                      }
                      className={`${INPUT} mt-2 w-full`}
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                    <PrimaryButton
                      onClick={createManualPayment}
                      disabled={saving || applications.length === 0}
                    >
                      {saving && <Loader2 size={16} className="animate-spin" />}
                      ثبت پرداخت دستی
                    </PrimaryButton>
                    {applications.length === 0 && (
                      <p className="text-sm text-slate-500">
                        درخواست در انتظار پرداختی وجود ندارد.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
          {tab === "card" && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 md:p-6">
              <div className="mb-5 flex items-center gap-2">
                <Settings2 size={19} className="text-slate-400" />
                <h2 className="text-base font-black text-slate-900">
                  اطلاعات واریز کارت‌به‌کارت
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-bold text-slate-900">
                  شماره کارت
                  <input
                    value={settings.cardNumber || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, cardNumber: e.target.value })
                    }
                    dir="ltr"
                    className={`${INPUT} mt-2 w-full tabular-nums`}
                  />
                </label>
                <label className="text-sm font-bold text-slate-900">
                  نام صاحب حساب
                  <input
                    value={settings.cardHolder || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, cardHolder: e.target.value })
                    }
                    className={`${INPUT} mt-2 w-full`}
                  />
                </label>
                <label className="text-sm font-bold text-slate-900 md:col-span-2">
                  توضیحات واریز
                  <textarea
                    value={settings.cardInstructions || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        cardInstructions: e.target.value,
                      })
                    }
                    className={`${INPUT} mt-2 min-h-24 w-full`}
                  />
                </label>
              </div>
              <PrimaryButton
                onClick={saveSettings}
                disabled={saving}
                className="mt-5"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}{" "}
                ذخیره اطلاعات
              </PrimaryButton>
            </section>
          )}
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between p-5">
              <div>
                <h2 className="text-base font-black text-slate-900">سفارش‌ها</h2>
                <p className="mt-1 text-xs text-slate-500">
                  برای همه وضعیت‌ها جزئیات کامل قابل مشاهده است.
                </p>
              </div>
              <Badge tone="slate">
                {shown.length.toLocaleString("fa-IR")} مورد
              </Badge>
            </div>
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {shown.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col gap-4 p-5 transition hover:bg-slate-50/60 md:flex-row md:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900">
                      {order.course.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {order.user.name} ·{" "}
                      <span dir="ltr">{order.orderNumber}</span> ·{" "}
                      {f(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black tabular-nums text-slate-900">
                      {order.amountTomans.toLocaleString("fa-IR")} تومان
                    </span>
                    <Badge tone={orderStatusTone(order.status)}>
                      {labels[order.status] || order.status}
                    </Badge>
                    {order.method === "card_to_card" && order.payerBankName && (
                      <Badge tone="amber">
                        {order.payerBankName} · {order.payerCardMasked || "کارت ثبت نشده"}
                      </Badge>
                    )}
                    <SecondaryButton onClick={() => setDetail(order)}>
                      <Eye size={15} /> جزئیات
                    </SecondaryButton>
                  </div>
                </div>
              ))}
              {shown.length === 0 && (
                <EmptyState message="سفارشی در این بخش وجود ندارد." />
              )}
            </div>
          </section>
        </>
      )}
      {detail && (
        <PaymentDetail
          order={detail}
          onClose={() => setDetail(null)}
          onReview={review}
          onReconciled={async (id) => {
            const refreshed = await load();
            const updated = refreshed?.find((order) => order.id === id);
            if (updated) setDetail(updated);
          }}
        />
      )}
    </div>
  );
}

export default PaymentsAdminPage;

function DiscountManager({
  items,
  form,
  setForm,
  editing,
  onSave,
  onEdit,
  onReset,
  onRemove,
}: {
  items: Discount[];
  form: typeof emptyDiscount;
  setForm: (value: typeof emptyDiscount) => void;
  editing: string | null;
  onSave: () => void;
  onEdit: (item: Discount) => void;
  onReset: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 md:p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-black text-slate-900">
          {editing ? "ویرایش کد تخفیف" : "افزودن کد تخفیف"}
        </h2>
        {editing && (
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]"
          >
            انصراف
          </button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-bold text-slate-900">
          نام گروه
          <input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className={`${INPUT} mt-2 w-full`}
          />
        </label>
        <label className="text-sm font-bold text-slate-900">
          کد تخفیف
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            dir="ltr"
            className={`${INPUT} mt-2 w-full`}
          />
        </label>
        <label className="text-sm font-bold text-slate-900">
          درصد تخفیف
          <input
            value={form.percent}
            onChange={(e) =>
              setForm({ ...form, percent: Number(e.target.value) })
            }
            type="number"
            min="0"
            max="100"
            className={`${INPUT} mt-2 w-full tabular-nums`}
          />
        </label>
        <div className="flex items-end gap-5 pb-3 text-sm font-bold text-slate-900">
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="accent-[#03004b]"
            />
            فعال
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={form.requiresDocument}
              onChange={(e) =>
                setForm({ ...form, requiresDocument: e.target.checked })
              }
              className="accent-[#03004b]"
            />
            نیازمند مدرک
          </label>
        </div>
      </div>
      <PrimaryButton onClick={onSave} className="mt-5">
        <Save size={16} />
        {editing ? "ذخیره تغییرات" : "افزودن کد"}
      </PrimaryButton>
      <div className="mt-7 divide-y divide-slate-100 border-t border-slate-100">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900">
                {item.label}{" "}
                <span className="mr-2 text-xs tabular-nums text-slate-500">
                  {item.percent.toLocaleString("fa-IR")}٪
                </span>
              </p>
              <p dir="ltr" className="mt-1 text-left text-xs text-slate-500">
                {item.code}
              </p>
            </div>
            <Badge tone={item.active ? "emerald" : "slate"}>
              {item.active ? "فعال" : "غیرفعال"}
            </Badge>
            <button
              type="button"
              onClick={() => onEdit(item)}
              aria-label="ویرایش"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]"
            >
              <Pencil size={17} />
            </button>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label="حذف"
              className="rounded-lg p-2 text-red-500 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]"
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <EmptyState message="کد تخفیفی ثبت نشده است." />
        )}
      </div>
    </section>
  );
}

function PaymentDetail({
  order,
  onClose,
  onReview,
  onReconciled,
}: {
  order: Order;
  onClose: () => void;
  onReview: (
    id: string,
    action: "approve" | "reject" | "reopen_rejection" | "reverse_approval",
    expectedReviewVersion: number,
    requireReason: boolean,
  ) => void;
  onReconciled: (id: string) => Promise<void>;
}) {
  const app = order.application;
  const defaultRecoveryAttempt = selectBaleReconciliationAttempt(order);
  const [recoveryAttemptId, setRecoveryAttemptId] = useState(defaultRecoveryAttempt?.id || "");
  const recoveryAttempt = selectBaleReconciliationAttempt(order, recoveryAttemptId) || defaultRecoveryAttempt;
  const [trackingNumber, setTrackingNumber] = useState("");
  const [receiptReference, setReceiptReference] = useState("");
  const [confirmUnmatchedPayer, setConfirmUnmatchedPayer] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationError, setReconciliationError] = useState("");
  useEffect(() => {
    const selected = selectBaleReconciliationAttempt(order);
    setRecoveryAttemptId(selected?.id || "");
    setTrackingNumber(selected?.baleTrackingNumber || order.baleTransactionRef || "");
    setReceiptReference(selected?.baleReceiptReference || "");
    setConfirmUnmatchedPayer(false);
    setReconciliationError("");
  }, [order]);
  async function reconcileBalePayment() {
    if (!trackingNumber.trim() && !recoveryAttempt?.balePaymentId) {
      setReconciliationError("شماره پیگیری کیف پول بله را وارد کنید.");
      return;
    }
    if (!order.hasBalePayerEvidence && (!receiptReference.trim() || !confirmUnmatchedPayer)) {
      setReconciliationError("برای سفارش بدون شواهد هویت بله، مرجع رسید و تأیید صریح مالکیت الزامی است.");
      return;
    }
    setReconciling(true);
    setReconciliationError("");
    try {
      const response = await fetch(`/api/admin/payments/${order.id}/reconcile-bale`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getCookie("token")}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: recoveryAttempt?.id,
          trackingNumber,
          receiptReference,
          confirmUnmatchedPayer,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "استعلام و بازیابی پرداخت انجام نشد");
      toast.success("پرداخت بله استعلام و بازیابی شد");
      await onReconciled(order.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ارتباط برای استعلام پرداخت برقرار نشد";
      setReconciliationError(message);
      toast.error(message);
    } finally {
      setReconciling(false);
    }
  }
  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <p className="break-words text-sm text-slate-500">
      <b className="font-bold text-slate-900">{label}:</b> {value || "-"}
    </p>
  );
  const method =
    order.method === "bale_wallet"
      ? "کیف پول بله"
      : order.method === "manual"
        ? "پرداخت دستی"
        : "کارت‌به‌کارت";
  const linkClass =
    "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";
  return (
    <Modal
      title="جزئیات پرداخت"
      subtitle={order.orderNumber}
      onClose={onClose}
      maxWidth="max-w-3xl"
      footer={
        <>
          {order.receiptUrl && (
            <a
              href={order.receiptUrl}
              target="_blank"
              rel="noreferrer"
              className={linkClass}
            >
              <ExternalLink size={16} />
              مشاهده رسید
            </a>
          )}
          {app?.discountDocumentUrl && (
            <a
              href={app.discountDocumentUrl}
              target="_blank"
              rel="noreferrer"
              className={linkClass}
            >
              <ExternalLink size={16} />
              مدرک تخفیف
            </a>
          )}
          {order.baleInvoiceUrl && (
            <a
              href={order.baleInvoiceUrl}
              target="_blank"
              rel="noreferrer"
              className={linkClass}
            >
              <ExternalLink size={16} />
              فاکتور بله
            </a>
          )}
          {order.method === "card_to_card" &&
            ["under_review", "review_reopened"].includes(order.status) && (
              <>
                <PrimaryButton
                  onClick={() =>
                    onReview(order.id, "approve", order.reviewVersion, false)
                  }
                >
                  <Check size={16} />
                  تأیید
                </PrimaryButton>
                <DangerButton
                  onClick={() =>
                    onReview(order.id, "reject", order.reviewVersion, true)
                  }
                >
                  رد پرداخت
                </DangerButton>
              </>
            )}
          {order.method === "card_to_card" && order.status === "rejected" && (
            <SecondaryButton
              onClick={() =>
                onReview(order.id, "reopen_rejection", order.reviewVersion, true)
              }
            >
              <RefreshCcw size={16} />
              بازگشایی رد پرداخت
            </SecondaryButton>
          )}
          {order.method === "card_to_card" && order.status === "paid" && (
            <DangerButton
              onClick={() =>
                onReview(order.id, "reverse_approval", order.reviewVersion, true)
              }
            >
              بازگرداندن تأیید پرداخت
            </DangerButton>
          )}
        </>
      }
    >
      <div dir="rtl">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-black text-slate-900">
              اطلاعات سفارش و پرداخت‌کننده
            </h3>
            <Row label="وضعیت" value={labels[order.status] || order.status} />
            <Row label="روش" value={method} />
            <Row
              label="مبلغ"
              value={`${order.amountTomans.toLocaleString("fa-IR")} تومان`}
            />
            <Row
              label="صاحب حساب"
              value={`${order.user.name} | ${order.user.phone || "-"}`}
            />
            <Row label="ایمیل حساب" value={order.user.email} />
            {order.method === "card_to_card" && (
              <>
                <Row label="بانک کارت پرداخت‌کننده" value={order.payerBankName} />
                <Row label="کارت پرداخت‌کننده" value={<PayerCardSpoiler order={order} />} />
              </>
            )}
            {order.method === "manual" && (
              <>
                <Row label="شماره پیگیری" value={order.manualReference} />
                <Row label="یادداشت" value={order.manualNote} />
                <Row
                  label="ثبت‌کننده"
                  value={
                    order.createdBy
                      ? `${order.createdBy.name} | ${order.createdBy.email}`
                      : "-"
                  }
                />
              </>
            )}
            {order.method === "bale_wallet" && (
              <>
                <Row label="پرداخت‌کننده بله" value={order.payerBaleName} />
                <Row label="شناسه بله" value={order.payerBaleId} />
              </>
            )}
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-black text-slate-900">زمان‌ها و بررسی</h3>
            <Row label="وضعیت" value={labels[order.status] || order.status} />
            <Row
              label="نسخه بررسی"
              value={order.reviewVersion.toLocaleString("fa-IR")}
            />
            <Row label="ایجاد سفارش" value={f(order.createdAt)} />
            <Row label="ارسال رسید" value={f(order.receiptSubmittedAt)} />
            <Row label="بازبینی" value={f(order.reviewedAt)} />
            <Row label="پرداخت موفق" value={f(order.paidAt)} />
            <Row label="انقضا" value={f(order.expiresAt)} />
            <Row
              label="بازبین"
              value={
                order.reviewer
                  ? `${order.reviewer.name} | ${order.reviewer.email}`
                  : "-"
              }
            />
          </div>
        </div>
        {order.method === "card_to_card" && order.paymentGrant && (
          <div
            role="status"
            className={`mt-4 rounded-xl border px-4 py-3 text-sm font-bold leading-7 ${order.paymentGrant.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600"}`}
          >
            {order.paymentGrant.active
              ? "دسترسی دوره فعال است (دسترسی پرداخت کارت‌به‌کارت فعال است)."
              : `دسترسی ناشی از این پرداخت معلق شده است${order.paymentGrant.revokedAt ? ` از ${f(order.paymentGrant.revokedAt)}` : ""}. دسترسی‌های مستقل (رایگان، دستی، ادمین و ...) همچنان پابرجا هستند.`}
          </div>
        )}
        {(order.reviewDecisions || []).length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <h3 className="mb-3 text-sm font-black text-slate-900">تاریخچه تصمیم‌های بازبینی</h3>
            <ol className="space-y-3">
              {order.reviewDecisions?.map((decision) => (
                <li
                  key={decision.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="navy">
                      {reviewActionLabels[decision.action] || decision.action}
                    </Badge>
                    <Badge tone="slate">
                      {labels[decision.fromStatus] || decision.fromStatus}
                      <span className="mx-1">←</span>
                      {labels[decision.toStatus] || decision.toStatus}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {f(decision.createdAt)}
                    </span>
                    {decision.reviewer && (
                      <span className="text-xs text-slate-500">
                        {decision.reviewer.name}
                      </span>
                    )}
                  </div>
                  {decision.reason && (
                    <p className="mt-2 text-sm leading-6 text-slate-900">
                      {decision.reason}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900">سوابق تلاش‌های پرداخت</h3>
              <p className="mt-1 text-sm text-slate-500">
                {order.user.name} · {order.course.title} · <span dir="ltr">{order.orderNumber}</span>
              </p>
            </div>
            <span className="text-xs tabular-nums text-slate-500">{order.attempts.length.toLocaleString("fa-IR")} تلاش</span>
          </div>
          {order.attempts.length > 0 ? (
            <div className="mt-4 divide-y divide-slate-100 border-y border-slate-100">
              {order.attempts.map((attempt) => (
                <article key={attempt.id} className="py-5 first:pt-4 last:pb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-slate-900">تلاش {attempt.sequence.toLocaleString("fa-IR")}</h4>
                    <Badge tone="slate">
                      {attempt.method === "bale_wallet" ? "کیف پول بله" : attempt.method === "card_to_card" ? "کارت‌به‌کارت" : "پرداخت دستی"}
                    </Badge>
                    <Badge tone={orderStatusTone(attempt.status)}>
                      {labels[attempt.status] || attempt.status}
                    </Badge>
                    {attempt.id === order.activeAttemptId && (
                      <Badge tone="emerald">تلاش فعال</Badge>
                    )}
                  </div>
                  <div className="mt-3 grid min-w-0 gap-2 md:grid-cols-2">
                    <Row label="مبلغ تلاش" value={`${attempt.amountRials.toLocaleString("fa-IR")} ریال`} />
                    <Row label="وضعیت راستی‌آزمایی" value={verificationLabels[attempt.baleVerificationStatus] || attempt.baleVerificationStatus} />
                    {attempt.method === "bale_wallet" && (
                      <>
                        <Row label="شناسه یکتای پرداخت بله" value={<span dir="ltr" className="break-all">{attempt.balePaymentId || "-"}</span>} />
                        <Row label="شماره پیگیری کیف پول بله" value={<span dir="ltr" className="break-all">{attempt.baleTrackingNumber || "-"}</span>} />
                        <Row label="شماره مرجع رسید چاپی (ثبت دستی)" value={<span dir="ltr" className="break-all">{attempt.baleReceiptReference || "-"}</span>} />
                        <Row label="شناسه داخلی تلاش" value={<span dir="ltr" className="break-all">{attempt.id}</span>} />
                        <Row label="ارسال فاکتور بله" value={f(attempt.baleInvoiceSentAt)} />
                        <Row label="تأیید پیش از پرداخت" value={f(attempt.balePreCheckoutAt)} />
                      </>
                    )}
                    <Row label="ایجاد تلاش" value={f(attempt.createdAt)} />
                    <Row label="مهلت پرداخت" value={f(attempt.expiresAt)} />
                    <Row label="ثبت رسید" value={f(attempt.submittedAt)} />
                    <Row label="پرداخت موفق" value={f(attempt.paidAt)} />
                    <Row label="باطل‌شدن" value={f(attempt.invalidatedAt)} />
                    {attempt.rejectionReason && <Row label="خطا یا دلیل رد" value={attempt.rejectionReason} />}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-500">
              برای این سفارش قدیمی سابقه تلاش ثبت نشده است. در صورت وجود شناسه پرداخت بله، بازیابی امن یک سابقه ایجاد می‌کند.
            </p>
          )}
        </div>
        {app && (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <h3 className="mb-3 text-sm font-black text-slate-900">دوره و فرم ثبت‌نام</h3>
            <div className="grid gap-2 md:grid-cols-2">
              <Row
                label="دوره"
                value={`${order.course.title} (${order.course.price.toLocaleString("fa-IR")} تومان)`}
              />
              <Row
                label="تخفیف"
                value={
                  app.discountLabel
                    ? `${app.discountLabel} (${app.discountPercent || 0}٪)`
                    : "ندارد"
                }
              />
              <Row
                label="ثبت‌نام‌کننده"
                value={`${app.fullName} | ${app.phone}`}
              />
              <Row label="کد ملی" value={app.nationalCode} />
              <Row label="تولد" value={app.birthDate} />
              <Row label="استان و شهر" value={`${app.province}، ${app.city}`} />
              <Row label="آدرس" value={app.address} />
              <Row label="کدپستی" value={app.postalCode} />
              <Row
                label="تحصیلات"
                value={`${app.educationLevel} | ${app.educationField}`}
              />
              <Row label="سوابق کاری" value={app.workHistory} />
              <Row label="سوابق هنری" value={app.artHistory} />
              <Row label="دلیل انتخاب" value={app.reason} />
              <Row label="اینستاگرام" value={app.instagramId} />
              <Row label="شماره مجازی" value={app.virtualPhone} />
              <Row label="تلفن ثابت" value={app.landline} />
              <Row
                label="آشنایی با اساتید"
                value={
                  app.knowsInstructors ? app.familiarityDetails || "بله" : "خیر"
                }
              />
            </div>
          </div>
        )}
        {isBaleReconciliationEligible(order) && (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="rounded-xl border border-slate-200 bg-amber-50 p-4 sm:p-5">
              <h3 className="text-sm font-black text-slate-900">بازیابی پرداخت کیف پول بله</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                سامانه ابتدا شناسه یکتای پرداخت ذخیره‌شده را استعلام می‌کند و فقط در صورت ناموفق بودن آن، شماره پیگیری کیف پول را به‌عنوان مسیر جایگزین بررسی می‌کند. نهایی‌سازی فقط با وضعیت دقیق paid و مبلغ ریالی یکسان انجام می‌شود.
              </p>
              {order.attempts.filter((attempt) => attempt.method === "bale_wallet" && !["paid", "paid_duplicate"].includes(attempt.status)).length > 1 && (
                <label className="mt-4 block text-sm font-bold text-slate-900">
                  تلاش پرداخت مورد بررسی
                  <select
                    value={recoveryAttemptId}
                    onChange={(event) => {
                      const selected = selectBaleReconciliationAttempt(order, event.target.value);
                      setRecoveryAttemptId(event.target.value);
                      setTrackingNumber(selected?.baleTrackingNumber || "");
                      setReceiptReference(selected?.baleReceiptReference || "");
                      setReconciliationError("");
                    }}
                    className={`${INPUT} mt-2 w-full`}
                  >
                    {order.attempts
                      .filter((attempt) => attempt.method === "bale_wallet" && !["paid", "paid_duplicate"].includes(attempt.status))
                      .map((attempt) => (
                        <option key={attempt.id} value={attempt.id}>
                          تلاش {attempt.sequence.toLocaleString("fa-IR")} · {labels[attempt.status] || attempt.status}
                          {attempt.balePaymentId || attempt.baleTrackingNumber ? " · دارای شواهد" : " · بدون شناسه"}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-bold text-slate-900">
                  شماره پیگیری کیف پول بله
                  <input
                    required
                    value={trackingNumber}
                    onChange={(event) => setTrackingNumber(event.target.value)}
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="off"
                    className={`${INPUT} mt-2 w-full tabular-nums`}
                    placeholder="شماره پیگیری تراکنش"
                  />
                </label>
                <label className="text-sm font-bold text-slate-900">
                  شماره مرجع رسید چاپی (اختیاری، ثبت دستی)
                  <input
                    value={receiptReference}
                    onChange={(event) => setReceiptReference(event.target.value)}
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="off"
                    className={`${INPUT} mt-2 w-full tabular-nums`}
                    placeholder="شماره مرجع روی رسید"
                  />
                </label>
              </div>
              {!order.hasBalePayerEvidence && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600">
                  <p>
                    این سفارش شناسه پرداخت‌کننده یا گفت‌وگوی خصوصی بله ندارد. مرجع رسید را وارد کنید و فقط پس از تطبیق مستقل مالک تراکنش، تأیید زیر را فعال کنید. نام و زمان بازبین ثبت می‌شود.
                  </p>
                  <label className="mt-3 flex cursor-pointer items-start gap-3 font-bold text-slate-900">
                    <input
                      type="checkbox"
                      checked={confirmUnmatchedPayer}
                      onChange={(event) => setConfirmUnmatchedPayer(event.target.checked)}
                      className="mt-1 h-4 w-4 accent-[#03004b]"
                    />
                    مالکیت این تراکنش برای همین ثبت‌نام را مستقلاً تأیید می‌کنم.
                  </label>
                </div>
              )}
              {reconciliationError && (
                <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold leading-7 text-red-600">
                  {reconciliationError}
                </p>
              )}
              <PrimaryButton
                onClick={reconcileBalePayment}
                disabled={reconciling || (!trackingNumber.trim() && !recoveryAttempt?.balePaymentId) || (!order.hasBalePayerEvidence && (!receiptReference.trim() || !confirmUnmatchedPayer))}
                className="mt-4 w-full sm:w-auto"
              >
                {reconciling ? <Loader2 size={17} className="animate-spin" /> : <RefreshCcw size={17} />}
                {reconciling ? "در حال استعلام از بله..." : "استعلام و بازیابی پرداخت بله"}
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PayerCardSpoiler({ order }: { order: Order }) {
  const [visible, setVisible] = useState(false);
  if (!order.payerCardMasked) return <span>ثبت نشده</span>;
  return <button type="button" onClick={() => setVisible((current) => !current)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-xs font-bold text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]" dir="ltr" title={visible ? "مخفی کردن شماره کارت" : "نمایش شماره کامل کارت"}>{visible ? order.payerCardNumber || order.payerCardMasked : order.payerCardMasked}{visible ? <EyeOff size={14} /> : <Eye size={14} />}</button>;
}
