# اعلان‌های Web Push — راه‌اندازی Firebase

برای اینکه اعلان در مرورگر/اپلیکیشن (کروم و اندروید) کار کند، باید یک پروژه رایگان Firebase
بسازید و کلیدهای VAPID آن را در `.env` سرور بگذارید.

## چرا Firebase؟

Web Push استاندارد از طریق سرویس مرورگر تحویل می‌شود. در کروم/اندروید این سرویس متعلق به
Google (FCM) است و برای گرفتن `applicationServerKey` به یک پروژه Firebase نیاز دارید.

## مراحل

1. به [console.firebase.google.com](https://console.firebase.google.com) بروید و با یک حساب
   گوگل وارد شوید.
2. «Create a project» → نام دلخواه (مثلاً `emroschool-push`) → ادامه → project ساخته می‌شود
   (نیازی به Google Analytics نیست، می‌توانید غیرفعال کنید).
3. از منوی چپ: **Cloud Messaging** را باز کنید (در Firebase فقط یک گزینه «Messaging» هست).
4. در بالای صفحه، زبانه **Web Push certificates** را انتخاب کنید.
5. روی **Generate key pair** بزنید. یک `public key` (و کلید خصوصی که Firebase برای شما
   می‌گذارد) نمایش داده می‌شود.
   - اگر فقط public key را می‌بینید، کافی است همان را در `VAPID_PUBLIC_KEY` بگذارید؛
   - می‌توانید به‌جای آن از یک جفت کلید دلخواه هم استفاده کنید:
     ```powershell
     npx web-push generate-vapid-keys
     ```
     و سپس public key را در Firebase ثبت کنید (Web Push certificates → Text input).
6. کلیدها را در `.env` سرور (VPS) قرار دهید:
   ```
   VAPID_PUBLIC_KEY=BA....
   VAPID_PRIVATE_KEY=.....
   VAPID_SUBJECT=mailto:no-reply@imamruhollahschool.com
   ```
   - `VAPID_SUBJECT` باید یک `mailto:` یا `https://` معتبر باشد (مرورگرها با نبود آن خطا می‌دهند).

## رفتار بدون Firebase

اگر `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` تنظیم نشده باشند:
- `/api/push/config` مقدار `{"publicKey":null}` برمی‌گرداند؛
- دکمه اعلان در سایت نمایش داده نمی‌شود؛
- بقیه سایت بدون هیچ خطایی کار می‌کند.

پس دپلوی پیش از ساخت Firebase بی‌خطر است؛ بعد از تنظیم کلیدها فقط کافی است دوباره دپلوی کنید.

## تأیید

پس از دپلوی:
```powershell
# باید یک کلید عمومی (نه null) برگردد
curl https://imamruhollahschool.com/api/push/config
```
سپس در مرورگر کروم وارد سایت شوید، وارد حساب شوید و دکمه «دریافت اعلان» را فعال کنید.
برای تست واقعی ارسال، از پنل ادمین یک اطلاع‌رسانی بفرستید یا یک درخواست ثبت‌نام جدید ثبت کنید.
