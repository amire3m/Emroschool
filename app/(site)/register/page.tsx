"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User, Eye, EyeOff, Loader2, ChevronLeft, KeyRound, Phone } from "lucide-react";
import { setCookie } from "@/lib/cookie";
import GoogleAuthButton from "@/components/auth/google-auth-button";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationChannel, setVerificationChannel] = useState("email");
  const [balePhone, setBalePhone] = useState("");
  useEffect(() => { const pendingEmail = new URLSearchParams(window.location.search).get("verify"); if (pendingEmail) { setVerificationEmail(pendingEmail); setVerificationChannel(""); } }, []);

  function validateForm(): string | null {
    if (!name.trim()) return "لطفاً نام و نام خانوادگی خود را وارد کنید";
    if (!email.trim()) return "لطفاً ایمیل خود را وارد کنید";
    if (!/^09\d{9}$/.test(phone.replace(/[^0-9]/g, ""))) return "شماره موبایل معتبر وارد کنید";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "فرمت ایمیل وارد شده صحیح نیست";
    if (!password) return "لطفاً رمز عبور را وارد کنید";
    if (password.length < 6) return "رمز عبور باید حداقل ۶ کاراکتر باشد";
    if (password !== confirmPassword) return "رمز عبور و تکرار آن مطابقت ندارند";
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "خطا در ثبت‌نام");
        return;
      }

        if (data.requiresVerification) { setVerificationEmail(data.email); setVerificationChannel(""); setBalePhone(""); }
       else {
         setCookie("token", data.token);
         window.dispatchEvent(new Event("auth-changed"));
         router.push("/dashboard");
       }
    } catch {
      setError("خطا در برقراری ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
     try { const res = await fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(verificationChannel === "bale" ? { email: verificationEmail, phone: balePhone || phone, code: verificationCode, channel: "bale" } : { email: verificationEmail, code: verificationCode }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); setCookie("token", data.token); window.dispatchEvent(new Event("auth-changed")); router.push("/dashboard"); } catch (error) { setError(error instanceof Error ? error.message : "خطا در تأیید کد"); } finally { setLoading(false); }
  }

   async function resendCode(channel = verificationChannel) {
    setError(""); setLoading(true);
     try { const res = await fetch("/api/auth/resend-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(channel === "bale" ? { email: verificationEmail, phone: balePhone || phone, channel: "bale" } : { email: verificationEmail }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); setVerificationChannel(channel); setError(channel === "bale" ? "کد جدید در بله ارسال شد" : "کد جدید به ایمیل شما ارسال شد"); } catch (error) { setError(error instanceof Error ? error.message : "خطا در ارسال کد"); } finally { setLoading(false); }
  }

  return (
    <div className="min-h-[calc(100vh-80px)] flex">
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
            <pattern id="grid-r" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M 80 0 L 0 0 0 80" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
            <pattern id="dots-r" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="1.5" fill="white" />
            </pattern>
          </defs>
          <rect width="1000" height="1000" fill="url(#grid-r)" />
          <rect y="200" width="1000" height="600" fill="url(#dots-r)" />
          <polygon points="50,950 150,800 250,950" fill="white" opacity="0.3" />
          <polygon points="800,50 900,50 850,150" fill="white" opacity="0.2" />
          <circle cx="850" cy="200" r="120" fill="none" stroke="white" strokeWidth="0.5" opacity="0.3" />
          <circle cx="150" cy="800" r="80" fill="none" stroke="white" strokeWidth="0.5" opacity="0.2" />
        </svg>

        <div className="absolute top-12 right-12 w-24 h-24 border-t-2 border-l-2 border-secondary-fixed/20 rounded-tr-full" />
        <div className="absolute bottom-12 left-12 w-32 h-32 border-b-2 border-r-2 border-secondary-fixed/20 rounded-br-full" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-secondary-fixed flex items-center justify-center mb-6 shadow-lg shadow-black/20">
            <span className="text-primary font-playfair font-bold text-3xl">ه</span>
          </div>

          <h2 className="font-playfair text-3xl font-bold text-white mb-1">
            آکادمی هنر و رسانه
          </h2>
          <p className="font-playfair text-secondary-fixed text-xl font-semibold tracking-wider">
            امام روح‌الله
          </p>

          <div className="w-16 h-0.5 bg-secondary-fixed rounded-full my-6" />

          <p className="text-white/60 text-sm leading-relaxed max-w-xs">
            آموزش هنر و رسانه در تراز انقلاب اسلامی، پرورش استعدادهای متعهد و متخصص برای ساختن آینده‌ای روشن
          </p>
        </div>

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
            <h1 className="text-2xl font-bold text-primary">ایجاد حساب کاربری</h1>
            <p className="text-outline text-sm mt-2">به جمع هنرمندان متعهد بپیوندید</p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-error-container/80 text-error px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-2 border border-error/10">
              <span className="w-1.5 h-1.5 rounded-full bg-error shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          {verificationEmail ? (!verificationChannel ? <div className="space-y-5"><div className="w-16 h-16 rounded-2xl bg-secondary-fixed text-secondary flex items-center justify-center mx-auto"><KeyRound size={28} /></div><div className="text-center"><h2 className="font-black text-primary text-xl">روش تأیید حساب</h2><p className="text-sm text-outline leading-7 mt-2">روش دریافت رمز یک‌بارمصرف را انتخاب کنید.</p></div><button type="button" disabled={loading} onClick={() => resendCode("email")} className="w-full rounded-xl border border-outline-variant bg-white px-4 py-4 text-right"><span className="block font-bold text-primary">تأیید از طریق ایمیل</span><span className="mt-1 block text-xs text-outline" dir="ltr">{verificationEmail}</span></button><button type="button" disabled={loading} onClick={() => resendCode("bale")} className="w-full rounded-xl border border-secondary bg-[#fff8e9] px-4 py-4 text-right"><span className="block font-bold text-primary">تأیید از طریق پیام‌رسان بله</span><span className="mt-1 block text-xs text-outline">ابتدا با شماره موبایل ثبت‌شده امتحان می‌شود.</span></button></div> : <form onSubmit={verifyCode} className="space-y-5"><div className="w-16 h-16 rounded-2xl bg-secondary-fixed text-secondary flex items-center justify-center mx-auto"><KeyRound size={28} /></div><div className="text-center"><h2 className="font-black text-primary text-xl">تأیید {verificationChannel === "bale" ? "بله" : "ایمیل"}</h2><p className="text-sm text-outline leading-7 mt-2">کد شش‌رقمی ارسال‌شده {verificationChannel === "bale" ? "در پیام‌رسان بله" : "به"} <span dir="ltr" className="font-bold text-primary">{verificationChannel === "bale" ? "" : verificationEmail}</span> را وارد کنید.</p></div>{verificationChannel === "bale" && <div><label className="block text-sm font-bold text-primary mb-2">شماره متصل به بله</label><input inputMode="numeric" dir="ltr" value={balePhone} onChange={(event) => setBalePhone(event.target.value)} placeholder={phone || "09123456789"} className="w-full bg-white border border-outline-variant rounded-xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-secondary" /><p className="mt-1 text-xs text-outline">اگر شماره اصلی شما بله ندارد، شماره بله را اینجا وارد و «ارسال مجدد کد» را بزنید.</p></div>}<input autoFocus inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))} className="w-full bg-white border border-outline-variant rounded-xl px-4 py-4 text-center text-2xl tracking-[.5em] font-black outline-none focus:ring-2 focus:ring-secondary" dir="ltr" /><button disabled={loading || verificationCode.length !== 6} className="w-full bg-primary text-white py-3.5 rounded-xl font-bold disabled:opacity-50 flex justify-center gap-2">{loading && <Loader2 size={18} className="animate-spin" />}تأیید و ورود</button><div className="flex justify-between text-xs"><button type="button" onClick={() => resendCode()} disabled={loading} className="text-secondary font-bold">ارسال مجدد کد</button><button type="button" onClick={() => { setVerificationChannel(""); setVerificationCode(""); setError(""); }} className="text-outline">تغییر روش</button></div></form>) : <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-primary mb-2">
                نام و نام خانوادگی
              </label>
              <div className="relative">
                <User
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-outline pointer-events-none"
                />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-white border border-outline-variant rounded-xl pr-12 pl-4 py-3.5 text-sm focus:ring-2 focus:ring-secondary focus:border-secondary focus:outline-none transition-all placeholder:text-outline/50"
                  placeholder="محمدرضا حسینی"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-primary mb-2">شماره موبایل</label>
              <div className="relative"><Phone size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-outline pointer-events-none" /><input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} required dir="ltr" placeholder="09123456789" className="w-full bg-white border border-outline-variant rounded-xl pr-12 pl-4 py-3.5 text-sm focus:ring-2 focus:ring-secondary focus:border-secondary focus:outline-none" /></div>
              <p className="mt-1 text-xs text-outline">برای تکمیل ثبت‌نام، روش تأیید را در مرحله بعد انتخاب می‌کنید.</p>
            </div>

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
                  minLength={6}
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

            <div>
              <label className="block text-sm font-bold text-primary mb-2">
                تکرار رمز عبور
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-outline pointer-events-none"
                />
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-white border border-outline-variant rounded-xl pr-12 pl-12 py-3.5 text-sm focus:ring-2 focus:ring-secondary focus:border-secondary focus:outline-none transition-all placeholder:text-outline/50"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors p-1"
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-l from-primary to-primary-container text-white py-3.5 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/25 transition-all active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2.5"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  در حال ثبت‌نام...
                </>
              ) : (
                "ثبت‌نام"
              )}
            </button>
          </form>}

          {/* Divider */}
           <div className="flex items-center gap-3 my-7">
            <div className="flex-1 h-px bg-outline-variant/60" />
            <span className="text-outline text-sm">یا</span>
            <div className="flex-1 h-px bg-outline-variant/60" />
           </div>
           {!verificationEmail && <GoogleAuthButton label="ثبت‌نام با گوگل" />}

           {/* Login link */}
           <div className="text-center mt-6">
            <p className="text-outline text-sm">
              قبلاً ثبت‌نام کرده‌اید؟{" "}
              <Link
                href="/login"
                className="text-secondary font-bold hover:text-secondary/80 transition-colors"
              >
                وارد شوید
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
