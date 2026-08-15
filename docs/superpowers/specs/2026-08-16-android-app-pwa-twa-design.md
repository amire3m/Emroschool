# طراحی: تبدیل سایت به اپلیکیشن اندروید (PWA + پوسته TWA)

تاریخ: 2026-08-16
وضعیت: تأییدشده توسط کاربر (رویکرد «الف»)

## ۱) خلاصه و معماری کلی

هیچ UI جدیدی ساخته نمیشود. اپ یک پوسته است که دقیقاً همان سایت زنده (امروزشگاه) را باز
میکند؛ دانشجو و ادمین هر دو داخل همین اپ هستند چون کل سیستم وب است. لایهها:

```
Next.js (PWA + Push + Download)  →  پوسته TWA (Bubblewrap)  →  APK  →  دانلود مستقیم از سایت
```

- دامنه تولید: `imamruhollahschool.com` (HTTPS)
- فریمورک: Next.js 14 (app router)، Prisma + SQLite، دپلوی VPS با PM2 + deploy-safe.sh

## ۲) PWA و آفلاین جزئی

- افزودن `@serwist/next` (نسخه نگهداریشدهی next-pwa مخصوص app router).
- `app/manifest.ts` (متادیتای Next) خروجی `manifest.webmanifest` را میسازد و آیکنها از
  `public/icons/` خوانده میشوند:
  - `name`/`short_name` فارسی، `lang: fa`، `dir: rtl`، `display: standalone`، `start_url: /`،
    `theme_color`/`background_color` متناسب با سایت.
- آیکنها از لوگوی سایت تولید میشوند (PNG 192×192، 512×512، maskable) با یک اسکریپت
  dev-dependency (sharp).
- Service Worker (serwist): پیشکش پوسته + کش runtime فایلهای استاتیک (چانکهای Next) و
  صفحات بازدیدشدهی دوره (stale-while-revalidate). آفلاین جزئی یعنی: پوسته و صفحات قبلاً
  بازدیدشده بدون اینترنت در دسترسند؛ فرمهای ثبتنام و پرداخت نیاز به آنلاین دارند.
- نتیجه جانبی: حتی بدون APK، سایت از مرورگر (کروم اندروید/دسکتاپ) قابل «نصب» میشود.

## ۳) اعلانهای Push

- فناوری: Web Push استاندارد (`pushManager.subscribe` با `applicationServerKey` VAPID) +
  بسته `web-push` در سرور. کلاینت سبک و بدون SDK سنگین Firebase.
- پیشنیاز خارجی: یک پروژه رایگان Firebase (فایر بیس) برای ثبت کلیدهای VAPID —
  چون کروم اندروید (و TWA) از سرویس FCM بهعنوان push service استفاده میکند.
  کلیدهای VAPID در `.env` (هم محلی و هم VPS) قرار میگیرند.
- مدل جدید در Prisma:

```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  endpoint  String   @unique
  keys      String   // JSON { p256dh, auth }
  userAgent String?
  createdAt DateTime @default(now())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}
```

- APIها:
  - `POST /api/push/register` (احراز هویت) — ذخیره/بهروزرسانی اشتراک.
  - `DELETE /api/push/unregister` — حذف اشتراک.
- `lib/push.ts`:
  - `sendPush(userIds, { title, body, url })` — ارسال به همه اشتراکهای فعال کاربر؛
    حذف خودکار اشتراکهای منقضی (خطای 404/410).
  - ساخت payload با `icon`/`badge` از آیکن PWA و `data.url` برای دیپلینک.
- اتصال به رویدادهای موجود (حداقلی و YAGNI):
  - ایجاد `CourseApplication` → اعلان به ادمینها (نقش admin/superadmin).
  - ایجاد/تغییر `PaymentOrder` → اعلان به ادمینها.
  - انتشار/انتشار مجدد دوره (رویدادهای release که هماکنون reconcile میشوند) → اعلان
    به دانشجویان ثبتنامی همان دوره.
  - بقیه رویدادها (UserNotification و ...) خارج از اسکوپ نسخه اول.
- کلیک روی اعلان → باز شدن اپ در مسیر مربوط (`/courses/[slug]`، `/admin/payments` و ...).

## ۴) APK اندروید (TWA)

- ساخت با `@bubblewrap/cli` (بدون اندروید استودیو؛ نیاز به JDK 17 + Android command-line
  tools روی دستگاه ساخت).
- پروژه TWA دامنه را تمامصفحه در کروم باز میکند؛ پوشش Push و آفلاین همان SW سایت است.
- `app/.well-known/assetlinks.json/route.ts` — سرو JSON اعتبارسنجی (sha256 امضای keystore)
  برای اتصال رسمی دامنه↔پکیج. برای توزیع مستقیم APK اجباری نیست ولی باعث تمامصفحه شدن است.
- آیکن لانچر: adaptive icon از لوگوی سایت (تولید با همان اسکریپت آیکن).
- امضا: keystore اختصاصی (keytool). خروجی `app-release.apk` امضاشده.
- اسکریپت ساخت `build:apk` (مراحل مستند؛ چون باینریها بزرگاند در گیت کامیت نمیشوند و
  APK بهصورت فایل روی سرور قرار میگیرد، نه در ریپو).
- صفحه «دانلود اپ» روی سایت: مسیر `/download` که اگر فایل APK روی سرور موجود بود
  (public/apk) لینک دانلود را نشان میدهد؛ وگرنه پیام «بهزودی».

## ۵) ابزار ساخت و دپلوی

- ساخت APK بهصورت محلی/ویندوز (JDK 17 + Android cmdline tools)؛ اسکریپت مستند.
  گزینه بعدی (اختیاری): GitHub Actions.
- دپلوی سایت: روال فعلی deploy-safe.sh — فایلهای جدید (روتهای وب، SW، manifest، schema)
  از طریق گیت میروند؛ `npx prisma db push` توسط deploy-safe انجام میشود.
- وردیهای جدید `.env`: `VAPID_PUBLIC_KEY`، `VAPID_PRIVATE_KEY`، `VAPID_SUBJECT`،
  `APP_URL=https://imamruhollahschool.com`.
- کرون و اسکریپتهای Bale دستنخورده میمانند.

## ۶) تست

- واحد (node:test مثل بقیه پروژه): اعتبارسنجی ورودی register، ساخت payload، حذف اشتراک
  منقضی.
- ساخت: `tsc --noEmit` + کل سویت تست موجود + `next build`.
- دستی: نصب PWA در کروم، دریافت push واقعی، ساخت APK و نصب روی گوشی اندروید، آفلاین جزئی.

## پیشنیازهای کاربر

1. ساخت پروژه رایگان Firebase و تولید/ثبت کلیدهای VAPID (راهنمای کامل هنگام پیادهسازی).
2. نصب JDK 17 + Android command-line tools برای ساخت APK (یا بعداً GitHub Actions).
