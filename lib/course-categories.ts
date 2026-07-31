export const primaryCourseCategories = [
  { name: "دوره جامع", slug: "comprehensive-course", icon: "Layers3", description: "مجموعه‌های آموزشی چندمرحله‌ای و مسیرهای کامل یادگیری" },
  { name: "مستند", slug: "documentary", icon: "Film", description: "روایت واقعیت با نگاه خلاق و مستندسازانه" },
  { name: "برنامه تلویزیونی", slug: "tv-program", icon: "Tv", description: "طراحی، تولید و کارگردانی قالب‌های تلویزیونی" },
  { name: "داستانی", slug: "narrative", icon: "BookOpen", description: "روایت داستانی، فیلم کوتاه و سینمای داستان‌گو" },
  { name: "اجرا", slug: "performance", icon: "Users", description: "مهارت‌های اجرا، حضور مقابل دوربین و ارتباط با مخاطب" },
  { name: "گویندگی", slug: "voice-acting", icon: "Mic", description: "فن بیان، گویندگی و تربیت حرفه‌ای صدا" },
  { name: "انسان رسانه", slug: "human-media", icon: "User", description: "هویت رسانه‌ای، اثرگذاری فردی و ارتباطات نوین" },
  { name: "نویسندگی", slug: "writing", icon: "PenTool", description: "نویسندگی خلاق، فیلمنامه و تولید متن رسانه‌ای" },
  { name: "موشن", slug: "motion", icon: "PlayCircle", description: "موشن‌گرافیک و روایت تصویری متحرک" },
  { name: "هوش مصنوعی", slug: "artificial-intelligence", icon: "Cpu", description: "کاربرد هوش مصنوعی در هنر و تولید رسانه" },
  { name: "گرافیک", slug: "graphic-design", icon: "Palette", description: "طراحی گرافیک، هویت بصری و ارتباط تصویری" },
  { name: "تدوین", slug: "editing", icon: "Scissors", description: "تدوین خلاق و روایت حرفه‌ای تصویر" },
  { name: "عکاسی", slug: "photography", icon: "Camera", description: "عکاسی هنری، مستند و رسانه‌ای" },
  { name: "تصویربرداری", slug: "videography", icon: "Video", description: "اصول تصویربرداری، نور و حرکت دوربین" },
  { name: "صدابرداری", slug: "sound-recording", icon: "Headphones", description: "ضبط، کنترل و پردازش صدای حرفه‌ای" },
].map((category, index) => ({ ...category, order: index + 1 }));

export type PrimaryCourseCategory = (typeof primaryCourseCategories)[number];
