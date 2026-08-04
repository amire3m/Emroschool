"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  Save,
  AlertCircle,
  CheckCircle2,
  User,
  Mail,
  Phone,
  Link as LinkIcon,
  Eye,
  EyeOff,
} from "lucide-react";
import { getCookie } from "@/lib/cookie";
import AvatarUpload from "@/components/profile/avatar-upload";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  balePhone?: string;
  province?: string; city?: string; address?: string; postalCode?: string; workHistory?: string; artHistory?: string;
  educationLevel?: string; educationField?: string; instagramId?: string; virtualPhone?: string; landline?: string;
  avatar?: string;
  bio?: string;
  expertise?: string;
  socialLinks?: string;
  role: string;
  userType: string;
  profileVisible: boolean;
  profileApprovalStatus: string;
  profileRejectionReason?: string | null;
  avatarSubmissions?: Array<{ id: string; imageUrl: string; status: string; rejectionReason?: string | null; submittedAt: string }>;
  newsletterSubscribed: boolean;
  notificationEmailEnabled: boolean;
  notificationSmsEnabled: boolean;
  notificationBaleEnabled: boolean;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState({ province: "", city: "", address: "", postalCode: "", workHistory: "", artHistory: "", educationLevel: "", educationField: "", instagramId: "", virtualPhone: "", landline: "" });
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [avatar, setAvatar] = useState("");
  const [bio, setBio] = useState("");
  const [expertise, setExpertise] = useState("");
  const [socialLinks, setSocialLinks] = useState("");
  const [profileVisible, setProfileVisible] = useState(false);
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);
  const [notificationEmailEnabled, setNotificationEmailEnabled] = useState(true);
  const [notificationChannel, setNotificationChannel] = useState<"sms" | "bale">("sms");
  const [contactVerification, setContactVerification] = useState<{ field: "email" | "phone"; method: "email" | "bale" | "sms" | "call"; value: string; code: string } | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      const token = getCookie("token");
      if (!token) return;

      try {
        const res = await fetch("/api/user/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        const user = data.user;
        setProfile(user);
        setName(user.name || "");
        setEmail(user.email || "");
        setPhone(user.phone || "");
        setDetails({ province: user.province || "", city: user.city || "", address: user.address || "", postalCode: user.postalCode || "", workHistory: user.workHistory || "", artHistory: user.artHistory || "", educationLevel: user.educationLevel || "", educationField: user.educationField || "", instagramId: user.instagramId || "", virtualPhone: user.virtualPhone || "", landline: user.landline || "" });
        setAvatar(user.avatar || "");
        setBio(user.bio || "");
        setExpertise(user.expertise || "");
        setSocialLinks(user.socialLinks || "");
        setProfileVisible(Boolean(user.profileVisible));
        setNewsletterSubscribed(Boolean(user.newsletterSubscribed));
        setNotificationEmailEnabled(user.notificationEmailEnabled !== false);
        setNotificationChannel(user.notificationBaleEnabled ? "bale" : "sms");
      } catch {
        setError("خطا در بارگذاری پروفایل");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password && password !== passwordConfirm) {
      setError("کلمه عبور و تکرار آن مطابقت ندارند");
      return;
    }

    const token = getCookie("token");
    if (!token) return;

    setSaving(true);
    try {
      const body: Record<string, unknown> = { name, ...details, bio, expertise, socialLinks, profileVisible, newsletterSubscribed, notificationEmailEnabled, notificationSmsEnabled: notificationChannel === "sms", notificationBaleEnabled: notificationChannel === "bale" };
      if (password) body.password = password;

      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "خطا در ذخیره");
      }
      const data = await res.json();
      setProfile((current) => current ? { ...current, ...data.user } : data.user);
      setSuccess("پروفایل با موفقیت بروزرسانی شد");
      setPassword("");
      setPasswordConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ذخیره پروفایل");
    } finally {
      setSaving(false);
    }
  }

  async function sendContactCode(field: "email" | "phone", method: "email" | "bale" | "sms" | "call") {
    const value = field === "email" ? email : phone;
    const token = getCookie("token");
    if (!token) return;
    setError(""); setSuccess(""); setSaving(true);
    try {
      const res = await fetch("/api/user/contact-verification", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ field, method, value }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      setContactVerification({ field, method, value, code: "" });
      setSuccess("کد تأیید ارسال شد");
    } catch (err) { setError(err instanceof Error ? err.message : "ارسال کد ناموفق بود"); }
    finally { setSaving(false); }
  }

  async function confirmContactCode() {
    if (!contactVerification) return;
    const token = getCookie("token"); if (!token) return;
    setError(""); setSaving(true);
    try {
      const res = await fetch("/api/user/contact-verification", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(contactVerification) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      setProfile((current) => current ? { ...current, ...data.user } : current);
      if (contactVerification.field === "email") setEmail(data.user.email); else setPhone(data.user.phone);
      setContactVerification(null); setSuccess("اطلاعات تماس با موفقیت تأیید و ذخیره شد");
    } catch (err) { setError(err instanceof Error ? err.message : "تأیید کد ناموفق بود"); }
    finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary">ویرایش پروفایل</h1>
        <p className="text-outline mt-1">اطلاعات حساب کاربری خود را ویرایش کنید</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-error-container text-error px-4 py-3 rounded-xl mb-6 text-sm">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-xl mb-6 text-sm">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}
      {profile?.profileApprovalStatus === "rejected" && profile.profileRejectionReason && <div className="mb-6 rounded-xl border border-error/30 bg-error-container p-4 text-sm leading-7 text-error"><b>پروفایل شما نیاز به اصلاح دارد.</b><br />دلیل بررسی: {profile.profileRejectionReason}<br /><span className="text-xs">پس از اصلاح و ذخیره اطلاعات، پروفایل دوباره برای بررسی ارسال می‌شود.</span></div>}

      <form
        onSubmit={handleSubmit}
        className="max-w-2xl bg-white rounded-2xl shadow-sm border border-outline-variant/30 p-6 md:p-8 space-y-6"
      >
        <div className="flex items-center gap-4 pb-6 border-b border-outline-variant/20">
          <AvatarUpload value={profile?.avatarSubmissions?.[0]?.status === "pending" ? profile.avatarSubmissions[0].imageUrl : avatar} onChange={(url, submission) => { setAvatar(url); if (submission) setProfile((current) => current ? { ...current, avatarSubmissions: [submission] } : current); }} />
          <div><p className="font-bold text-primary">{profile?.name}</p><p className="text-outline text-sm">{profile?.email}</p></div>
        </div>
        {profile?.avatarSubmissions?.[0] && <div className={`rounded-xl p-3 text-xs leading-6 ${profile.avatarSubmissions[0].status === "rejected" ? "bg-error-container text-error" : profile.avatarSubmissions[0].status === "pending" ? "bg-[#fff8e9] text-secondary" : "bg-surface-low text-outline"}`}>{profile.avatarSubmissions[0].status === "pending" ? "تصویر جدید شما در انتظار بررسی مدیر است و هنوز عمومی نشده است." : profile.avatarSubmissions[0].status === "rejected" ? <>تصویر پروفایل تایید نشد. دلیل: {profile.avatarSubmissions[0].rejectionReason || "نیاز به تصویر مناسب‌تر"}<br />می‌توانید تصویر جدیدی بارگذاری کنید.</> : null}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-bold text-primary mb-1.5">
              نام و نام خانوادگی
            </label>
            <input
              type="text"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-primary mb-1.5 flex items-center gap-1">
              <Mail size={14} />
              ایمیل
            </label>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between gap-2"><span className={`text-xs font-bold ${profile?.emailVerified ? "text-green-700" : "text-outline"}`}>{profile?.emailVerified ? "تأییدشده" : "تأییدنشده"}</span>{email !== profile?.email && <button type="button" onClick={() => sendContactCode("email", "email")} disabled={saving} className="text-xs font-bold text-secondary">ارسال کد تأیید</button>}</div>
          </div>

          <div>
            <label className="block text-sm font-bold text-primary mb-1.5 flex items-center gap-1">
              <Phone size={14} />
              تلفن
            </label>
            <input
              type="tel"
              name="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2"><span className={`text-xs font-bold ${profile?.phoneVerified ? "text-green-700" : "text-outline"}`}>{profile?.phoneVerified ? `تأییدشده${profile?.balePhone ? " با بله" : ""}` : "تأییدنشده"}</span>{phone !== profile?.phone && <><button type="button" onClick={() => sendContactCode("phone", "bale")} disabled={saving} className="text-xs font-bold text-secondary">کد در بله</button><button type="button" onClick={() => sendContactCode("phone", "sms")} disabled={saving} className="text-xs font-bold text-secondary">کد پیامکی</button><button type="button" onClick={() => sendContactCode("phone", "call")} disabled={saving} className="text-xs font-bold text-secondary">تماس گویای کد</button></>}</div>
          </div>

        </div>

        <div>
          <label className="block text-sm font-bold text-primary mb-1.5">
            بیوگرافی
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary focus:outline-none resize-none"
          />
        </div>

        <div className="border-t border-outline-variant/20 pt-6 space-y-5">
          <div><h3 className="font-bold text-primary">اطلاعات تکمیلی ثبت‌نام</h3><p className="text-xs text-outline mt-1">این اطلاعات در فرم دوره‌ها به‌صورت خودکار تکمیل می‌شود.</p></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[{ key: "province", label: "استان", autoComplete: "address-level1" }, { key: "city", label: "شهر", autoComplete: "address-level2" }, { key: "postalCode", label: "کد پستی", autoComplete: "postal-code" }, { key: "educationLevel", label: "مقطع تحصیلی", autoComplete: "off" }, { key: "educationField", label: "رشته تحصیلی", autoComplete: "off" }, { key: "instagramId", label: "آیدی اینستاگرام", autoComplete: "off" }, { key: "virtualPhone", label: "شماره فعال در فضای مجازی", autoComplete: "tel" }, { key: "landline", label: "تلفن ثابت", autoComplete: "tel" }].map((item) => <div key={item.key}><label className="block text-sm font-bold text-primary mb-1.5">{item.label}</label><input name={item.key} autoComplete={item.autoComplete} value={details[item.key as keyof typeof details]} onChange={(e) => setDetails((current) => ({ ...current, [item.key]: e.target.value }))} className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary focus:outline-none" /></div>)}
            <div className="md:col-span-2"><label className="block text-sm font-bold text-primary mb-1.5">آدرس محل سکونت</label><textarea name="address" autoComplete="street-address" rows={2} value={details.address} onChange={(e) => setDetails((current) => ({ ...current, address: e.target.value }))} className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary focus:outline-none" /></div>
            <div><label className="block text-sm font-bold text-primary mb-1.5">سوابق کاری</label><textarea rows={3} value={details.workHistory} onChange={(e) => setDetails((current) => ({ ...current, workHistory: e.target.value }))} className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary focus:outline-none" /></div>
            <div><label className="block text-sm font-bold text-primary mb-1.5">سوابق هنری</label><textarea rows={3} value={details.artHistory} onChange={(e) => setDetails((current) => ({ ...current, artHistory: e.target.value }))} className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary focus:outline-none" /></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-bold text-primary mb-1.5">
              تخصص
            </label>
            <input
              type="text"
              value={expertise}
              onChange={(e) => setExpertise(e.target.value)}
              placeholder="مثال: کارگردانی سینما"
              className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-primary mb-1.5 flex items-center gap-1">
              <LinkIcon size={14} />
              لینک‌های اجتماعی
            </label>
            <input
              type="text"
              value={socialLinks}
              onChange={(e) => setSocialLinks(e.target.value)}
              placeholder="آدرس اینستاگرام، بله، و غیره"
              className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary focus:outline-none"
            />
          </div>
        </div>

        <div className="border-t border-outline-variant/20 pt-6 space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-outline-variant/30 bg-surface-low p-4">
            <div className="flex items-start gap-3">
              {profileVisible ? <Eye size={20} className="mt-0.5 text-green-600" /> : <EyeOff size={20} className="mt-0.5 text-outline" />}
              <div>
                <h3 className="text-sm font-bold text-primary">نمایش عمومی پروفایل</h3>
                <p className="mt-1 text-xs text-outline">
                  {profileVisible ? "پروفایل شما برای عموم قابل مشاهده است." : "پروفایل شما از دید عموم مخفی است."}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={profileVisible}
              onClick={() => setProfileVisible((visible) => !visible)}
              className={`relative h-6 w-12 shrink-0 rounded-full transition-colors ${profileVisible ? "bg-green-500" : "bg-outline-variant"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${profileVisible ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-secondary-fixed/60 bg-[#fff8e9] p-4">
            <div className="flex items-start gap-3">
              <Mail size={20} className="mt-0.5 text-secondary" />
              <div>
                <h3 className="text-sm font-bold text-primary">عضویت در خبرنامه آکادمی</h3>
                <p className="mt-1 text-xs text-outline">از دوره‌ها، رویدادها و فرصت‌های تازه آکادمی باخبر شوید.</p>
              </div>
            </div>
            <button type="button" role="switch" aria-checked={newsletterSubscribed} onClick={() => setNewsletterSubscribed((value) => !value)} className={`relative h-6 w-12 shrink-0 rounded-full transition-colors ${newsletterSubscribed ? "bg-secondary" : "bg-outline-variant"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${newsletterSubscribed ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
          </div>

          <section className="rounded-2xl border border-secondary-fixed/60 bg-[#fff8e9] p-4"><h3 className="text-sm font-bold text-primary">ترجیحات دریافت اعلان</h3><p className="mt-1 text-xs leading-6 text-outline">یک روش از پیامک یا پیام‌رسان بله الزامی است؛ دریافت اعلان ایمیلی اختیاری است و نشانی ایمیل حساب شما را تغییر نمی‌دهد.</p><label className="mt-4 flex items-center justify-between gap-3 text-sm font-bold text-primary"><span>دریافت اعلان از طریق ایمیل</span><input type="checkbox" checked={notificationEmailEnabled} onChange={(event) => setNotificationEmailEnabled(event.target.checked)} className="h-5 w-5 accent-primary" /></label><div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"><label className={`cursor-pointer rounded-xl border p-3 text-center text-sm font-bold ${notificationChannel === "sms" ? "border-primary bg-primary text-white" : "border-outline-variant bg-white text-primary"}`}><input className="sr-only" type="radio" name="profileNotificationChannel" checked={notificationChannel === "sms"} onChange={() => setNotificationChannel("sms")} />پیامک</label><label className={`cursor-pointer rounded-xl border p-3 text-center text-sm font-bold ${notificationChannel === "bale" ? "border-primary bg-primary text-white" : "border-outline-variant bg-white text-primary"}`}><input className="sr-only" type="radio" name="profileNotificationChannel" checked={notificationChannel === "bale"} onChange={() => setNotificationChannel("bale")} />پیام‌رسان بله</label></div></section>

          <h3 className="text-sm font-bold text-primary mb-4">
            تغییر کلمه عبور (اختیاری)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-primary mb-1.5">
                کلمه عبور جدید
              </label>
              <input
                type="password"
                name="newPassword"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="ترجیحاً حداقل ۸ کاراکتر"
                className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-primary mb-1.5">
                تکرار کلمه عبور
              </label>
              <input
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="تکرار کلمه عبور جدید"
                className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary focus:outline-none"
              />
            </div>
          </div>
        </div>

        {contactVerification && <div className="rounded-2xl border border-secondary-fixed bg-[#fff8e9] p-4"><p className="text-sm font-bold text-primary">کد تأیید {contactVerification.method === "bale" ? "بله" : contactVerification.method === "sms" ? "پیامکی" : contactVerification.method === "call" ? "تماس تلفنی" : "ایمیل"} را وارد کنید</p><div className="mt-3 flex gap-3"><input autoFocus name="oneTimeCode" autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={contactVerification.code} onChange={(event) => setContactVerification((current) => current ? { ...current, code: event.target.value.replace(/\D/g, "") } : current)} className="min-w-0 flex-1 rounded-xl border border-outline-variant bg-white px-3 py-2.5 text-center text-lg font-bold tracking-[.4em]" dir="ltr" /><button type="button" onClick={confirmContactCode} disabled={saving || contactVerification.code.length !== 6} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">تأیید</button></div></div>}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 bg-primary text-white w-full py-3.5 rounded-xl font-bold hover:bg-primary-container transition-all active:scale-[0.99] disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Save size={18} />
          )}
          {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
        </button>
      </form>
    </div>
  );
}
