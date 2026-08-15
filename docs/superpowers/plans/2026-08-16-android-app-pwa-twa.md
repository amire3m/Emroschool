# پلن پیادهسازی: اپلیکیشن اندروید (PWA + TWA + Push)

مرجع طراحی: `docs/superpowers/specs/2026-08-16-android-app-pwa-twa-design.md`

## فازها

### فاز ۱ — پایه PWA
- وابستگیها: `@serwist/next`، `@serwist/sw`، `web-push` + `@types/web-push`، `sharp` (devDep).
- `app/manifest.ts` — manifest فارسی (RTL، standalone، آیکن از `public/icons/`).
- اسکریپت `scripts/generate-icons.mjs` — تولید PNG (192/512/maskable) از لوگوی موجود (sharp).
- `app/sw.ts` — سرویسورکر serwist (پیشکش پوسته + کش runtime صفحات/چانکها)؛ رجیستر در root layout.
- پیکربندی `@serwist/next` در `next.config.js`.
- تأیید: `tsc --noEmit`، `next build`، سرو شدن `/manifest.webmanifest` و `/sw.js`.

### فاز ۲ — Push
- مدل `PushSubscription` در Prisma + relation با User + `prisma db push` محلی.
- `lib/push.ts` — setup از env (VAPID)، `sendPushToUsers` (با تزریق وابستگی برای تست)، payload، حذف اشتراک منقضی، اعتبارسنجی ورودی.
- `app/api/push/register/route.ts` + `app/api/push/unregister/route.ts` — الگوی Bearer (lib/auth).
- `lib/push-client.ts` — subscribe/ارسال به سرور/مدیریت permission (کلاینت، بدون DOM-test).
- `components/push/PushManager.tsx` — کامپوننت کلاینت: درخواست permission، subscribe، رجیستر، unsubscribe.
- اتصال به رویدادها: `CourseApplication` و `PaymentOrder` (ادمینها) + release دوره (دانشجویان ثبتنامی).
- `.env.example` + `.env` محلی: `VAPID_*` و `APP_URL`.
- اگر VAPID نباشد: رفتار نرم (بدون subscribe، پیام مناسب) — دپلوی بیخطر قبل از ساخت Firebase.
- تست (node:test): payload، prune، اعتبارسنجی register، مدلهای آلوده.

### فاز ۳ — دانلود و assetlinks
- `app/.well-known/assetlinks.json/route.ts` — خواندن fingerprint از env با fallback.
- `app/(site)/download/page.tsx` — اگر فایل APK در `public/apk` موجود بود لینک دانلود، وگرنه «بهزودی».

### فاز ۴ — ساخت APK (TWA)
- مستندسازی مراحل (JDK 17 + Android cmdline tools) در `docs/twa/README.md`.
- `twa-manifest.json` + اسکریپت `scripts/build-apk.ps1` (keytool keystore، bubblewrap init/build، امضا).
- آیکن لانچر adaptive از همان آیکنهای تولیدشده.

### فاز ۵ — تأیید و دپلوی
- `tsc --noEmit` + کل سویت تست + `next build`.
- کامیت + پوش به origin (فقط فایلهای مرتبط).
- دپلوی VPS با deploy-safe.sh؛ `prisma db push` خودکار.
- افزودن `VAPID_*` به `.env` سرور (گام دستی کاربر بعد از ساخت Firebase).
- تأیید پس از دپلوی: manifest/sw/register API/دانلود صفحه.

## پیشنیاز دستی کاربر
- ساخت پروژه رایگان Firebase و ثبت کلیدهای VAPID (راهنمای `docs/push-firebase-setup.md`).
