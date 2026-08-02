export type RegistrationFieldType = "text" | "textarea" | "select" | "radio" | "date" | "file";

export type RegistrationField = {
  key: string;
  label: string;
  type: RegistrationFieldType;
  required: boolean;
  options?: string[];
  placeholder?: string;
  system?: boolean;
  profileKey?: string;
};

export type RegistrationStep = {
  id: string;
  title: string;
  description?: string;
  locked?: boolean;
  fields: RegistrationField[];
};

export type RegistrationFormSchema = { version: 1; steps: RegistrationStep[] };

const system = (key: string, label: string, type: RegistrationFieldType = "text", required = true, options?: string[]): RegistrationField => ({ key, label, type, required, options, system: true, profileKey: key });

export const defaultRegistrationForm: RegistrationFormSchema = {
  version: 1,
  steps: [
    { id: "identity", title: "اطلاعات فردی و محل سکونت", description: "اطلاعات هویتی و تماس", locked: true, fields: [
      system("fullName", "نام و نام خانوادگی"), system("email", "ایمیل"), system("phone", "شماره تلفن همراه"), system("nationalCode", "کد ملی"), system("birthDate", "تاریخ تولد", "date"), system("gender", "جنسیت", "radio", true, ["male", "female"]), system("province", "استان"), system("city", "شهر"), system("district", "منطقه محل سکونت", "text", false), system("neighborhood", "محله محل سکونت", "text", false), system("address", "آدرس محل سکونت", "textarea"), system("postalCode", "کد پستی", "text", false),
    ] },
    { id: "education", title: "تحصیلات و سوابق", description: "سوابق تحصیلی و حرفه‌ای", fields: [
      system("educationLevel", "مقطع تحصیلی"), system("educationField", "رشته دبیرستان یا هنرستان"), system("university", "دانشگاه"), system("universityField", "رشته دانشگاهی"), system("workHistory", "سوابق کاری", "textarea"), system("artHistory", "سوابق هنری، فرهنگی و رسانه‌ای", "textarea"),
    ] },
    { id: "application", title: "اطلاعات تکمیلی", description: "انگیزه و راه‌های ارتباطی", fields: [
      system("reason", "دلیل انتخاب این دوره", "textarea"), system("knowsInstructors", "آشنایی قبلی با اساتید", "radio", true, ["yes", "no"]), system("familiarityDetails", "محل آشنایی با اساتید", "text", false), system("instagramId", "آیدی اینستاگرام"), system("virtualPhone", "شماره فعال در فضای مجازی"), system("landline", "شماره تلفن ثابت", "text", false),
    ] },
  ],
};

export function parseRegistrationForm(value?: string | null): RegistrationFormSchema {
  if (!value) return structuredClone(defaultRegistrationForm);
  try {
    const parsed = JSON.parse(value) as RegistrationFormSchema;
    if (parsed?.version === 1 && Array.isArray(parsed.steps) && parsed.steps.length) return parsed;
  } catch {}
  return structuredClone(defaultRegistrationForm);
}

export function validateRegistrationForm(schema: unknown): schema is RegistrationFormSchema {
  if (!schema || typeof schema !== "object") return false;
  const form = schema as RegistrationFormSchema;
  if (form.version !== 1 || !Array.isArray(form.steps) || !form.steps.length) return false;
  if (form.steps[0]?.id !== "identity" || !form.steps[0]?.locked) return false;
  const keys = new Set<string>();
  const valid = form.steps.every((step) => typeof step.id === "string" && typeof step.title === "string" && Array.isArray(step.fields) && step.fields.every((field) => {
    if (!field || typeof field.key !== "string" || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.key) || keys.has(field.key) || typeof field.label !== "string" || !field.label.trim() || !["text", "textarea", "select", "radio", "date", "file"].includes(field.type) || typeof field.required !== "boolean") return false;
    keys.add(field.key);
    return !field.system || defaultRegistrationForm.steps.flatMap((item) => item.fields).some((item) => item.key === field.key);
  }));
  if (!valid) return false;
  const configuredSystemKeys = new Set(form.steps.flatMap((step) => step.fields).filter((field) => field.system).map((field) => field.key));
  return defaultRegistrationForm.steps.flatMap((step) => step.fields).filter((field) => field.system).every((field) => configuredSystemKeys.has(field.key));
}

export function mergeRegistrationForm(globalSchema: RegistrationFormSchema, override?: string | null) {
  return override ? parseRegistrationForm(override) : globalSchema;
}
