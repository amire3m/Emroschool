"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, Loader2, ChevronLeft, Phone, KeyRound } from "lucide-react";
import { setCookie } from "@/lib/cookie";
import GoogleAuthButton from "@/components/auth/google-auth-button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [baleMode, setBaleMode] = useState<"login" | "reset" | null>(null);
  const [balePhone, setBalePhone] = useState("");
  const [baleCode, setBaleCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [recoveryMethod, setRecoveryMethod] = useState<"email" | "bale" | "sms" | "call">("bale");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.verificationRequired && data.email) { router.push(`/register?verify=${encodeURIComponent(data.email)}`); return; }
        setError(data.error || "خطا در ورود");
        return;
      }

      setCookie("token", data.token);
      window.dispatchEvent(new Event("auth-changed"));
      const redirect = new URLSearchParams(window.location.search).get("redirect");
      if (redirect?.startsWith("/") && !redirect.startsWith("//")) {
        router.push(redirect);
        return;
      }
      if (data.user?.role === "admin" || data.user?.role === "superadmin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("خطا در برقراری ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  }

  async function sendBaleCode() {
    if (!baleMode) return;
    setError(""); setLoading(true);
    try { const endpoint = baleMode === "reset" ? "/api/auth/recovery/send" : "/api/auth/bale/send"; const body = baleMode === "reset" ? { value: balePhone, method: recoveryMethod } : { phone: balePhone, purpose: baleMode }; const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); setCodeSent(true); } catch (error) { setError(error instanceof Error ? error.message : "ارسال کد ناموفق بود"); } finally { setLoading(false); }
  }

  async function verifyBaleCode(event: FormEvent) {
    event.preventDefault(); if (!baleMode) return;
    setError(""); setLoading(true);
    try { const endpoint = baleMode === "reset" ? "/api/auth/recovery/verify" : "/api/auth/bale/verify"; const body = baleMode === "reset" ? { value: balePhone, method: recoveryMethod, code: baleCode, password: newPassword } : { phone: balePhone, code: baleCode, purpose: baleMode, password: newPassword }; const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); setCookie("token", data.token); window.dispatchEvent(new Event("auth-changed")); router.push(baleMode === "reset" ? "/dashboard/profile" : "/dashboard"); } catch (error) { setError(error instanceof Error ? error.message : "تأیید کد ناموفق بود"); } finally { setLoading(false); }
  }

  return (
    <div className="min-h-[calc(100vh-96px)] pt-24 flex">
      {/* Left Panel - Branding */}
      <div className="hidden md:flex md:w-1/2 relative overflow-hidden bg-gradient-to-b from-[#03004b] to-[#1a1b5e] flex-col items-center justify-center px-12 py-16 select-none">
        {/* Decorative geometric patterns */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ opacity: 0.05 }}
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M 80 0 L 0 0 0 80" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
            <pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="1.5" fill="white" />
            </pattern>
          </defs>
          <rect width="1000" height="1000" fill="url(#grid)" />
          <rect y="200" width="1000" height="600" fill="url(#dots)" />
          <polygon points="50,950 150,800 250,950" fill="white" opacity="0.3" />
          <polygon points="800,50 900,50 850,150" fill="white" opacity="0.2" />
          <circle cx="850" cy="200" r="120" fill="none" stroke="white" strokeWidth="0.5" opacity="0.3" />
          <circle cx="150" cy="800" r="80" fill="none" stroke="white" strokeWidth="0.5" opacity="0.2" />
        </svg>

        {/* Decorative corner accents */}
        <div className="absolute top-12 right-12 w-24 h-24 border-t-2 border-l-2 border-secondary-fixed/20 rounded-tr-full" />
        <div className="absolute bottom-12 left-12 w-32 h-32 border-b-2 border-r-2 border-secondary-fixed/20 rounded-br-full" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-secondary-fixed flex items-center justify-center mb-6 shadow-lg shadow-black/20">
            <span className="text-primary font-playfair font-bold text-3xl">ه</span>
          </div>

          <h2 className="font-playfair text-3xl font-bold text-white mb-1">
            مدرسه هنر و رسانه
          </h2>
          <p className="font-playfair text-secondary-fixed text-xl font-semibold tracking-wider">
            امام روح‌الله
          </p>

          <div className="w-16 h-0.5 bg-secondary-fixed rounded-full my-6" />

          <p className="text-white/60 text-sm leading-relaxed max-w-xs">
            آموزش هنر و رسانه در تراز انقلاب اسلامی، پرورش استعدادهای متعهد و متخصص برای ساختن آینده‌ای روشن
          </p>
        </div>

        {/* Bottom tagline */}
        <div className="absolute bottom-12 z-10 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-secondary-fixed" />
          <span className="text-white/50 text-sm font-medium tracking-widest">
            هنر متعالی، رسانه انقلابی
          </span>
          <span className="w-2 h-2 rounded-full bg-secondary-fixed" />
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center px-6 py-16 md:py-0 bg-surface">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="md:hidden w-14 h-14 rounded-full bg-primary flex items-center justify-center mx-auto mb-4">
              <span className="text-secondary-fixed font-playfair font-bold text-xl">ه</span>
            </div>
            <h1 className="text-2xl font-bold text-primary">خوش آمدید</h1>
            <p className="text-outline text-sm mt-2">برای ادامه وارد حساب خود شوید</p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-error-container/80 text-error px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-2 border border-error/10">
              <span className="w-1.5 h-1.5 rounded-full bg-error shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          {baleMode ? <form onSubmit={verifyBaleCode} className="space-y-5"><div className="text-center"><div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-fixed text-secondary"><KeyRound size={26} /></div><h2 className="text-xl font-black text-primary">{baleMode === "login" ? "ورود از طریق پیام‌رسان بله" : "بازنشانی رمز"}</h2><p className="mt-2 text-sm text-outline">روش دریافت رمز یک‌بارمصرف را انتخاب کنید.</p></div>{baleMode === "reset" && <div className="grid grid-cols-2 gap-2">{([['email','ایمیل'],['bale','بله'],['sms','پیامک'],['call','تماس']] as const).map(([method,label]) => <button key={method} type="button" onClick={() => { setRecoveryMethod(method); setCodeSent(false); }} className={`rounded-lg border px-2 py-2 text-xs font-bold ${recoveryMethod === method ? "border-secondary bg-secondary-fixed/30 text-secondary" : "border-outline-variant text-outline"}`}>{label}</button>)}</div>}<div><label className="mb-2 block text-sm font-bold text-primary">{baleMode === "reset" && recoveryMethod === "email" ? "ایمیل حساب" : "شماره موبایل"}</label><div className="relative"><Phone size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-outline" /><input value={balePhone} onChange={(event) => setBalePhone(event.target.value)} inputMode={baleMode === "reset" && recoveryMethod === "email" ? "email" : "numeric"} dir="ltr" placeholder={baleMode === "reset" && recoveryMethod === "email" ? "example@email.com" : "09123456789"} className="w-full rounded-xl border border-outline-variant bg-white py-3.5 pl-4 pr-12 text-sm outline-none focus:ring-2 focus:ring-secondary" /></div></div>{codeSent && <><div><label className="mb-2 block text-sm font-bold text-primary">رمز یک‌بارمصرف</label><input value={baleCode} onChange={(event) => setBaleCode(event.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={6} dir="ltr" className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3.5 text-center text-xl font-black tracking-[.5em] outline-none focus:ring-2 focus:ring-secondary" /></div>{baleMode === "reset" && <div><label className="mb-2 block text-sm font-bold text-primary">رمز جدید</label><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={6} className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-secondary" /></div>}<button disabled={loading || baleCode.length !== 6 || (baleMode === "reset" && newPassword.length < 6)} className="w-full rounded-xl bg-primary py-3.5 font-bold text-white disabled:opacity-60">تأیید و ادامه</button></>}<button type="button" disabled={loading} onClick={sendBaleCode} className="w-full rounded-xl border border-secondary py-3 font-bold text-secondary disabled:opacity-60">{codeSent ? "ارسال مجدد کد" : "ارسال کد"}</button><button type="button" onClick={() => { setBaleMode(null); setCodeSent(false); setBaleCode(""); setError(""); }} className="w-full text-sm text-outline">بازگشت به ورود با رمز</button></form> : <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-primary mb-2">
                ایمیل
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-outline pointer-events-none"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  dir="ltr"
                  className="w-full bg-white border border-outline-variant rounded-xl pr-12 pl-4 py-3.5 text-sm focus:ring-2 focus:ring-secondary focus:border-secondary focus:outline-none transition-all placeholder:text-outline/50"
                  placeholder="example@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-primary mb-2">
                رمز عبور
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-outline pointer-events-none"
                />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-white border border-outline-variant rounded-xl pr-12 pl-12 py-3.5 text-sm focus:ring-2 focus:ring-secondary focus:border-secondary focus:outline-none transition-all placeholder:text-outline/50"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors p-1"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-5 h-5 border-2 border-outline-variant rounded-md transition-all peer-checked:bg-primary peer-checked:border-primary group-hover:border-secondary" />
                  <svg
                    className="absolute top-0.5 right-0.5 w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm text-outline group-hover:text-primary transition-colors">
                  مرا به خاطر بسپار
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-l from-primary to-primary-container text-white py-3.5 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/25 transition-all active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2.5"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  در حال ورود...
                </>
              ) : (
                "ورود"
              )}
            </button>
          </form>}

          {!baleMode && <div className="mt-4 grid grid-cols-1 gap-3"><button type="button" onClick={() => setBaleMode("login")} className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-xl bg-gradient-to-l from-[#f7c64b] via-[#ffdeab] to-[#f7c64b] px-4 py-3.5 text-sm font-black text-primary shadow-lg shadow-secondary/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-secondary/30 active:translate-y-0"><span className="absolute inset-y-0 left-0 w-16 -translate-x-20 skew-x-[-20deg] bg-white/50 transition-transform duration-700 group-hover:translate-x-[380px]" /><span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary"><img src="/bale-logo.svg?v=2" alt="" className="h-5 w-5" /></span><span className="relative">ورود از طریق پیام‌رسان بله</span></button><button type="button" onClick={() => setBaleMode("reset")} className="rounded-xl border border-outline-variant px-3 py-2.5 text-xs font-bold text-outline transition hover:border-secondary hover:text-secondary">فراموشی رمز</button></div>}

          {/* Divider */}
           <div className="flex items-center gap-3 my-7">
            <div className="flex-1 h-px bg-outline-variant/60" />
            <span className="text-outline text-sm">یا</span>
            <div className="flex-1 h-px bg-outline-variant/60" />
           </div>
           <GoogleAuthButton label="ادامه با گوگل" />

           {/* Register link */}
           <div className="text-center mt-6">
            <p className="text-outline text-sm">
              حساب کاربری ندارید؟{" "}
              <Link
                href="/register"
                className="text-secondary font-bold hover:text-secondary/80 transition-colors"
              >
                ثبت‌نام کنید
              </Link>
            </p>
          </div>

          {/* Back to home */}
          <div className="mt-6 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-outline hover:text-primary transition-colors"
            >
              <ChevronLeft size={16} />
              بازگشت به صفحه اصلی
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
