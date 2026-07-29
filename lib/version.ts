export const APP_VERSION = "2.0.0";

export interface ReleaseNote {
  id: string;
  title: string;
  summary: string;
  publishedAt: string;
  version?: string;
  type: "release" | "feature" | "improvement" | "fix";
}

const unsortedReleaseNotes: ReleaseNote[] = [
  {
    id: "animated-header-search",
    title: "جستجوی متحرک بالای سایت",
    summary: "نوار جستجوی هدر با بازشدن نرم، هاله متحرک و پیشنهادهای چرخشی بازطراحی شد و جستجو مستقیماً نتایج دوره‌ها را فیلتر می‌کند.",
    publishedAt: "2026-07-30T02:33:50+03:30",
    type: "feature",
  },
  {
    id: "safe-file-renaming-and-header-logo",
    title: "تغییر نام امن فایل‌ها و لوگوی جدید هدر",
    summary: "تغییر نام انگلیسی فایل با بروزرسانی خودکار لینک‌های قبلی اضافه شد و لوگوی بالای سایت با نسخه اصلی و بدون قاب دایره‌ای جایگزین شد.",
    publishedAt: "2026-07-30T02:22:51+03:30",
    type: "feature",
  },
  {
    id: "upload-errors-and-formats",
    title: "خطاهای دقیق‌تر و فرمت‌های بیشتر آپلود",
    summary: "پیام خطاهای حجم، دسترسی و پاسخ سرور شفاف شد و فرمت‌های MKV، AVI، AAC، CSV و 7Z به فایل‌منیجر اضافه شدند.",
    publishedAt: "2026-07-30T02:09:41+03:30",
    type: "fix",
  },
  {
    id: "file-upload-progress",
    title: "نمایش پیشرفت آپلود فایل‌ها",
    summary: "فایل‌منیجر اکنون درصد واقعی، حجم ارسال‌شده و وضعیت جداگانه هر فایل را هنگام آپلود نمایش می‌دهد.",
    publishedAt: "2026-07-30T02:04:02+03:30",
    type: "improvement",
  },
  {
    id: "admin-navigation-groups",
    title: "گروه‌بندی منوی مدیریت",
    summary: "اساتید و هنرآموختگان زیرمجموعه کاربران و اسلایدر زیرمجموعه تنظیمات سایت قرار گرفتند تا ساختار پنل منسجم‌تر شود.",
    publishedAt: "2026-07-30T18:40:00+03:30",
    type: "improvement",
  },
  {
    id: "department-glow-readability",
    title: "بهبود خوانایی کارت‌های دپارتمان",
    summary: "Glow رنگی به پشت باکس‌ها منتقل شد و محتوای کارت روی زمینه سفید مات و خوانا قرار گرفت؛ رنگ‌ها نیز به طیف سرمه‌ای و طلایی محدود شدند.",
    publishedAt: "2026-07-30T18:30:00+03:30",
    type: "fix",
  },
  {
    id: "department-glow-effect",
    title: "افکت نورپردازی دپارتمان‌ها",
    summary: "نوار گرادینت کارت‌های دپارتمان حذف و با Glow متحرک سرمه‌ای و طلایی در تمام لبه‌های کارت جایگزین شد.",
    publishedAt: "2026-07-30T18:20:00+03:30",
    type: "improvement",
  },
  {
    id: "version-2",
    title: "ارتقای سامانه به نسخه ۲",
    summary: "نسخه دوم سامانه با مدیریت یکپارچه صفحه اصلی، کاربران، رسانه‌ها و تجربه کاربری بهبودیافته منتشر شد.",
    publishedAt: "2026-07-30T18:00:00+03:30",
    version: APP_VERSION,
    type: "release",
  },
  {
    id: "image-editor",
    title: "ادیتور سبک تصاویر",
    summary: "کراپ، زوم و چرخش تصویر متناسب با قاب هر بخش به ورودی‌های تصویری پنل افزوده شد.",
    publishedAt: "2026-07-30T17:50:00+03:30",
    type: "feature",
  },
  {
    id: "homepage-carousels",
    title: "بازطراحی اسلایدرهای صفحه اصلی",
    summary: "نمایش دپارتمان‌ها، اساتید، همراهان و گالری برای حرکت روان، لوپ کامل و استفاده بهتر از فضا بازطراحی شد.",
    publishedAt: "2026-07-30T17:40:00+03:30",
    type: "improvement",
  },
  {
    id: "file-manager",
    title: "مدیریت فایل‌های سامانه",
    summary: "فایل‌منیجر با نمایش فضای دیسک، پیش‌نمایش، جستجو، آپلود چندفایلی و حذف امن فایل‌ها اضافه شد.",
    publishedAt: "2026-07-30T16:30:00+03:30",
    type: "feature",
  },
  {
    id: "course-categories",
    title: "دسته‌بندی‌های جدید دوره‌ها",
    summary: "۱۴ دسته‌بندی اصلی با آیکون‌های هماهنگ تعریف و فرم دوره‌ها به دسته‌های واقعی دیتابیس متصل شد.",
    publishedAt: "2026-07-30T15:20:00+03:30",
    type: "improvement",
  },
  {
    id: "profiles-and-settings",
    title: "تنظیمات یکپارچه و پروفایل عمومی",
    summary: "ویرایش محتوای صفحه اصلی، حریم خصوصی هنرجویان و پروفایل‌های اختصاصی استاد و هنرآموخته تکمیل شد.",
    publishedAt: "2026-07-30T14:00:00+03:30",
    type: "feature",
  },
];

export const releaseNotes = unsortedReleaseNotes.sort(
  (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
);
