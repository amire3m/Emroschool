"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import PersianDateTimePicker from "@/components/ui/persian-date-time-picker";
import {
  isValidIranianNationalCode,
  normalizeIranianNationalCode,
} from "@/lib/iranian-national-code";
import IranLocationFields from "@/components/ui/iran-location-fields";
import {
  getIranianMobileOperator,
  isValidIranianMobile,
  normalizeIranianMobile,
} from "@/lib/iranian-mobile";
import { defaultRegistrationForm, RegistrationFormSchema } from "@/lib/registration-form";

const initialForm = {
  fullName: "",
  email: "",
  phone: "",
  nationalCode: "",
  birthDate: "",
  gender: "",
  province: "",
  city: "",
  district: "",
  neighborhood: "",
  address: "",
  postalCode: "",
  workHistory: "",
  artHistory: "",
  educationLevel: "",
  educationField: "",
  university: "",
  universityField: "",
  reason: "",
  knowsInstructors: false,
  familiarityDetails: "",
  instagramId: "",
  virtualPhone: "",
  landline: "",
};
type FormData = typeof initialForm;

export default function CourseRegistrationModal({
  courseId,
  courseTitle,
  onClose,
  onSuccess,
}: {
  courseId: string;
  courseTitle: string;
  onClose: () => void;
  onSuccess: (result: {
    applicationId: string;
    profileUpdated: boolean;
  }) => void;
}) {
  const [form, setForm] = useState<FormData>(initialForm);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [discountGroups, setDiscountGroups] = useState<string[]>([]);
  const [discountGroup, setDiscountGroup] = useState("");
  const [discountDocument, setDiscountDocument] = useState<File | null>(null);
  const [tehranDistricts, setTehranDistricts] = useState<Record<string, string[]>>({});
  const [universities, setUniversities] = useState<string[]>([]);
  const [universitySearch, setUniversitySearch] = useState("");
  const [showUniversities, setShowUniversities] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const [formSchema, setFormSchema] = useState<RegistrationFormSchema>(defaultRegistrationForm);
  const [customResponses, setCustomResponses] = useState<Record<string, string>>({});
  const [customFiles, setCustomFiles] = useState<Record<string, File | null>>({});
  const isTehran = form.province === "تهران" && form.city === "تهران";
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const token = getCookie("token");
    fetch("/api/user/profile", {
      headers: { authorization: `Bearer ${token || ""}` },
    })
      .then((response) => response.json())
      .then(({ user }) => {
        if (user)
          setForm({
            fullName: user.name || "",
            email: user.email || "",
            phone: normalizeIranianMobile(user.phone || ""),
            nationalCode: user.nationalCode || "",
            birthDate: user.birthDate || "",
            gender: user.gender || "",
            province: user.province || "",
            city: user.city || "",
            district: user.district || "",
            neighborhood: user.neighborhood || "",
            address: user.address || "",
            postalCode: user.postalCode || "",
            workHistory: user.workHistory || "",
            artHistory: user.artHistory || "",
            educationLevel: user.educationLevel || "",
            educationField: user.educationField || "",
            university: user.university || "",
            universityField: user.universityField || "",
            reason: "",
            knowsInstructors: false,
            familiarityDetails: "",
            instagramId: user.instagramId || "",
            virtualPhone: user.virtualPhone || user.phone || "",
            landline: user.landline || "",
          });
        if (user && [user.name, user.email, user.phone, user.nationalCode, user.birthDate, user.gender, user.province, user.city, user.address, user.educationLevel, user.educationField, user.university, user.universityField, user.workHistory, user.artHistory, user.instagramId, user.virtualPhone].every((value) => typeof value === "string" && value.trim())) { setProfileComplete(true); setStep(3); }
      })
      .finally(() => setLoading(false));
    fetch("/api/discount-codes")
      .then((response) => response.json())
      .then(({ discountCodes }) =>
        setDiscountGroups(
          Array.isArray(discountCodes)
            ? discountCodes
                .map((discount: { label?: unknown }) => discount.label)
                .filter(
                  (label: unknown): label is string =>
                    typeof label === "string",
                )
            : [],
        ),
      );
    fetch("/api/tehran-neighborhoods").then((response) => response.json()).then((data) => setTehranDistricts(data.districts || {})).catch(() => {});
    fetch("/api/universities").then((response) => response.json()).then((data) => setUniversities(data.universities || [])).catch(() => {});
    fetch(`/api/registration-form?courseId=${courseId}`).then((response) => response.json()).then((data) => { if (data.schema) setFormSchema(data.schema); }).catch(() => {});
    return () => {
      document.body.style.overflow = "";
    };
  }, []);
  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function validateStep() {
    const configuredStep = formSchema.steps[step - 1];
    const missingCustom = configuredStep?.fields.filter((field) => !field.system && field.required).some((field) => field.type === "file" ? !customFiles[field.key] : !customResponses[field.key]?.trim());
    if (missingCustom) { toast.error("لطفاً تمام فیلدهای الزامی این مرحله را تکمیل کنید"); return false; }
    const fields =
      step === 1
        ? [
            "fullName",
            "email",
            "phone",
            "nationalCode",
            "birthDate",
            "gender",
            "province",
            "city",
            ...(isTehran ? ["district", "neighborhood"] : []),
            "address",
          ]
        : step === 2
          ? ["educationLevel", "educationField", "university", "universityField", "workHistory", "artHistory"]
          : ["reason", "instagramId", "virtualPhone"];
    const missing = fields.some(
      (key) => !String(form[key as keyof FormData]).trim(),
    );
    if (missing) {
      toast.error("لطفاً تمام فیلدهای الزامی این مرحله را تکمیل کنید");
      return false;
    }
    if (step === 1 && !isValidIranianMobile(form.phone)) {
      toast.error("شماره تلفن همراه واردشده معتبر نیست");
      return false;
    }
    if (step === 1 && !isValidIranianNationalCode(form.nationalCode)) {
      toast.error("کد ملی واردشده معتبر نیست");
      return false;
    }
    if (
      step === 3 &&
      form.knowsInstructors &&
      !form.familiarityDetails.trim()
    ) {
      toast.error("محل آشنایی با اساتید را بنویسید");
      return false;
    }
    if (step === 3 && discountGroup && !discountDocument) {
      toast.error("بارگذاری مدرک عضویت برای گروه انتخاب‌شده الزامی است");
      return false;
    }
    return true;
  }
  async function submit() {
    if (!validateStep()) return;
    setSaving(true);
    try {
      const response = await fetch("/api/course-applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${getCookie("token") || ""}`,
        },
        body: JSON.stringify({ ...form, courseId, discountGroup, customResponses }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "خطا در ارسال فرم");
      if (discountDocument) {
        const document = new FormData();
        document.append("file", discountDocument);
        const uploadResponse = await fetch(
          `/api/course-applications/${data.application.id}/discount-document`,
          {
            method: "POST",
            headers: { authorization: `Bearer ${getCookie("token") || ""}` },
            body: document,
          },
        );
        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok)
          throw new Error(uploadData.error || "بارگذاری مدرک انجام نشد");
      }
      for (const [key, file] of Object.entries(customFiles)) {
        if (!file) continue;
        const document = new FormData(); document.append("file", file); document.append("key", key);
        const uploadResponse = await fetch(`/api/course-applications/${data.application.id}/custom-document`, { method: "POST", headers: { authorization: `Bearer ${getCookie("token") || ""}` }, body: document });
        const uploadData = await uploadResponse.json(); if (!uploadResponse.ok) throw new Error(uploadData.error || "بارگذاری فایل انجام نشد");
      }
      onSuccess({
        applicationId: data.application.id,
        profileUpdated: Boolean(data.profileUpdated),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطا در ارسال فرم");
    } finally {
      setSaving(false);
    }
  }
  const inputClass =
    "mt-1.5 w-full px-4 py-3 rounded-xl border border-surface-variant bg-white text-sm outline-none focus:ring-2 focus:ring-secondary-fixed";
  const customFields = formSchema.steps[step - 1]?.fields.filter((field) => !field.system) || [];
  const renderCustomFields = () => customFields.length ? <div className="mt-5 grid gap-4 border-t border-surface-variant pt-5 md:grid-cols-2">{customFields.map((field) => <label key={field.key} className={`text-sm font-bold text-primary ${field.type === "textarea" ? "md:col-span-2" : ""}`}>{field.label}{field.required ? " *" : ""}{field.type === "textarea" ? <textarea rows={4} value={customResponses[field.key] || ""} onChange={(event) => setCustomResponses((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} className={inputClass} /> : field.type === "select" || field.type === "radio" ? <select value={customResponses[field.key] || ""} onChange={(event) => setCustomResponses((current) => ({ ...current, [field.key]: event.target.value }))} className={inputClass}><option value="">انتخاب کنید</option>{(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}</select> : field.type === "date" ? <div className="mt-1.5"><PersianDateTimePicker value={customResponses[field.key] || ""} onChange={(value) => setCustomResponses((current) => ({ ...current, [field.key]: value }))} required={field.required} withTime={false} /></div> : field.type === "file" ? <span className="mt-1.5 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-secondary/60 bg-white px-3 py-3 text-xs text-secondary">{customFiles[field.key]?.name || "انتخاب تصویر یا PDF"}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0] || null; if (file && (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) || file.size > 5 * 1024 * 1024)) { toast.error("فقط تصویر یا PDF تا ۵ مگابایت مجاز است"); event.target.value = ""; return; } setCustomFiles((current) => ({ ...current, [field.key]: file })); }} /></span> : <input type={field.type === "text" ? "text" : "text"} value={customResponses[field.key] || ""} onChange={(event) => setCustomResponses((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} className={inputClass} />}</label>)}</div> : null;
  return (
    <div
      className="fixed inset-0 z-[100] bg-primary/75 backdrop-blur-lg p-3 md:p-6 overflow-y-auto"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div className="max-w-3xl mx-auto bg-[#fbf8ff] rounded-[2rem] overflow-hidden shadow-2xl animate-fade-in-up">
        <div className="bg-primary text-white p-6 flex justify-between gap-4">
          <div>
            <p className="text-xs text-secondary-fixed font-bold">
              فرم درخواست ثبت‌نام
            </p>
            <h2 className="font-black text-xl mt-1">{courseTitle}</h2>
          </div>
          <button onClick={onClose} disabled={saving}>
            <X size={21} />
          </button>
        </div>
        {!profileComplete && <div className="px-6 md:px-8 pt-6">
          <div className="flex items-center gap-2">
            {formSchema.steps.map((item, index) => { const number = index + 1; return (
              <div key={number} className="flex-1">
                <div
                  className={`h-1.5 rounded-full ${number <= step ? "bg-secondary" : "bg-surface-variant"}`}
                />
                <p
                  className={`text-[10px] mt-1 ${number === step ? "text-primary font-bold" : "text-outline"}`}
                >
                  {item.title}
                </p>
              </div>
            ); })}
          </div>
        </div>}
        <div className="p-6 md:p-8">
          {loading ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : (
            <>
              {profileComplete && step === 3 && <div className="mb-5 rounded-xl bg-secondary-fixed/30 p-3 text-xs leading-6 text-secondary">اطلاعات شخصی و تحصیلی شما از پروفایل قبلی استفاده می‌شود و نیازی به تکمیل دوباره آن‌ها نیست.</div>}
                {step === 1 && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 rounded-xl bg-secondary-fixed/30 text-secondary p-3 text-xs leading-6">
                    نام، ایمیل و موبایل از حساب شما دریافت شده‌اند. اگر آن‌ها را
                    تغییر دهید، پروفایل حساب کاربری نیز بروزرسانی خواهد شد.
                  </div>
                  {[
                    {
                      key: "fullName",
                      label: "نام و نام خانوادگی *",
                      type: "text",
                    },
                    { key: "email", label: "ایمیل *", type: "email" },
                    { key: "postalCode", label: "کد پستی", type: "text" },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="text-sm font-bold text-primary"
                    >
                      {item.label}
                      <input
                        type={item.type}
                        value={String(form[item.key as keyof FormData])}
                        onChange={(event) =>
                          update(
                            item.key as keyof FormData,
                            event.target.value as never,
                          )
                        }
                        className={inputClass}
                      />
                    </label>
                  ))}
                  <label className="text-sm font-bold text-primary">
                    شماره تلفن همراه *
                    <input
                      inputMode="tel"
                      value={form.phone}
                      onChange={(event) =>
                        update(
                          "phone",
                          normalizeIranianMobile(event.target.value),
                        )
                      }
                      placeholder="۰۹۱۲۱۲۳۴۵۶۷"
                      className={`${inputClass} ${form.phone.length === 11 ? (isValidIranianMobile(form.phone) ? "border-green-500 focus:ring-green-200" : "border-error focus:ring-error-container") : ""}`}
                      dir="ltr"
                      maxLength={11}
                    />
                    <span
                      className={`mt-1 block text-[11px] font-normal ${form.phone.length === 11 ? (isValidIranianMobile(form.phone) ? "text-green-700" : "text-error") : "text-outline"}`}
                    >
                      {form.phone.length < 11
                        ? `${form.phone.length.toLocaleString("fa-IR")} از ۱۱ رقم وارد شده`
                        : isValidIranianMobile(form.phone)
                          ? `شماره معتبر است · ${getIranianMobileOperator(form.phone)}`
                          : "شماره موبایل معتبر نیست"}
                    </span>
                  </label>
                  <IranLocationFields
                    province={form.province}
                    city={form.city}
                    onChange={({ province, city }) =>
                      setForm((current) => ({ ...current, province, city, district: province === "تهران" && city === "تهران" ? current.district : "", neighborhood: province === "تهران" && city === "تهران" ? current.neighborhood : "" }))
                    }
                  />
                  {isTehran && <><label className="text-sm font-bold text-primary">منطقه محل سکونت *<select value={form.district} onChange={(event) => setForm((current) => ({ ...current, district: event.target.value, neighborhood: "" }))} className={inputClass}><option value="">انتخاب منطقه</option>{Object.keys(tehranDistricts).map((district) => <option key={district} value={district}>{district}</option>)}</select></label><label className="text-sm font-bold text-primary">محله محل سکونت *<select value={form.neighborhood} disabled={!form.district} onChange={(event) => update("neighborhood", event.target.value)} className={`${inputClass} disabled:cursor-not-allowed disabled:bg-surface-low`}><option value="">{form.district ? "انتخاب محله" : "ابتدا منطقه را انتخاب کنید"}</option>{(tehranDistricts[form.district] || []).map((neighborhood) => <option key={neighborhood} value={neighborhood}>{neighborhood}</option>)}</select></label></>}
                  <label className="text-sm font-bold text-primary">
                    کد ملی *
                    <input
                      inputMode="numeric"
                      value={form.nationalCode}
                      onChange={(event) =>
                        update(
                          "nationalCode",
                          normalizeIranianNationalCode(event.target.value),
                        )
                      }
                      placeholder="۱۰ رقم"
                      className={`${inputClass} ${form.nationalCode.length === 10 ? (isValidIranianNationalCode(form.nationalCode) ? "border-green-500 focus:ring-green-200" : "border-error focus:ring-error-container") : ""}`}
                      dir="ltr"
                      maxLength={10}
                    />
                    <span
                      className={`mt-1 block text-[11px] font-normal ${form.nationalCode.length === 10 ? (isValidIranianNationalCode(form.nationalCode) ? "text-green-700" : "text-error") : "text-outline"}`}
                    >
                      {form.nationalCode.length === 10
                        ? isValidIranianNationalCode(form.nationalCode)
                          ? "کد ملی معتبر است."
                          : "کد ملی معتبر نیست."
                        : `${form.nationalCode.length.toLocaleString("fa-IR")} از ۱۰ رقم وارد شده`}
                    </span>
                  </label>
                  <label className="text-sm font-bold text-primary">
                    تاریخ تولد *
                    <div className="mt-1.5">
                      <PersianDateTimePicker
                        value={form.birthDate}
                        onChange={(value) => update("birthDate", value)}
                        required
                        withTime={false}
                      />
                    </div>
                  </label>
                  <label className="text-sm font-bold text-primary">جنسیت *<div className="mt-1.5 grid grid-cols-2 gap-2"><button type="button" onClick={() => update("gender", "male")} className={`rounded-xl border px-3 py-3 text-sm font-bold ${form.gender === "male" ? "border-primary bg-primary text-white" : "border-surface-variant bg-white text-outline"}`}>مرد</button><button type="button" onClick={() => update("gender", "female")} className={`rounded-xl border px-3 py-3 text-sm font-bold ${form.gender === "female" ? "border-primary bg-primary text-white" : "border-surface-variant bg-white text-outline"}`}>زن</button></div></label>
                  <label className="md:col-span-2 text-sm font-bold text-primary">
                    آدرس محل سکونت *
                    <textarea
                      rows={3}
                      value={form.address}
                      onChange={(event) =>
                        update("address", event.target.value)
                      }
                      className={inputClass}
                    />
                  </label>
                  </div>
                )}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <label className="text-sm font-bold text-primary">
                      مقطع تحصیلی *
                      <input
                        value={form.educationLevel}
                        onChange={(event) =>
                          update("educationLevel", event.target.value)
                        }
                        placeholder="مثال: کارشناسی"
                        className={inputClass}
                      />
                    </label>
                    <label className="text-sm font-bold text-primary">
                      رشته دبیرستان یا هنرستان *
                      <input
                        value={form.educationField}
                        onChange={(event) =>
                          update("educationField", event.target.value)
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className="relative text-sm font-bold text-primary">دانشگاه *<input value={showUniversities ? universitySearch : form.university} onFocus={() => { setUniversitySearch(""); setShowUniversities(true); }} onChange={(event) => { setUniversitySearch(event.target.value); setShowUniversities(true); }} placeholder="جستجو و انتخاب دانشگاه" className={inputClass} />{showUniversities && <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-surface-variant bg-white p-1 shadow-lg">{universities.filter((name) => name.includes(universitySearch)).slice(0, 80).map((name) => <button type="button" key={name} onClick={() => { update("university", name); setShowUniversities(false); }} className="block w-full rounded-lg px-3 py-2 text-right text-sm hover:bg-surface-low">{name}</button>)}{universities.filter((name) => name.includes(universitySearch)).length === 0 && <p className="p-3 text-center text-xs text-outline">دانشگاهی پیدا نشد</p>}</div>}</label>
                    <label className="text-sm font-bold text-primary">رشته دانشگاهی *<input value={form.universityField} onChange={(event) => update("universityField", event.target.value)} placeholder="مثال: ارتباط تصویری" className={inputClass} /></label>
                  </div>
                  <label className="block text-sm font-bold text-primary">
                    سوابق کاری *
                    <textarea
                      rows={4}
                      value={form.workHistory}
                      onChange={(event) =>
                        update("workHistory", event.target.value)
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="block text-sm font-bold text-primary">
                    سوابق هنری، فرهنگی و رسانه‌ای *
                    <textarea
                      rows={4}
                      value={form.artHistory}
                      onChange={(event) =>
                        update("artHistory", event.target.value)
                      }
                      className={inputClass}
                    />
                  </label>
                </div>
              )}
                {step === 3 && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-surface-variant bg-white p-4">
                    <label className="block text-sm font-bold text-primary">
                      عضو کدام گروه هستید؟
                      <select
                        value={discountGroup}
                        onChange={(event) => {
                          setDiscountGroup(event.target.value);
                          setDiscountDocument(null);
                        }}
                        className={inputClass}
                      >
                        <option value="">عضو هیچ‌کدام نیستم</option>
                        {discountGroups.map((label) => (
                          <option key={label} value={label}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {discountGroup && (
                      <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-secondary/60 bg-[#fffaf0] px-4 py-4 text-sm font-bold text-primary">
                        {discountDocument
                          ? discountDocument.name
                          : "بارگذاری مدرک عضویت *"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0] || null;
                            if (!file) return setDiscountDocument(null);
                            if (
                              ![
                                "image/jpeg",
                                "image/png",
                                "image/webp",
                              ].includes(file.type) ||
                              file.size > 5 * 1024 * 1024
                            ) {
                              event.target.value = "";
                              toast.error(
                                "فقط تصویر JPG، PNG یا WebP تا ۵ مگابایت مجاز است",
                              );
                              return;
                            }
                            setDiscountDocument(file);
                          }}
                        />
                      </label>
                    )}
                  </div>
                  <label className="block text-sm font-bold text-primary">
                    دلیل انتخاب این دوره *
                    <textarea
                      rows={4}
                      value={form.reason}
                      onChange={(event) => update("reason", event.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <div className="rounded-xl border border-surface-variant bg-white p-4">
                    <p className="text-sm font-bold text-primary">
                      آیا از قبل با اساتید این دوره آشنایی دارید؟
                    </p>
                    <div className="flex gap-5 mt-3">
                      <label className="flex gap-2 text-sm">
                        <input
                          type="radio"
                          checked={form.knowsInstructors}
                          onChange={() => update("knowsInstructors", true)}
                        />
                        بله
                      </label>
                      <label className="flex gap-2 text-sm">
                        <input
                          type="radio"
                          checked={!form.knowsInstructors}
                          onChange={() => {
                            update("knowsInstructors", false);
                            update("familiarityDetails", "");
                          }}
                        />
                        خیر
                      </label>
                    </div>
                    {form.knowsInstructors && (
                      <label className="block text-sm font-bold text-primary mt-4">
                        کجا با ایشان آشنا شده‌اید؟ *
                        <input
                          value={form.familiarityDetails}
                          onChange={(event) =>
                            update("familiarityDetails", event.target.value)
                          }
                          className={inputClass}
                        />
                      </label>
                    )}
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <label className="text-sm font-bold text-primary">
                      آیدی اینستاگرام *
                      <input
                        value={form.instagramId}
                        onChange={(event) =>
                          update("instagramId", event.target.value)
                        }
                        className={inputClass}
                        dir="ltr"
                      />
                    </label>
                    <label className="text-sm font-bold text-primary">
                      شماره فعال در فضای مجازی *
                      <input
                        value={form.virtualPhone}
                        onChange={(event) =>
                          update("virtualPhone", event.target.value)
                        }
                        className={inputClass}
                        dir="ltr"
                      />
                    </label>
                    <label className="text-sm font-bold text-primary">
                      شماره تلفن ثابت
                      <input
                        value={form.landline}
                        onChange={(event) =>
                          update("landline", event.target.value)
                        }
                        className={inputClass}
                        dir="ltr"
                      />
                    </label>
                  </div>
                  </div>
                )}
                {renderCustomFields()}
              <div className="flex justify-between gap-3 mt-7 pt-5 border-t border-surface-variant">
                <button
                  type="button"
                  onClick={() => profileComplete || step === 1 ? onClose() : setStep((current) => current - 1)}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-surface-variant text-sm text-outline"
                >
                  <ArrowRight size={16} />
                  {profileComplete || step === 1 ? "انصراف" : "مرحله قبل"}
                </button>
                {step < formSchema.steps.length ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (validateStep()) setStep((current) => current + 1);
                    }}
                    className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold"
                  >
                    ادامه
                    <ArrowLeft size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={saving}
                    className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    ارسال درخواست
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
