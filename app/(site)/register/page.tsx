"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, KeyRound, Loader2, Mail, MapPin, Phone, User } from "lucide-react";
import { getCookie, setCookie } from "@/lib/cookie";
import AvatarUpload from "@/components/profile/avatar-upload";
import StandaloneRegistrationLocationFields from "@/components/auth/standalone-registration-location-fields";
import {
  createLocationRequestOwner,
  parseCityResponse,
  parseProvinceResponse,
  parseTehranDistrictResponse,
  readLocationResponse,
  startLocationLoad,
} from "@/lib/iran-location-client";

type VerificationMethod = "email" | "bale" | "sms" | "call";
type Province = { id: number; name: string };

const discoveryOptions = ["دوستان و آشنایان", "گوگل", "اینستاگرام", "پیام‌رسان‌ها", "تبلیغات", "سایر"];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"account" | "verify" | "details" | "avatar">("account");
  const [googleRegistration, setGoogleRegistration] = useState(false);
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [method, setMethod] = useState<VerificationMethod | null>(null);
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [districts, setDistricts] = useState<Record<string, string[]>>({});
  const [district, setDistrict] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [discoverySource, setDiscoverySource] = useState("");
  const [avatar, setAvatar] = useState("");
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [provinceRequestOwner] = useState(createLocationRequestOwner);
  const [locationRequestOwner] = useState(createLocationRequestOwner);
  const [locationRetry, setLocationRetry] = useState(0);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("google") !== "1") return;
    const currentToken = getCookie("token");
    if (!currentToken) return;
    fetch("/api/user/profile", { headers: { Authorization: `Bearer ${currentToken}` } })
      .then((res) => res.json())
      .then(({ user }) => {
        if (!user) return;
        if (user.registrationCompleted) { router.replace("/dashboard"); return; }
        setGoogleRegistration(true);
        setToken(currentToken);
        setName(user.name || "");
        setEmail(user.email || "");
        setPhone(user.phone || "");
        setGender(user.gender || "");
      })
      .catch(() => setError("دریافت اطلاعات حساب گوگل ناموفق بود"));
  }, [router]);

  useEffect(() => {
    if (step !== "details") return;
    const load = startLocationLoad({
      owner: provinceRequestOwner,
      errorMessage: "دریافت فهرست استان‌ها ناموفق بود",
      load: (signal) => readLocationResponse(
        fetch("/api/locations", { signal }),
        parseProvinceResponse,
        signal,
      ),
      onStart: () => setLocationError(""),
      onSuccess: (nextProvinces) => {
        setProvinces(nextProvinces);
        setLocationError("");
      },
      onError: (message) => {
        setProvinces([]);
        setLocationError(message);
      },
      onComplete: () => {},
    });
    return load.cancel;
  }, [step, provinceRequestOwner, locationRetry]);

  useEffect(() => {
    setCities([]); setDistricts({}); setCity(""); setDistrict(""); setNeighborhood("");
    if (!province) {
      locationRequestOwner.cancel();
      setLocationError("");
      return;
    }
    const selected = provinces.find((item) => item.name === province);
    if (!selected) {
      locationRequestOwner.cancel();
      return;
    }

    const load = startLocationLoad({
      owner: locationRequestOwner,
      errorMessage: "دریافت فهرست شهرها ناموفق بود",
      load: async (signal) => {
        const citiesPromise = readLocationResponse(
          fetch(`/api/locations?provinceId=${selected.id}`, { signal }),
          parseCityResponse,
          signal,
          "دریافت فهرست شهرها ناموفق بود",
        );
        const districtsPromise = province === "تهران"
          ? readLocationResponse(
              fetch("/api/tehran-neighborhoods", { signal }),
              parseTehranDistrictResponse,
              signal,
              "دریافت فهرست مناطق تهران ناموفق بود",
            )
          : Promise.resolve<Record<string, string[]>>({});
        const [nextCities, nextDistricts] = await Promise.all([citiesPromise, districtsPromise]);
        return { nextCities, nextDistricts };
      },
      onStart: () => setLocationError(""),
      onSuccess: ({ nextCities, nextDistricts }) => {
        setCities(nextCities);
        setDistricts(nextDistricts);
        setLocationError("");
      },
      onError: (message) => {
        setCities([]); setDistricts({}); setCity(""); setDistrict(""); setNeighborhood("");
        setLocationError(message);
      },
      onComplete: () => {},
    });

    return load.cancel;
  }, [province, provinces, locationRequestOwner, locationRetry]);

  const clearMessages = () => { setError(""); setNotice(""); };

  async function createAccount(event: FormEvent) {
    event.preventDefault(); clearMessages();
    const normalizedName = name.trim().replace(/\s+/g, " ");
    if (!/^[آ-ی ]+$/.test(normalizedName) || normalizedName.split(" ").filter(Boolean).length < 2) return setError("نام و نام خانوادگی را فقط با حروف فارسی وارد کنید");
    if (!gender) return setError("جنسیت را انتخاب کنید");
    if (!/^09\d{9}$/.test(phone.replace(/\D/g, ""))) return setError("شماره موبایل معتبر وارد کنید");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("ایمیل معتبر وارد کنید");
    if (!googleRegistration && password.length < 6) return setError("رمز عبور باید حداقل ۶ کاراکتر باشد");
    if (!googleRegistration && password !== confirmPassword) return setError("رمز عبور و تکرار آن مطابقت ندارند");
    setLoading(true);
    try {
      if (googleRegistration) {
        const res = await fetch("/api/auth/google-registration", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: normalizedName, gender, phone }) });
        const data = await res.json(); if (!res.ok) throw new Error(data.error);
        setStep("details");
        return;
      }
      const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: normalizedName, gender, email, phone, password, notificationChannel: "sms" }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      setStep("verify"); setNotice("حساب شما ایجاد شد. برای ادامه حداقل یکی از روش‌های زیر را تأیید کنید.");
    } catch (err) { setError(err instanceof Error ? err.message : "ثبت‌نام ناموفق بود"); } finally { setLoading(false); }
  }

  async function sendCode(nextMethod: VerificationMethod) {
    clearMessages(); setLoading(true);
    try {
      const res = await fetch("/api/auth/resend-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, phone, channel: nextMethod }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      setMethod(nextMethod); setCode(""); setNotice(data.message || "کد تأیید ارسال شد");
    } catch (err) { setError(err instanceof Error ? err.message : "ارسال کد ناموفق بود"); } finally { setLoading(false); }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault(); if (!method) return; clearMessages(); setLoading(true);
    try {
      const res = await fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, phone, code, channel: method }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      setCookie("token", data.token); window.dispatchEvent(new Event("auth-changed")); setToken(data.token); setStep("details");
    } catch (err) { setError(err instanceof Error ? err.message : "تأیید کد ناموفق بود"); } finally { setLoading(false); }
  }

  async function saveDetails(event: FormEvent) {
    event.preventDefault(); clearMessages();
    if (!province || !city || !discoverySource) return setError("استان، شهر و نحوه آشنایی با سایت را انتخاب کنید");
    if (province === "تهران" && city === "تهران" && !district) return setError("برای تهران، منطقه را انتخاب کنید");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/complete-registration", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ province, city, district, neighborhood, discoverySource }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error); setStep("avatar");
    } catch (err) { setError(err instanceof Error ? err.message : "ذخیره اطلاعات ناموفق بود"); } finally { setLoading(false); }
  }

  function finish() { window.dispatchEvent(new Event("profile-updated")); router.push("/dashboard"); }
  const stepNumber = step === "account" ? 1 : step === "verify" ? 2 : step === "details" ? 3 : 4;
  const displayedError = error || locationError;

  return <main className="min-h-[calc(100vh-96px)] bg-surface px-4 py-24"><div className="mx-auto w-full max-w-xl rounded-3xl border border-outline-variant/30 bg-white p-6 shadow-sm md:p-9">
    <div className="mb-8 text-center"><h1 className="text-2xl font-black text-primary">ایجاد حساب کاربری</h1><p className="mt-2 text-sm text-outline">مرحله {stepNumber} از 4</p><div className="mt-4 flex gap-2">{[1, 2, 3, 4].map((item) => <span key={item} className={`h-1.5 flex-1 rounded-full ${item <= stepNumber ? "bg-secondary" : "bg-outline-variant/30"}`} />)}</div></div>
    {(displayedError || notice) && <div className={`mb-6 flex gap-2 rounded-xl px-4 py-3 text-sm ${displayedError ? "bg-error-container text-error" : "bg-green-50 text-green-800"}`}>{displayedError ? <KeyRound size={17} /> : <CheckCircle2 size={17} />}{displayedError || notice}</div>}
    {step === "account" && <form onSubmit={createAccount} className="space-y-5">{googleRegistration && <p className="rounded-xl bg-green-50 p-3 text-sm leading-6 text-green-800">ایمیل شما توسط گوگل تأیید شده است. برای تکمیل ثبت‌نام، اطلاعات زیر را وارد کنید.</p>}<Field label="نام و نام خانوادگی"><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="محمدرضا حسینی" /></Field><fieldset><legend className="mb-2 block text-sm font-bold text-primary">جنسیت</legend><div className="grid grid-cols-2 gap-3">{[["male", "آقا"], ["female", "خانم"]].map(([value, label]) => <label key={value} className={`cursor-pointer rounded-xl border p-3 text-center text-sm font-bold ${gender === value ? "border-primary bg-primary text-white" : "border-outline-variant text-primary"}`}><input className="sr-only" type="radio" name="gender" checked={gender === value} onChange={() => setGender(value)} />{label}</label>)}</div></fieldset><Field label="شماره تلفن همراه"><input dir="ltr" inputMode="numeric" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder="09123456789" /></Field><Field label="ایمیل"><input readOnly={googleRegistration} dir="ltr" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="example@email.com" /></Field>{!googleRegistration && <><Field label="رمز عبور"><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></Field><Field label="تکرار رمز عبور"><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" /></Field></>}<Submit loading={loading}>ادامه <ChevronLeft size={18} /></Submit></form>}
    {step === "verify" && !method && <div className="space-y-3"><p className="text-center text-sm leading-7 text-outline">حداقل یکی از روش‌ها را تأیید کنید.</p><VerificationButton icon={<Mail />} title="تأیید ایمیل" description={email} onClick={() => sendCode("email")} disabled={loading} /><VerificationButton icon={<Phone />} title="تأیید با پیام‌رسان بله" description="کد در پیام‌رسان بله ارسال می‌شود" onClick={() => sendCode("bale")} disabled={loading} /><VerificationButton icon={<Phone />} title="تأیید با پیامک" description="کد به شماره همراه ارسال می‌شود" onClick={() => sendCode("sms")} disabled={loading} /><VerificationButton icon={<Phone />} title="تماس گویای کد" description="در صورت نرسیدن پیامک، کد را تلفنی دریافت کنید" onClick={() => sendCode("call")} disabled={loading} /></div>}
    {step === "verify" && method && <form onSubmit={verifyCode} className="space-y-5"><div className="text-center"><KeyRound className="mx-auto text-secondary" size={32} /><h2 className="mt-3 font-bold text-primary">کد تأیید را وارد کنید</h2><p className="mt-1 text-sm text-outline">{method === "email" ? email : phone}</p></div><Field label="کد شش‌رقمی"><input dir="ltr" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} maxLength={6} className="text-center tracking-[0.5em]" /></Field><Submit loading={loading}>تأیید و ادامه <ChevronLeft size={18} /></Submit><button type="button" onClick={() => { clearMessages(); setMethod(null); }} className="w-full text-sm font-bold text-secondary">تغییر روش تأیید</button></form>}
    {step === "details" && <form onSubmit={saveDetails} className="space-y-5"><div className="text-center"><MapPin className="mx-auto text-secondary" size={32} /><h2 className="mt-3 font-bold text-primary">اطلاعات تکمیلی</h2></div><StandaloneRegistrationLocationFields provinces={provinces} cities={cities} districts={districts} value={{ province, city, district, neighborhood }} onChange={(value) => { setProvince(value.province); setCity(value.city); setDistrict(value.district); setNeighborhood(value.neighborhood); }} />{locationError && <button type="button" onClick={() => setLocationRetry((current) => current + 1)} className="rounded-lg border border-error/40 px-3 py-1.5 text-xs font-bold text-error hover:bg-error-container/20">تلاش مجدد برای دریافت استان و شهر</button>}<Select label="چطور با سایت ما آشنا شدید؟" value={discoverySource} onChange={setDiscoverySource} options={discoveryOptions} /><Submit loading={loading}>ادامه <ChevronLeft size={18} /></Submit></form>}
    {step === "avatar" && <div className="space-y-6 text-center"><User className="mx-auto text-secondary" size={32} /><div><h2 className="font-bold text-primary">تصویر پروفایل</h2><p className="mt-2 text-sm leading-7 text-outline">برای صدور گواهی پایان دوره، داشتن تصویر پروفایل مناسب الزامی است. می‌توانید اکنون تصویر را انتخاب کنید یا بعداً از بخش پروفایل آن را تکمیل کنید.</p></div><div className="flex justify-center text-right"><AvatarUpload value={avatar} onChange={(url) => setAvatar(url)} /></div><button type="button" onClick={finish} className="w-full rounded-xl bg-primary py-3.5 font-bold text-white">{avatar ? "پایان ثبت‌نام" : "بعداً انتخاب می‌کنم"}</button></div>}
    <p className="mt-7 text-center text-sm text-outline">حساب دارید؟ <Link className="font-bold text-secondary" href="/login">وارد شوید</Link></p>
  </div></main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-bold text-primary [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-outline-variant [&_input]:bg-white [&_input]:px-4 [&_input]:py-3.5 [&_input]:text-sm [&_input]:font-normal [&_input]:outline-none [&_input]:focus:ring-2 [&_input]:focus:ring-secondary"><span className="mb-2 block">{label}</span>{children}</label>; }
function Select({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (value: string) => void; options: string[]; disabled?: boolean }) { return <label className="block text-sm font-bold text-primary"><span className="mb-2 block">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3.5 text-sm disabled:opacity-50"><option value="">انتخاب کنید</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>; }
function Submit({ loading, children }: { loading: boolean; children: React.ReactNode }) { return <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-bold text-white disabled:opacity-60">{loading ? <Loader2 className="animate-spin" size={18} /> : children}</button>; }
function VerificationButton({ icon, title, description, onClick, disabled }: { icon: React.ReactNode; title: string; description: string; onClick: () => void; disabled: boolean }) { return <button type="button" onClick={onClick} disabled={disabled} className="flex w-full items-center gap-3 rounded-xl border border-outline-variant p-4 text-right transition hover:border-secondary disabled:opacity-60"><span className="text-secondary">{icon}</span><span><span className="block font-bold text-primary">{title}</span><span className="mt-1 block text-xs text-outline">{description}</span></span></button>; }
