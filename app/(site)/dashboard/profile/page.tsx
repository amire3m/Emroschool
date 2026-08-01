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
  province?: string; city?: string; address?: string; postalCode?: string; workHistory?: string; artHistory?: string;
  educationLevel?: string; educationField?: string; instagramId?: string; virtualPhone?: string; landline?: string;
  avatar?: string;
  bio?: string;
  expertise?: string;
  socialLinks?: string;
  role: string;
  userType: string;
  profileVisible: boolean;
  newsletterSubscribed: boolean;
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
      const body: Record<string, unknown> = { name, email, phone, ...details, avatar, bio, expertise, socialLinks, profileVisible, newsletterSubscribed };
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

      <form
        onSubmit={handleSubmit}
        className="max-w-2xl bg-white rounded-2xl shadow-sm border border-outline-variant/30 p-6 md:p-8 space-y-6"
      >
        <div className="flex items-center gap-4 pb-6 border-b border-outline-variant/20">
          <AvatarUpload value={avatar} onChange={setAvatar} />
          <div><p className="font-bold text-primary">{profile?.name}</p><p className="text-outline text-sm">{profile?.email}</p></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-bold text-primary mb-1.5">
              نام و نام خانوادگی
            </label>
            <input
              type="text"
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-primary mb-1.5 flex items-center gap-1">
              <Phone size={14} />
              تلفن
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary focus:outline-none"
            />
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
            {[{ key: "province", label: "استان" }, { key: "city", label: "شهر" }, { key: "postalCode", label: "کد پستی" }, { key: "educationLevel", label: "مقطع تحصیلی" }, { key: "educationField", label: "رشته تحصیلی" }, { key: "instagramId", label: "آیدی اینستاگرام" }, { key: "virtualPhone", label: "شماره فعال در فضای مجازی" }, { key: "landline", label: "تلفن ثابت" }].map((item) => <div key={item.key}><label className="block text-sm font-bold text-primary mb-1.5">{item.label}</label><input value={details[item.key as keyof typeof details]} onChange={(e) => setDetails((current) => ({ ...current, [item.key]: e.target.value }))} className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary focus:outline-none" /></div>)}
            <div className="md:col-span-2"><label className="block text-sm font-bold text-primary mb-1.5">آدرس محل سکونت</label><textarea rows={2} value={details.address} onChange={(e) => setDetails((current) => ({ ...current, address: e.target.value }))} className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary focus:outline-none" /></div>
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

        <div className="border-t border-outline-variant/20 pt-6">
           <div className="flex items-center justify-between gap-4 p-4 mb-6 rounded-2xl bg-surface-low border border-outline-variant/30">
            <div className="flex items-start gap-3">
              {profileVisible ? <Eye size={20} className="text-green-600 mt-0.5" /> : <EyeOff size={20} className="text-outline mt-0.5" />}
              <div>
                <h3 className="text-sm font-bold text-primary">نمایش عمومی پروفایل</h3>
                <p className="text-xs text-outline mt-1">
                  {profileVisible ? "پروفایل شما برای عموم قابل مشاهده است." : "پروفایل شما از دید عموم مخفی است."}
                </p>
           </div>

           <div className="flex items-center justify-between gap-4 p-4 mb-6 rounded-2xl bg-[#fff8e9] border border-secondary-fixed/60">
             <div className="flex items-start gap-3">
               <Mail size={20} className="text-secondary mt-0.5" />
               <div>
                 <h3 className="text-sm font-bold text-primary">عضویت در خبرنامه آکادمی</h3>
                 <p className="text-xs text-outline mt-1">از دوره‌ها، رویدادها و فرصت‌های تازه آکادمی باخبر شوید.</p>
               </div>
             </div>
             <button type="button" role="switch" aria-checked={newsletterSubscribed} onClick={() => setNewsletterSubscribed((value) => !value)} className={`relative w-12 h-6 rounded-full shrink-0 transition-colors ${newsletterSubscribed ? "bg-secondary" : "bg-outline-variant"}`}>
               <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${newsletterSubscribed ? "translate-x-6" : "translate-x-0.5"}`} />
             </button>
           </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={profileVisible}
              onClick={() => setProfileVisible((visible) => !visible)}
              className={`relative w-12 h-6 rounded-full shrink-0 transition-colors ${profileVisible ? "bg-green-500" : "bg-outline-variant"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${profileVisible ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
          </div>

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
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="تکرار کلمه عبور جدید"
                className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary focus:outline-none"
              />
            </div>
          </div>
        </div>

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
