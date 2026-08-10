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
  X,
  HandCoins,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import ExportActions from "@/components/admin/export-actions";
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
  payerCardNumber?: string | null;
  payerCardMasked?: string | null;
  payerBankName?: string | null;
  createdAt: string;
  updatedAt: string;
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
  async function review(id: string, action: "approve" | "reject") {
    const rejectionReason =
      action === "reject"
        ? window.prompt("دلیل رد رسید را وارد کنید:")?.trim()
        : undefined;
    if (action === "reject" && !rejectionReason) return;
    const response = await fetch(`/api/admin/payments/${id}`, {
      method: "PATCH",
      headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ action, rejectionReason }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error || "عملیات ناموفق بود");
      return;
    }
    toast.success(action === "approve" ? "پرداخت تأیید شد" : "پرداخت رد شد");
    setDetail(null);
    load();
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
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-secondary" />
      </div>
    );
  return (
    <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <section className="rounded-[1.8rem] bg-primary p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary-fixed text-primary">
              <CreditCard size={24} />
            </span>
            <div>
              <h1 className="text-xl font-black">مرکز پرداخت آکادمی</h1>
              <p className="mt-1 text-sm text-white/60">
                پیگیری پرداخت‌ها، بررسی رسیدها و مدیریت تخفیف‌ها.
              </p>
            </div>
          </div>
          <ExportActions
            endpoint="/api/admin/exports/payments"
            title="گزارش پرداخت‌های آکادمی"
            fileName="گزارش-پرداخت‌ها"
          />
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-4">
        {(
          [
            [
              "card",
              "کارت‌به‌کارت",
              CreditCard,
              `${card.length.toLocaleString("fa-IR")} سفارش`,
            ],
            [
              "bale",
              "کیف پول بله",
              MessageCircle,
              `${bale.length.toLocaleString("fa-IR")} سفارش`,
            ],
            [
              "manual",
              "پرداخت دستی",
              HandCoins,
              `${manual.length.toLocaleString("fa-IR")} ثبت`,
            ],
            ["discounts", "کدهای تخفیف", BadgePercent, "مدیریت گروه‌ها"],
          ] as const
        ).map(([key, title, Icon, text]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-2xl border p-5 text-right transition ${tab === key ? "border-secondary bg-[#fff8e9] shadow-sm" : "border-outline-variant/40 bg-white"}`}
          >
            <Icon size={22} className="mb-3 text-secondary" />
            <p className="font-black text-primary">{title}</p>
            <p className="mt-1 text-xs text-outline">{text}</p>
          </button>
        ))}
      </div>
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
            <section className="rounded-[1.8rem] border border-outline-variant/30 bg-white p-5 md:p-7">
              <h2 className="font-black text-primary">ثبت پرداخت دستی</h2>
              <p className="mt-1 text-xs text-outline">
                فقط درخواست‌های در انتظار پرداخت قابل انتخاب هستند. ثبت موفق،
                پرداخت و ثبت‌نام دوره را نهایی می‌کند.
              </p>
              {applicationsError ? (
                <p className="mt-4 rounded-xl bg-error-container p-3 text-sm text-error">
                  {applicationsError}
                </p>
              ) : (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-bold text-primary md:col-span-2">
                    درخواست ثبت‌نام
                    <select
                      value={manualForm.applicationId}
                      onChange={(event) =>
                        setManualForm({
                          ...manualForm,
                          applicationId: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-outline-variant bg-white px-4 py-3 font-normal"
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
                  <label className="text-sm font-bold text-primary">
                    شماره پیگیری (اختیاری)
                    <input
                      value={manualForm.reference}
                      onChange={(event) =>
                        setManualForm({
                          ...manualForm,
                          reference: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-outline-variant px-4 py-3 font-normal"
                    />
                  </label>
                  <label className="text-sm font-bold text-primary">
                    یادداشت (اختیاری)
                    <input
                      value={manualForm.note}
                      onChange={(event) =>
                        setManualForm({
                          ...manualForm,
                          note: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-outline-variant px-4 py-3 font-normal"
                    />
                  </label>
                  <button
                    onClick={createManualPayment}
                    disabled={saving || applications.length === 0}
                    className="flex w-fit items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    ثبت پرداخت دستی
                  </button>
                  {applications.length === 0 && (
                    <p className="self-center text-sm text-outline">
                      درخواست در انتظار پرداختی وجود ندارد.
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
          {tab === "card" && (
            <section className="rounded-[1.8rem] border border-outline-variant/30 bg-white p-5 md:p-7">
              <div className="mb-5 flex items-center gap-2">
                <Settings2 size={19} className="text-secondary" />
                <h2 className="font-black text-primary">
                  اطلاعات واریز کارت‌به‌کارت
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-bold text-primary">
                  شماره کارت
                  <input
                    value={settings.cardNumber || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, cardNumber: e.target.value })
                    }
                    dir="ltr"
                    className="mt-2 w-full rounded-xl border border-outline-variant px-4 py-3 font-normal"
                  />
                </label>
                <label className="text-sm font-bold text-primary">
                  نام صاحب حساب
                  <input
                    value={settings.cardHolder || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, cardHolder: e.target.value })
                    }
                    className="mt-2 w-full rounded-xl border border-outline-variant px-4 py-3 font-normal"
                  />
                </label>
                <label className="text-sm font-bold text-primary md:col-span-2">
                  توضیحات واریز
                  <textarea
                    value={settings.cardInstructions || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        cardInstructions: e.target.value,
                      })
                    }
                    className="mt-2 min-h-24 w-full rounded-xl border border-outline-variant px-4 py-3 font-normal"
                  />
                </label>
              </div>
              <button
                onClick={saveSettings}
                disabled={saving}
                className="mt-5 flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}{" "}
                ذخیره اطلاعات
              </button>
            </section>
          )}
          <section className="overflow-hidden rounded-[1.8rem] border border-outline-variant/30 bg-white">
            <div className="flex items-center justify-between border-b border-outline-variant/20 p-5">
              <div>
                <h2 className="font-black text-primary">سفارش‌ها</h2>
                <p className="mt-1 text-xs text-outline">
                  برای همه وضعیت‌ها جزئیات کامل قابل مشاهده است.
                </p>
              </div>
              <span className="rounded-full bg-surface-low px-3 py-1 text-xs text-outline">
                {shown.length.toLocaleString("fa-IR")} مورد
              </span>
            </div>
            <div className="divide-y divide-outline-variant/20">
              {shown.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col gap-4 p-5 md:flex-row md:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-primary">
                      {order.course.title}
                    </p>
                    <p className="mt-1 text-xs text-outline">
                      {order.user.name} ·{" "}
                      <span dir="ltr">{order.orderNumber}</span> ·{" "}
                      {f(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-primary">
                      {order.amountTomans.toLocaleString("fa-IR")} تومان
                    </span>
                    <span className="rounded-full bg-surface-low px-3 py-1 text-xs font-bold text-outline">
                      {labels[order.status] || order.status}
                    </span>
                    {order.method === "card_to_card" && order.payerBankName && (
                      <span className="hidden rounded-full bg-[#fff4df] px-3 py-1 text-xs font-bold text-secondary md:inline">
                        {order.payerBankName} · {order.payerCardMasked || "کارت ثبت نشده"}
                      </span>
                    )}
                    <button
                      onClick={() => setDetail(order)}
                      className="flex items-center gap-1 rounded-lg border border-outline-variant px-3 py-2 text-xs font-bold text-primary"
                    >
                      <Eye size={15} /> جزئیات
                    </button>
                  </div>
                </div>
              ))}
              {shown.length === 0 && (
                <p className="p-8 text-center text-sm text-outline">
                  سفارشی در این بخش وجود ندارد.
                </p>
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
    <section className="rounded-[1.8rem] border border-outline-variant/30 bg-white p-5 md:p-7">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-black text-primary">
          {editing ? "ویرایش کد تخفیف" : "افزودن کد تخفیف"}
        </h2>
        {editing && (
          <button onClick={onReset} className="text-sm text-outline">
            انصراف
          </button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-bold text-primary">
          نام گروه
          <input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="mt-2 w-full rounded-xl border border-outline-variant px-4 py-3 font-normal"
          />
        </label>
        <label className="text-sm font-bold text-primary">
          کد تخفیف
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            dir="ltr"
            className="mt-2 w-full rounded-xl border border-outline-variant px-4 py-3 font-normal"
          />
        </label>
        <label className="text-sm font-bold text-primary">
          درصد تخفیف
          <input
            value={form.percent}
            onChange={(e) =>
              setForm({ ...form, percent: Number(e.target.value) })
            }
            type="number"
            min="0"
            max="100"
            className="mt-2 w-full rounded-xl border border-outline-variant px-4 py-3 font-normal"
          />
        </label>
        <div className="flex items-end gap-5 pb-3 text-sm font-bold text-primary">
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
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
            />
            نیازمند مدرک
          </label>
        </div>
      </div>
      <button
        onClick={onSave}
        className="mt-5 flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white"
      >
        <Save size={16} />
        {editing ? "ذخیره تغییرات" : "افزودن کد"}
      </button>
      <div className="mt-7 divide-y divide-outline-variant/20 border-t border-outline-variant/20">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-primary">
                {item.label}{" "}
                <span className="mr-2 text-xs text-outline">
                  {item.percent.toLocaleString("fa-IR")}٪
                </span>
              </p>
              <p dir="ltr" className="mt-1 text-xs text-outline">
                {item.code}
              </p>
            </div>
            <span
              className={`text-xs ${item.active ? "text-green-700" : "text-error"}`}
            >
              {item.active ? "فعال" : "غیرفعال"}
            </span>
            <button onClick={() => onEdit(item)} className="text-primary">
              <Pencil size={17} />
            </button>
            <button onClick={() => onRemove(item.id)} className="text-error">
              <Trash2 size={17} />
            </button>
          </div>
        ))}
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
  onReview: (id: string, action: "approve" | "reject") => void;
  onReconciled: (id: string) => Promise<void>;
}) {
  const app = order.application;
  const recoveryAttempt = selectBaleReconciliationAttempt(order);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [receiptReference, setReceiptReference] = useState("");
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationError, setReconciliationError] = useState("");
  useEffect(() => {
    setTrackingNumber(recoveryAttempt?.baleTrackingNumber || order.baleTransactionRef || "");
    setReceiptReference(recoveryAttempt?.baleReceiptReference || "");
    setReconciliationError("");
  }, [order]);
  async function reconcileBalePayment() {
    if (!trackingNumber.trim()) {
      setReconciliationError("شماره پیگیری کیف پول بله را وارد کنید.");
      return;
    }
    setReconciling(true);
    setReconciliationError("");
    try {
      const response = await fetch(`/api/admin/payments/${order.id}/reconcile-bale`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getCookie("token")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNumber, receiptReference }),
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
    <p className="break-words text-sm text-outline">
      <b className="text-primary">{label}:</b> {value || "-"}
    </p>
  );
  const method =
    order.method === "bale_wallet"
      ? "کیف پول بله"
      : order.method === "manual"
        ? "پرداخت دستی"
        : "کارت‌به‌کارت";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-primary/60 p-4"
      onMouseDown={(e) => e.currentTarget === e.target && onClose()}
    >
      <section
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl"
        dir="rtl"
      >
        <div className="flex items-start justify-between border-b border-outline-variant/30 pb-4">
          <div>
            <h2 className="font-black text-primary">جزئیات پرداخت</h2>
            <p className="mt-1 text-xs text-outline" dir="ltr">
              {order.orderNumber}
            </p>
          </div>
          <button onClick={onClose} className="text-outline">
            <X />
          </button>
        </div>
        <div className="grid gap-6 py-6 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="font-bold text-primary">
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
            <h3 className="font-bold text-primary">زمان‌ها و بررسی</h3>
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
        <div className="border-t border-outline-variant/30 py-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-bold text-primary">سوابق تلاش‌های پرداخت</h3>
              <p className="mt-1 text-sm text-outline">
                {order.user.name} · {order.course.title} · <span dir="ltr">{order.orderNumber}</span>
              </p>
            </div>
            <span className="text-xs text-outline">{order.attempts.length.toLocaleString("fa-IR")} تلاش</span>
          </div>
          {order.attempts.length > 0 ? (
            <div className="mt-4 divide-y divide-outline-variant/30 border-y border-outline-variant/30">
              {order.attempts.map((attempt) => (
                <article key={attempt.id} className="py-5 first:pt-4 last:pb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-primary">تلاش {attempt.sequence.toLocaleString("fa-IR")}</h4>
                    <span className="rounded-full bg-surface-low px-2.5 py-1 text-xs font-bold text-outline">
                      {attempt.method === "bale_wallet" ? "کیف پول بله" : attempt.method === "card_to_card" ? "کارت‌به‌کارت" : "پرداخت دستی"}
                    </span>
                    <span className="rounded-full bg-surface-low px-2.5 py-1 text-xs font-bold text-outline">
                      {labels[attempt.status] || attempt.status}
                    </span>
                    {attempt.id === order.activeAttemptId && (
                      <span className="rounded-full bg-secondary-fixed px-2.5 py-1 text-xs font-bold text-primary">تلاش فعال</span>
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
            <p className="mt-4 rounded-xl bg-surface-low p-4 text-sm leading-7 text-outline">
              برای این سفارش قدیمی سابقه تلاش ثبت نشده است. در صورت وجود شناسه پرداخت بله، بازیابی امن یک سابقه ایجاد می‌کند.
            </p>
          )}
        </div>
        {app && (
          <div className="border-t border-outline-variant/30 py-5">
            <h3 className="mb-3 font-bold text-primary">دوره و فرم ثبت‌نام</h3>
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
          <div className="border-t border-outline-variant/30 py-5">
            <div className="rounded-2xl bg-[#fff8e9] p-4 sm:p-5">
              <h3 className="font-bold text-primary">بازیابی پرداخت کیف پول بله</h3>
              <p className="mt-2 text-sm leading-7 text-outline">
                سامانه ابتدا شناسه یکتای پرداخت ذخیره‌شده را استعلام می‌کند و فقط در صورت ناموفق بودن آن، شماره پیگیری کیف پول را به‌عنوان مسیر جایگزین بررسی می‌کند. نهایی‌سازی فقط با وضعیت دقیق paid و مبلغ ریالی یکسان انجام می‌شود.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-bold text-primary">
                  شماره پیگیری کیف پول بله
                  <input
                    required
                    value={trackingNumber}
                    onChange={(event) => setTrackingNumber(event.target.value)}
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="off"
                    className="mt-2 w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-base font-normal outline-none focus:border-secondary md:text-sm"
                    placeholder="شماره پیگیری تراکنش"
                  />
                </label>
                <label className="text-sm font-bold text-primary">
                  شماره مرجع رسید چاپی (اختیاری، ثبت دستی)
                  <input
                    value={receiptReference}
                    onChange={(event) => setReceiptReference(event.target.value)}
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="off"
                    className="mt-2 w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-base font-normal outline-none focus:border-secondary md:text-sm"
                    placeholder="شماره مرجع روی رسید"
                  />
                </label>
              </div>
              {reconciliationError && (
                <p role="alert" className="mt-4 rounded-xl bg-error-container px-4 py-3 text-sm font-bold leading-7 text-error">
                  {reconciliationError}
                </p>
              )}
              <button
                type="button"
                onClick={reconcileBalePayment}
                disabled={reconciling || !trackingNumber.trim()}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {reconciling ? <Loader2 size={17} className="animate-spin" /> : <RefreshCcw size={17} />}
                {reconciling ? "در حال استعلام از بله..." : "استعلام و بازیابی پرداخت بله"}
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-3 border-t border-outline-variant/30 pt-5">
          {order.receiptUrl && (
            <a
              href={order.receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-primary"
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
              className="flex items-center gap-1 rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-primary"
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
              className="flex items-center gap-1 rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-primary"
            >
              <ExternalLink size={16} />
              فاکتور بله
            </a>
          )}
          {order.method === "card_to_card" &&
            order.status === "under_review" && (
              <>
                <button
                  onClick={() => onReview(order.id, "approve")}
                  className="flex items-center gap-1 rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white"
                >
                  <Check size={16} />
                  تأیید
                </button>
                <button
                  onClick={() => onReview(order.id, "reject")}
                  className="rounded-xl bg-error px-4 py-2 text-sm font-bold text-white"
                >
                  رد پرداخت
                </button>
              </>
            )}
        </div>
      </section>
    </div>
  );
}

function PayerCardSpoiler({ order }: { order: Order }) {
  const [visible, setVisible] = useState(false);
  if (!order.payerCardMasked) return <span>ثبت نشده</span>;
  return <button type="button" onClick={() => setVisible((current) => !current)} className="inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-white px-2 py-1 font-mono text-xs font-bold text-primary" dir="ltr" title={visible ? "مخفی کردن شماره کارت" : "نمایش شماره کامل کارت"}>{visible ? order.payerCardNumber || order.payerCardMasked : order.payerCardMasked}{visible ? <EyeOff size={14} /> : <Eye size={14} />}</button>;
}
