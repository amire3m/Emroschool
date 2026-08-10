"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CreditCard,
  CircleCheck,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Upload,
  WalletCards,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import { getIranianCardInfo } from "@/lib/iranian-card";
import {
  canApplyCheckoutMutation,
  formatPersianCountdown,
  getRemainingSeconds,
  getStatusRequestDelay,
  isPendingBalePayment,
  newCheckoutApplicationState,
  observePaymentStatus,
  shouldTerminateCheckoutRequest,
  type PaymentObservation,
} from "@/lib/checkout-payment-state";

type Order = {
  id: string;
  orderNumber: string;
  amountTomans: number;
  method: string;
  status: string;
  rejectionReason?: string | null;
  balePayload?: string | null;
  receiptUrl?: string | null;
  expiresAt?: string | null;
};
type Application = {
  id: string;
  status: string;
  finalAmountTomans: number;
  course: { title: string; slug: string };
};

type PaymentInstructions = {
  cardNumber?: string | null;
  cardHolder?: string | null;
  instructions?: string | null;
};

function checkoutLoginUrl(applicationId: string | null) {
  return `/login?redirect=${encodeURIComponent(`/checkout?application=${applicationId || ""}`)}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const applicationId = useSearchParams().get("application");
  const [method, setMethod] = useState<"bale_wallet" | "card_to_card">(
    "bale_wallet",
  );
  const [order, setOrder] = useState<Order | null>(null);
  const [instructions, setInstructions] = useState<PaymentInstructions | null>(null);
  const [botUrl, setBotUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [payerCardNumber, setPayerCardNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [application, setApplication] = useState<Application | null>(null);
  const [applicationLoading, setApplicationLoading] = useState(true);
  const [completionKind, setCompletionKind] = useState<"free" | "paid" | null>(null);
  const [expiredOrderId, setExpiredOrderId] = useState<string | null>(null);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authTerminated, setAuthTerminated] = useState(false);
  const lastStatusRequestAt = useRef<number | null>(null);
  const watcherAbort = useRef<AbortController | null>(null);
  const mutationAbort = useRef<AbortController | null>(null);
  const currentApplicationId = useRef(applicationId);
  currentApplicationId.current = applicationId;

  function terminateAuthentication() {
    watcherAbort.current?.abort();
    mutationAbort.current?.abort();
    setAuthTerminated(true);
    setLoading(false);
    router.push(checkoutLoginUrl(applicationId));
  }

  function applyCurrentOrder(
    nextOrder: Order,
    data: {
      baleBotUrl?: string;
      paymentInstructions?: PaymentInstructions;
    } = {},
  ) {
    if (nextOrder.status === "paid") {
      setOrder(nextOrder);
      setCompletionKind("paid");
      setExpiredOrderId(null);
      setBotUrl("");
      return;
    }

    setCompletionKind(null);
    if (nextOrder.status === "expired") {
      setExpiredOrderId(nextOrder.id);
      setOrder(null);
      setMethod("bale_wallet");
      setBotUrl("");
      setInstructions(null);
      return;
    }

    setOrder(nextOrder);
    setExpiredOrderId(null);
    setMethod(nextOrder.method === "card_to_card" ? "card_to_card" : "bale_wallet");
    setBotUrl(nextOrder.method === "bale_wallet" ? data.baleBotUrl || "" : "");
    setInstructions(
      nextOrder.method === "card_to_card"
        ? data.paymentInstructions || null
        : null,
    );
  }

  function ownCheckoutMutation() {
    mutationAbort.current?.abort();
    const controller = new AbortController();
    mutationAbort.current = controller;
    return controller;
  }

  function mutationCanUpdate(
    requestApplicationId: string | null,
    controller: AbortController,
  ) {
    return canApplyCheckoutMutation(
      requestApplicationId,
      currentApplicationId.current,
      controller.signal.aborted,
    );
  }

  function finishCheckoutMutation(
    requestApplicationId: string | null,
    controller: AbortController,
  ) {
    if (mutationAbort.current !== controller) return;
    mutationAbort.current = null;
    if (mutationCanUpdate(requestApplicationId, controller)) setLoading(false);
  }

  async function waitForStatusRequestSlot() {
    const delay = getStatusRequestDelay(lastStatusRequestAt.current, Date.now());
    if (delay > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, delay));
    }
    lastStatusRequestAt.current = Date.now();
  }

  async function fetchCurrentPayment(
    token: string,
    requestApplicationId: string,
    controller: AbortController,
  ) {
    await waitForStatusRequestSlot();
    if (!mutationCanUpdate(requestApplicationId, controller)) return null;
    const response = await fetch(
      `/api/payments?applicationId=${encodeURIComponent(requestApplicationId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      },
    );
    const data = await response.json();
    if (!mutationCanUpdate(requestApplicationId, controller)) return null;
    if (shouldTerminateCheckoutRequest(response.status)) {
      terminateAuthentication();
      return null;
    }
    if (!response.ok) throw new Error(data.error);
    return data as {
      orders?: Order[];
      baleBotUrl?: string;
      paymentInstructions?: PaymentInstructions;
    };
  }

  useEffect(() => {
    const reset = newCheckoutApplicationState();
    watcherAbort.current?.abort();
    mutationAbort.current?.abort();
    mutationAbort.current = null;
    setApplication(reset.application);
    setOrder(reset.order);
    setCompletionKind(reset.completionKind);
    setExpiredOrderId(reset.expiredOrderId);
    setBotUrl(reset.botUrl);
    setInstructions(reset.instructions);
    setLoadError(reset.error);
    setLoading(reset.loading);
    setApplicationLoading(reset.applicationLoading);
    setAuthTerminated(reset.authTerminated);
    setMethod("bale_wallet");
    setFile(null);
    setPayerCardNumber("");
    setCountdownNow(Date.now());

    const controller = new AbortController();
    let disposed = false;
    const token = getCookie("token");
    if (!token) {
      setAuthTerminated(true);
      setApplicationLoading(false);
      router.push(checkoutLoginUrl(applicationId));
      return () => controller.abort();
    }
    if (!applicationId) {
      setApplicationLoading(false);
      return () => controller.abort();
    }

    void (async () => {
      try {
        const response = await fetch("/api/course-applications", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = await response.json();
        if (disposed) return;
        if (shouldTerminateCheckoutRequest(response.status)) {
          setAuthTerminated(true);
          router.push(checkoutLoginUrl(applicationId));
          return;
        }
        if (!response.ok) throw new Error(data.error);
        const found = data.applications?.find(
          (item: Application) => item.id === applicationId,
        );
        if (!found) throw new Error("درخواست ثبت‌نام پیدا نشد");

        await waitForStatusRequestSlot();
        if (disposed) return;
        const orderResponse = await fetch(
          `/api/payments?applicationId=${encodeURIComponent(applicationId)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );
        const orderData = await orderResponse.json();
        if (disposed) return;
        if (shouldTerminateCheckoutRequest(orderResponse.status)) {
          setAuthTerminated(true);
          router.push(checkoutLoginUrl(applicationId));
          return;
        }
        if (!orderResponse.ok) throw new Error(orderData.error);

        setApplication(found);
        const existingOrder = orderData.orders?.[0] as Order | undefined;
        if (existingOrder) applyCurrentOrder(existingOrder, orderData);
      } catch (error) {
        if (disposed || controller.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : "خطا در دریافت درخواست";
        setLoadError(message);
        toast.error(message);
      } finally {
        if (!disposed) setApplicationLoading(false);
      }
    })();

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [applicationId, router]);

  useEffect(() => {
    const pendingBale = isPendingBalePayment(order);
    const watchedOrderId = pendingBale ? order.id : expiredOrderId;
    if (
      loading ||
      authTerminated ||
      !applicationId ||
      !watchedOrderId
    ) {
      return;
    }

    const token = getCookie("token");
    if (!token) {
      terminateAuthentication();
      return;
    }

    const controller = new AbortController();
    watcherAbort.current = controller;
    let disposed = false;
    let inFlight = false;
    let expiryErrorShown = false;
    let statusTimer: number | undefined;
    let countdownTimer: number | undefined;
    let observation: PaymentObservation = {
      outcome: pendingBale ? "pending" : "expired",
      keepWatching: true,
    };

    const stopForAuthentication = () => {
      disposed = true;
      if (statusTimer !== undefined) window.clearTimeout(statusTimer);
      if (countdownTimer !== undefined) window.clearTimeout(countdownTimer);
      controller.abort();
      setAuthTerminated(true);
      setLoading(false);
      router.push(checkoutLoginUrl(applicationId));
    };

    const acceptOrder = (
      nextOrder: Order,
      data: {
        baleBotUrl?: string;
        paymentInstructions?: PaymentInstructions;
      } = {},
    ) => {
      if (disposed || nextOrder.id !== watchedOrderId) return;
      observation = observePaymentStatus(observation, nextOrder.status);

      if (observation.outcome === "paid") {
        setOrder(nextOrder);
        setCompletionKind("paid");
        setExpiredOrderId(null);
        setBotUrl("");
        return;
      }

      if (observation.outcome === "expired") {
        setExpiredOrderId(nextOrder.id);
        setOrder(null);
        setMethod("bale_wallet");
        setBotUrl("");
        setInstructions(null);
        return;
      }

      setOrder(nextOrder);
      setExpiredOrderId(null);
      setMethod(nextOrder.method === "card_to_card" ? "card_to_card" : "bale_wallet");
      setBotUrl(nextOrder.method === "bale_wallet" ? data.baleBotUrl || "" : "");
      setInstructions(
        nextOrder.method === "card_to_card"
          ? data.paymentInstructions || null
          : null,
      );
    };

    const scheduleStatus = () => {
      if (disposed || !observation.keepWatching) return;
      if (statusTimer !== undefined) window.clearTimeout(statusTimer);
      const delay = getStatusRequestDelay(lastStatusRequestAt.current, Date.now());
      statusTimer = window.setTimeout(() => void requestStatus(), delay);
    };

    const requestStatus = async () => {
      if (disposed || inFlight || !observation.keepWatching) return;
      const delay = getStatusRequestDelay(lastStatusRequestAt.current, Date.now());
      if (delay > 0) {
        scheduleStatus();
        return;
      }

      inFlight = true;
      lastStatusRequestAt.current = Date.now();
      try {
        const atDeadline =
          pendingBale &&
          getRemainingSeconds(order?.expiresAt, Date.now()) === 0;
        const response = atDeadline
          ? await fetch(`/api/payments/${watchedOrderId}/expire`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal,
            })
          : await fetch(
              `/api/payments?applicationId=${encodeURIComponent(applicationId)}`,
              {
                headers: { Authorization: `Bearer ${token}` },
                signal: controller.signal,
              },
            );
        const data = await response.json();
        if (shouldTerminateCheckoutRequest(response.status)) {
          stopForAuthentication();
          return;
        }
        if (!response.ok) throw new Error(data.error);
        if (atDeadline) {
          acceptOrder(data.order as Order);
        } else {
          const refreshedOrder = (data.orders as Order[] | undefined)?.find(
            (item) => item.id === watchedOrderId,
          );
          if (refreshedOrder) acceptOrder(refreshedOrder, data);
        }
      } catch (error) {
        if (disposed || controller.signal.aborted) return;
        if (pendingBale && !expiryErrorShown) {
          expiryErrorShown = true;
          toast.error(
            error instanceof Error
              ? error.message
              : "بررسی انقضای پرداخت انجام نشد؛ دوباره تلاش می‌کنیم.",
          );
        }
      } finally {
        inFlight = false;
        scheduleStatus();
      }
    };

    const updateCountdown = () => {
      if (countdownTimer !== undefined) window.clearTimeout(countdownTimer);
      if (!pendingBale) return;
      const now = Date.now();
      setCountdownNow(now);
      if (getRemainingSeconds(order?.expiresAt, now) === 0) {
        scheduleStatus();
      }
      countdownTimer = window.setTimeout(updateCountdown, 1_000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      updateCountdown();
      if (getStatusRequestDelay(lastStatusRequestAt.current, Date.now()) === 0) {
        scheduleStatus();
      }
    };

    updateCountdown();
    scheduleStatus();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      controller.abort();
      if (watcherAbort.current === controller) watcherAbort.current = null;
      if (countdownTimer !== undefined) window.clearTimeout(countdownTimer);
      if (statusTimer !== undefined) window.clearTimeout(statusTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [applicationId, authTerminated, expiredOrderId, loading, order?.expiresAt, order?.id, order?.method, order?.status, router]);

  async function createOrder() {
    const requestApplicationId = applicationId;
    const token = getCookie("token");
    if (!token) {
      router.push(checkoutLoginUrl(requestApplicationId));
      return;
    }
    if (
      !requestApplicationId ||
      !application ||
      application.id !== requestApplicationId ||
      !["pending", "pending_payment"].includes(application.status)
    ) {
      toast.error("این درخواست قابل پرداخت نیست");
      return;
    }
    const controller = ownCheckoutMutation();
    setLoading(true);
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ applicationId: application.id, method, payerCardNumber: method === "card_to_card" ? payerCardNumber : undefined }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!mutationCanUpdate(requestApplicationId, controller)) return;
      if (shouldTerminateCheckoutRequest(response.status)) {
        terminateAuthentication();
        return;
      }
      if (!response.ok) throw new Error(data.error);
      if (data.complete) {
        setCompletionKind("free");
        toast.success("ثبت‌نام شما با موفقیت انجام شد");
        return;
      }
      setOrder(data.order);
      setExpiredOrderId(null);
      setCountdownNow(Date.now());
      setInstructions(data.paymentInstructions || null);
      setBotUrl(data.baleBotUrl || "");
    } catch (error) {
      if (!mutationCanUpdate(requestApplicationId, controller)) return;
      toast.error(
        error instanceof Error ? error.message : "ایجاد سفارش ناموفق بود",
      );
    } finally {
      finishCheckoutMutation(requestApplicationId, controller);
    }
  }

  async function restartExpiredOrder() {
    const requestApplicationId = applicationId;
    const requestOrderId = expiredOrderId;
    if (!requestApplicationId || !requestOrderId) return;
    const token = getCookie("token");
    if (!token) {
      terminateAuthentication();
      return;
    }
    watcherAbort.current?.abort();
    const controller = ownCheckoutMutation();
    setLoading(true);
    try {
      const currentData = await fetchCurrentPayment(
        token,
        requestApplicationId,
        controller,
      );
      if (!currentData) return;
      const currentOrder = currentData.orders?.find(
        (item) => item.id === requestOrderId,
      );
      if (!mutationCanUpdate(requestApplicationId, controller)) return;
      if (!currentOrder) throw new Error("سفارش پیدا نشد");
      if (currentOrder.status !== "expired") {
        applyCurrentOrder(currentOrder, currentData);
        if (currentOrder.status === "paid") {
          toast.success("پرداخت شما تأیید شد");
        }
        return;
      }

      const response = await fetch(`/api/payments/${requestOrderId}/change-method`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          method,
          payerCardNumber: method === "card_to_card" ? payerCardNumber : undefined,
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!mutationCanUpdate(requestApplicationId, controller)) return;
      if (shouldTerminateCheckoutRequest(response.status)) {
        terminateAuthentication();
        return;
      }
      if (!response.ok) {
        if (response.status === 409) {
          const refreshedData = await fetchCurrentPayment(
            token,
            requestApplicationId,
            controller,
          );
          const refreshedOrder = refreshedData?.orders?.find(
            (item) => item.id === requestOrderId,
          );
          if (!mutationCanUpdate(requestApplicationId, controller)) return;
          if (refreshedOrder && refreshedOrder.status !== "expired") {
            applyCurrentOrder(refreshedOrder, refreshedData || {});
            if (refreshedOrder.status === "paid") {
              toast.success("پرداخت شما تأیید شد");
            }
            return;
          }
        }
        throw new Error(data.error);
      }
      applyCurrentOrder(data.order, data);
      setFile(null);
      setCountdownNow(Date.now());
    } catch (error) {
      if (!mutationCanUpdate(requestApplicationId, controller)) return;
      toast.error(
        error instanceof Error ? error.message : "شروع دوباره پرداخت انجام نشد",
      );
    } finally {
      finishCheckoutMutation(requestApplicationId, controller);
    }
  }

  async function changeMethod() {
    const requestApplicationId = applicationId;
    const requestOrder = order;
    if (!requestApplicationId || !requestOrder) return;
    const nextMethod = order.method === "card_to_card" ? "bale_wallet" : "card_to_card";
    if (!window.confirm("روش پرداخت فعلی غیرفعال می‌شود و باید پرداخت را با روش جدید ادامه دهید. ادامه می‌دهید؟")) return;
    const nextPayerCardNumber = nextMethod === "card_to_card" ? window.prompt("شماره کارت پرداخت‌کننده را وارد کنید:")?.trim() : undefined;
    if (nextMethod === "card_to_card" && !nextPayerCardNumber) return;
    const token = getCookie("token");
    if (!token) {
      terminateAuthentication();
      return;
    }
    const controller = ownCheckoutMutation();
    setLoading(true);
    try {
      const response = await fetch(`/api/payments/${requestOrder.id}/change-method`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ method: nextMethod, payerCardNumber: nextPayerCardNumber }), signal: controller.signal });
      const data = await response.json();
      if (!mutationCanUpdate(requestApplicationId, controller)) return;
      if (shouldTerminateCheckoutRequest(response.status)) {
        terminateAuthentication();
        return;
      }
      if (!response.ok) throw new Error(data.error);
      applyCurrentOrder(data.order, data); setFile(null);
      toast.success("روش پرداخت تغییر کرد");
    } catch (error) {
      if (!mutationCanUpdate(requestApplicationId, controller)) return;
      toast.error(error instanceof Error ? error.message : "تغییر روش پرداخت انجام نشد");
    } finally {
      finishCheckoutMutation(requestApplicationId, controller);
    }
  }

  async function uploadReceipt() {
    const requestApplicationId = applicationId;
    const requestOrder = order;
    const requestFile = file;
    const token = getCookie("token");
    if (!requestApplicationId || !requestOrder || !requestFile) return;
    if (!token) {
      terminateAuthentication();
      return;
    }
    const controller = ownCheckoutMutation();
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", requestFile);
      const response = await fetch(`/api/payments/${requestOrder.id}/receipt`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        signal: controller.signal,
      });
      const data = await response.json();
      if (!mutationCanUpdate(requestApplicationId, controller)) return;
      if (shouldTerminateCheckoutRequest(response.status)) {
        terminateAuthentication();
        return;
      }
      if (!response.ok) throw new Error(data.error);
      setOrder({ ...requestOrder, status: "under_review" });
      toast.success("رسید ارسال شد و به‌زودی بررسی می‌شود.");
    } catch (error) {
      if (!mutationCanUpdate(requestApplicationId, controller)) return;
      toast.error(
        error instanceof Error ? error.message : "ارسال رسید ناموفق بود",
      );
    } finally {
      finishCheckoutMutation(requestApplicationId, controller);
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
        ) : completionKind ? (
          <section role="status" aria-live="polite" className="rounded-[2rem] border border-green-200 bg-white p-7 text-center shadow-sm">
            <CircleCheck className="mx-auto mb-4 text-green-600" size={48} />
            <h2 className="text-xl font-black text-primary">
              {completionKind === "free"
                ? "ثبت‌نام تکمیل شد"
                : "پرداخت موفق و ثبت‌نام تکمیل شد"}
            </h2>
            <p className="mt-3 text-sm text-outline">
              {completionKind === "free"
                ? "مبلغ این درخواست پس از اعمال شرایط گروه شما صفر شده است."
                : "پرداخت شما تأیید شد و دسترسی دوره برایتان فعال است."}
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
            {loadError || "درخواست پرداخت معتبری انتخاب نشده است."}
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
              {expiredOrderId && (
                <div role="status" aria-live="polite" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
                  فرصت پرداخت قبلی تمام شد. روش دلخواه را انتخاب کنید تا یک
                  پرداخت تازه برای همین سفارش آغاز شود.
                </div>
              )}
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
              {method === "card_to_card" && <PayerCardInput value={payerCardNumber} onChange={setPayerCardNumber} />}
              <button
                type="button"
                disabled={loading || (method === "card_to_card" && !getIranianCardInfo(payerCardNumber))}
                onClick={expiredOrderId ? restartExpiredOrder : createOrder}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-bold text-white transition hover:bg-primary-container disabled:opacity-60"
              >
                {loading && <Loader2 className="animate-spin" size={18} />}
                {expiredOrderId ? "شروع دوباره پرداخت" : "ادامه پرداخت"}
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
            <div className="mt-5 rounded-2xl bg-surface-low px-4 py-3 text-sm text-outline">
              زمان باقی‌مانده برای پرداخت: {" "}
              <strong dir="ltr" className="text-lg font-black text-primary">
                {formatPersianCountdown(
                  getRemainingSeconds(order.expiresAt, countdownNow),
                )}
              </strong>
            </div>
            {getRemainingSeconds(order.expiresAt, countdownNow) > 0 && botUrl ? (
              <a
                href={botUrl}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#f7c64b] py-3.5 font-black text-primary transition hover:brightness-105"
              >
                <MessageCircle size={19} />
                باز کردن بله و پرداخت
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-outline-variant/40 py-3.5 font-black text-outline"
              >
                <MessageCircle size={19} />
                فرصت این پرداخت تمام شده است
              </button>
            )}
             <p className="mt-4 text-xs text-outline">
               شماره سفارش: <span dir="ltr">{order.orderNumber}</span>
             </p>
             <button type="button" onClick={changeMethod} disabled={loading} className="mt-4 w-full rounded-xl border border-primary px-4 py-2.5 text-sm font-bold text-primary disabled:opacity-50">تغییر روش پرداخت</button>
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
             {order.status === "rejected" && <div className="mt-4 rounded-xl bg-error-container p-4 text-sm leading-7 text-error">رسید قبلی رد شده است.{order.rejectionReason ? ` دلیل: ${order.rejectionReason}` : ""}</div>}
             {order.status !== "under_review" && order.status !== "paid" && <button type="button" onClick={changeMethod} disabled={loading} className="mt-4 w-full rounded-xl border border-primary px-4 py-2.5 text-sm font-bold text-primary disabled:opacity-50">تغییر روش پرداخت</button>}
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

function PayerCardInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const info = getIranianCardInfo(value);
  const digits = value.replace(/[^0-9۰-۹٠-٩]/g, "");
  return <div className="rounded-2xl border border-secondary/40 bg-[#fffaf0] p-4"><label className="block text-sm font-bold text-primary">کارت پرداخت‌کننده<input value={value} onChange={(event) => onChange(event.target.value)} inputMode="numeric" maxLength={19} dir="ltr" placeholder="6037 9977 1234 5678" className={`mt-2 w-full rounded-xl border bg-white px-4 py-3 text-center text-base tracking-[0.12em] outline-none ${info ? "border-green-500" : digits.length >= 16 ? "border-error" : "border-outline-variant"}`} /></label>{info ? <p className="mt-2 text-xs font-bold text-green-700">کارت معتبر است · {info.bankName}</p> : <p className="mt-2 text-xs text-outline">شماره کارت برای تشخیص بانک و بررسی رسید ثبت می‌شود.</p>}</div>;
}
