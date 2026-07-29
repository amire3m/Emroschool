export type HomeSectionValue = string | number;
export type HomeSectionContent = Record<string, HomeSectionValue>;

export interface HomeSectionDefinition {
  slug: string;
  label: string;
  icon: string;
  order: number;
  defaults: HomeSectionContent;
  fields: Array<{
    key: string;
    label: string;
    type?: "text" | "textarea" | "number" | "url";
  }>;
}

export const homeSectionDefinitions: HomeSectionDefinition[] = [
  {
    slug: "hero",
    label: "اسلایدر و هیرو",
    icon: "Sliders",
    order: 1,
    defaults: {
      badge: "هنر متعالی، رسانه انقلابی",
      title: "آموزش هنر و رسانه در تراز انقلاب اسلامی",
      description: "آکادمی امام روح‌الله (ره)، بستری برای شکوفایی استعدادهای مومن و هنرمند است. ما در این مسیر با بهره‌گیری از اساتید مبرز، تخصص و تعهد را در هم می‌آمیزیم.",
      primaryText: "مشاهده دوره‌ها",
      primaryUrl: "/courses",
      secondaryText: "مشاوره رایگان",
      secondaryUrl: "/#about",
      imageUrl: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=2000&auto=format&fit=crop",
    },
    fields: [
      { key: "badge", label: "برچسب بالای هیرو" },
      { key: "title", label: "عنوان اصلی" },
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "primaryText", label: "متن دکمه اصلی" },
      { key: "primaryUrl", label: "لینک دکمه اصلی", type: "url" },
      { key: "secondaryText", label: "متن دکمه دوم" },
      { key: "secondaryUrl", label: "لینک دکمه دوم", type: "url" },
      { key: "imageUrl", label: "آدرس تصویر پس‌زمینه", type: "url" },
    ],
  },
  {
    slug: "departments",
    label: "دپارتمان‌های تخصصی",
    icon: "Layout",
    order: 2,
    defaults: { title: "دپارتمان‌های تخصصی", description: "" },
    fields: [
      { key: "title", label: "عنوان" },
      { key: "description", label: "توضیحات", type: "textarea" },
    ],
  },
  {
    slug: "courses",
    label: "دوره‌های منتخب",
    icon: "BookOpen",
    order: 3,
    defaults: { title: "دوره‌های منتخب", description: "پرطرفدارترین آموزش‌های ماه اخیر", linkText: "مشاهده همه", limit: 4 },
    fields: [
      { key: "title", label: "عنوان" },
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "linkText", label: "متن لینک مشاهده همه" },
      { key: "limit", label: "تعداد دوره‌ها", type: "number" },
    ],
  },
  {
    slug: "instructors",
    label: "اساتید مدرسه",
    icon: "Users",
    order: 4,
    defaults: { title: "اساتید مدرسه", description: "پیشکسوتان و متخصصان تراز اول هنر انقلاب", linkText: "مشاهده همه", limit: 0 },
    fields: [
      { key: "title", label: "عنوان" },
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "linkText", label: "متن لینک مشاهده همه" },
      { key: "limit", label: "تعداد نمایش (صفر یعنی همه)", type: "number" },
    ],
  },
  {
    slug: "gallery",
    label: "گالری تصاویر",
    icon: "Camera",
    order: 5,
    defaults: { title: "گالری تصاویر", description: "نمایی از فعالیت‌های آکادمی هنر و رسانه امام روح‌الله (ره)" },
    fields: [
      { key: "title", label: "عنوان" },
      { key: "description", label: "توضیحات", type: "textarea" },
    ],
  },
  {
    slug: "partners",
    label: "همراهان",
    icon: "Users",
    order: 6,
    defaults: { title: "همراهان ما", description: "موسسات و سازمان‌های همکار با آکادمی هنر و رسانه امام روح‌الله (ره)" },
    fields: [
      { key: "title", label: "عنوان" },
      { key: "description", label: "توضیحات", type: "textarea" },
    ],
  },
  {
    slug: "cta",
    label: "دعوت به اقدام (CTA)",
    icon: "Megaphone",
    order: 7,
    defaults: {
      title: "به جامعه هنرمندان متعهد بپیوندید",
      description: "با عضویت در خبرنامه مدرسه، از جدیدترین دوره‌ها، رویدادها و تخفیف‌های ویژه باخبر شوید. گامی بلند در مسیر رشد هنری خود بردارید.",
      placeholder: "ایمیل شما...",
      buttonText: "عضویت",
    },
    fields: [
      { key: "title", label: "عنوان" },
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "placeholder", label: "متن داخل ورودی ایمیل" },
      { key: "buttonText", label: "متن دکمه" },
    ],
  },
];

export function getHomeSectionDefinition(slug: string) {
  return homeSectionDefinitions.find((section) => section.slug === slug);
}

export function parseHomeSectionContent(slug: string, content?: string | null): HomeSectionContent {
  const defaults = getHomeSectionDefinition(slug)?.defaults || {};
  if (!content) return { ...defaults };

  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { ...defaults, ...parsed };
    }
  } catch {
    // Keep legacy plain-text content inside the new JSON payload when it is next saved.
  }

  return { ...defaults, legacyContent: content };
}
