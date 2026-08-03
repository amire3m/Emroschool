"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CreditCard,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Upload,
  WalletCards,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";

type Order = {
  id: string;
  orderNumber: string;
  amountTomans: number;
  method: string;
  status: string;
};
type Application = {
  id: string;
  status: string;
  finalAmountTomans: number;
  course: { title: string; slug: string };
};

export default function CheckoutPage() {
  const router = useRouter();
  const applicationId = useSearchParams().get("application");
  const [method, setMethod] = useState<"bale_wallet" | "card_to_card">(
    "bale_wallet",
  );
  const [order, setOrder] = useState<Order | null>(null);
  const [instructions, setInstructions] = useState<{
    cardNumber?: string | null;
    cardHolder?: string | null;
    instructions?: string | null;
  } | null>(null);
  const [botUrl, setBotUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [application, setApplication] = useState<Application | null>(null);
  const [applicationLoading, setApplicationLoading] = useState(true);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const token = getCookie("token");
    if (!token) {
      router.push(
        `/login?redirect=${encodeURIComponent(`/checkout?application=${applicationId || ""}`)}`,
      );
      return;
    }
    if (!applicationId) {
      setApplicationLoading(false);
      return;
    }
    fetch("/api/course-applications", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        const found = data.applications?.find(
          (item: Application) => item.id === applicationId,
        );
        if (!found) throw new Error("درخواست ثبت‌نام پیدا نشد");
        setApplication(found);
      })
      .catch((error) => toast.error(error.message || "خطا در دریافت درخواست"))
      .finally(() => setApplicationLoading(false));
  }, [applicationId, router]);

  async function createOrder() {
    const token = getCookie("token");
    if (!token) {
      router.push(
        `/login?redirect=${encodeURIComponent(`/checkout?application=${applicationId || ""}`)}`,
      );
      return;
    }
    if (!application || !["pending", "pending_payment"].includes(application.status)) {
      toast.error("این درخواست قابل پرداخت نیست");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ applicationId: application.id, method }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.complete) {
        setComplete(true);
        toast.success("ثبت‌نام شما با موفقیت انجام شد");
        return;
      }
      setOrder(data.order);
      setInstructions(data.paymentInstructions || null);
      setBotUrl(data.baleBotUrl || "");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ایجاد سفارش ناموفق بود",
      );
    } finally {
      setLoading(false);
    }
  }

  async function uploadReceipt() {
    const token = getCookie("token");
    if (!token || !order || !file) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`/api/payments/${order.id}/receipt`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setOrder({ ...order, status: "under_review" });
      toast.success("رسید ارسال شد و به‌زودی بررسی می‌شود.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ارسال رسید ناموفق بود",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-surface px-5 pb-20 pt-32">
      <div className="mx-auto max-w-2xl">
        <div className="mb-7 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-fixed text-primary">
            <WalletCards size={27} />
          </span>
          <h1 className="text-3xl font-black text-primary">پرداخت امن دوره</h1>
          <p className="mt-2 text-sm text-outline">
            روش پرداخت را انتخاب کنید؛ ثبت‌نام فقط پس از تأیید پرداخت انجام
            می‌شود.
          </p>
        </div>
        {applicationLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : complete ? (
          <section className="rounded-[2rem] border border-green-200 bg-white p-7 text-center shadow-sm">
            <h2 className="text-xl font-black text-primary">
              ثبت‌نام تکمیل شد
            </h2>
            <p className="mt-3 text-sm text-outline">
              مبلغ این درخواست پس از اعمال شرایط گروه شما صفر شده است.
            </p>
            <button
              onClick={() =>
                router.push(`/courses/${application?.course.slug || ""}`)
              }
              className="mt-6 rounded-xl bg-primary px-6 py-3 font-bold text-white"
            >
              ورود به دوره
            </button>
          </section>
        ) : !application ? (
          <section className="rounded-[2rem] border border-error/30 bg-white p-7 text-center text-outline">
            درخواست پرداخت معتبری انتخاب نشده است.
          </section>
        ) : !order ? (
          <section className="overflow-hidden rounded-[2rem] border border-outline-variant/40 bg-white shadow-sm">
            <div className="border-b border-outline-variant/20 bg-primary p-6 text-white">
              <p className="text-sm font-bold text-secondary-fixed">
                آکادمی هنر و رسانه امام روح‌الله
              </p>
              <h2 className="mt-2 text-xl font-black">یک قدم تا ثبت‌نام</h2>
            </div>
            <div className="space-y-4 p-5 md:p-7">
              <div className="rounded-2xl bg-surface-low p-4 text-sm text-primary">
                <p className="font-bold">{application.course.title}</p>
                <p className="mt-2 text-outline">
                  مبلغ بر اساس شرایط گروه انتخابی شما محاسبه شده است.
                </p>
                <p className="mt-2 font-black">
                  {application.finalAmountTomans.toLocaleString("fa-IR")} تومان
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMethod("bale_wallet")}
                className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-right transition ${method === "bale_wallet" ? "border-secondary bg-[#fff9ed] shadow-sm" : "border-outline-variant/50 hover:border-secondary/60"}`}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary">
                  <img src="/bale-logo.svg?v=2" className="h-7 w-7" alt="بله" />
                </span>
                <span>
                  <strong className="block text-primary">
                    پرداخت فوری با کیف پول بله
                  </strong>
                  <small className="mt-1 block text-outline">
                    بدون کارت و رمز دوم، تأیید و ثبت‌نام آنی
                  </small>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMethod("card_to_card")}
                className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-right transition ${method === "card_to_card" ? "border-secondary bg-[#fff9ed] shadow-sm" : "border-outline-variant/50 hover:border-secondary/60"}`}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-low text-primary">
                  <CreditCard size={25} />
                </span>
                <span>
                  <strong className="block text-primary">
                    کارت به کارت و ارسال رسید
                  </strong>
                  <small className="mt-1 block text-outline">
                    رسید شما در ربات و پنل مدیریت بررسی می‌شود
                  </small>
                </span>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={createOrder}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-bold text-white transition hover:bg-primary-container disabled:opacity-60"
              >
                {loading && <Loader2 className="animate-spin" size={18} />}ادامه
                پرداخت
              </button>
            </div>
          </section>
        ) : order.method === "bale_wallet" ? (
          <section className="rounded-[2rem] border border-secondary-fixed bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
              <img src="/bale-logo.svg?v=2" className="h-9 w-9" alt="بله" />
            </div>
            <h2 className="text-xl font-black text-primary">
              پرداخت در پیام‌رسان بله
            </h2>
            <p className="mt-3 text-sm leading-7 text-outline">
              برای دریافت فاکتور امن، ربات را باز کنید. پس از پرداخت موفق،
              ثبت‌نام شما خودکار انجام می‌شود.
            </p>
            <a
              href={botUrl}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#f7c64b] py-3.5 font-black text-primary transition hover:brightness-105"
            >
              <MessageCircle size={19} />
              باز کردن بله و پرداخت
            </a>
            <p className="mt-4 text-xs text-outline">
              شماره سفارش: <span dir="ltr">{order.orderNumber}</span>
            </p>
          </section>
        ) : (
          <section className="rounded-[2rem] border border-outline-variant/40 bg-white p-5 shadow-sm md:p-7">
            <div className="flex items-center gap-3 border-b border-outline-variant/20 pb-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary-fixed text-primary">
                <CreditCard size={22} />
              </span>
              <div>
                <h2 className="font-black text-primary">واریز کارت به کارت</h2>
                <p className="text-xs text-outline">
                  پس از واریز، تصویر رسید را همین‌جا ارسال کنید.
                </p>
              </div>
            </div>
            <div className="my-5 rounded-2xl bg-surface-low p-4 text-sm leading-8 text-primary">
              <p>
                شماره کارت:{" "}
                <b dir="ltr">
                  {instructions?.cardNumber || "در حال حاضر تنظیم نشده"}
                </b>
              </p>
              {instructions?.cardHolder && (
                <p>
                  به نام: <b>{instructions.cardHolder}</b>
                </p>
              )}
              <p>
                مبلغ: <b>{order.amountTomans.toLocaleString("fa-IR")} تومان</b>
              </p>
              {instructions?.instructions && (
                <p className="mt-2 text-outline">{instructions.instructions}</p>
              )}
            </div>
            {order.status === "under_review" ? (
              <div className="rounded-xl bg-yellow-50 p-4 text-center text-sm font-bold text-yellow-800">
                رسید شما دریافت شد و در انتظار بررسی است.
              </div>
            ) : (
              <>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-secondary/60 bg-[#fffaf0] px-4 py-5 text-sm font-bold text-primary">
                  <Upload size={18} />
                  {file ? file.name : "انتخاب تصویر رسید (حداکثر ۵ مگابایت)"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) =>
                      setFile(event.target.files?.[0] || null)
                    }
                  />
                </label>
                <button
                  type="button"
                  disabled={!file || loading || !instructions?.cardNumber}
                  onClick={uploadReceipt}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-bold text-white disabled:opacity-50"
                >
                  {loading && <Loader2 className="animate-spin" size={18} />}
                  ارسال رسید برای بررسی
                </button>
              </>
            )}
            <p className="mt-4 flex items-center justify-center gap-1 text-xs text-outline">
              <ShieldCheck size={14} />
              شماره سفارش: <span dir="ltr">{order.orderNumber}</span>
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
