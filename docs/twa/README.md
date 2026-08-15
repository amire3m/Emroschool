# ساخت APK (Trusted Web Activity)

این صفحه مراحل ساخت اپلیکیشن اندروید (TWA) را از روی سایت توضیح می‌دهد. خروجی نهایی یک APK
امضا‌شده است که در `public/apk` قرار می‌گیرد و از صفحه `/download` در دسترس کاربران است.

## پیش‌نیازها (یک‌بار)

1. **JDK 17** — از [Adoptium Temurin](https://adoptium.net/temurin/releases/?version=17)
   نصب کنید و مطمئن شوید `java` و `keytool` در `PATH` هستند:
   ```powershell
   java -version
   keytool
   ```
2. **Android command-line tools** — از
   [developer.android.com](https://developer.android.com/studio#command-line-tools-only)
   دانلود و اکسترکت کنید، سپس `sdkmanager` را نصب و `platform-tools` را بپذیرید:
   ```powershell
   & <path-to-cmdline-tools>\bin\sdkmanager.bat "platform-tools" "platforms;android-34"
   ```
   `sdkmanager` هنگام ساخت، بقیه قطعات لازم را خودش نصب می‌کند.
3. **Bubblewrap CLI** — نسخه‌ای از CLI (جهانی یا موقت):
   ```powershell
   npm i -g @bubblewrap/cli
   ```

## متغیرهای محیطی

| متغیر | پیش‌فرض | توضیح |
| --- | --- | --- |
| `ANDROID_KEYSTORE_PATH` | `android\emroschool-release.keystore` | مسیر keystore (اگر نبود ساخته می‌شود) |
| `ANDROID_KEYSTORE_ALIAS` | `emroschool` | نام کلید |
| `ANDROID_KEYSTORE_PASSWORD` | `emroschool` | رمز keystore (در تولید حتماً عوض کنید) |
| `ANDROID_KEY_PASSWORD` | همان رمز keystore | رمز خود کلید |
| `ANDROID_PACKAGE_NAME` | `com.imamruhollahschool.app` | شناسه بسته اندروید |
| `ANDROID_SHA256_FINGERPRINT` | (خالی) | اثر انگشت امضای keystore برای assetlinks |

## ساخت

```powershell
# 1) کیتورها را بسازید (فقط بار اول)
keytool -genkeypair -v -keystore android\emroschool-release.keystore -alias emroschool `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -storepass emroschool -keypass emroschool -dname "CN=Emroschool, OU=App, O=Emroschool, L=Tehran, C=IR"

# 2) کل فرایند (init + build + کپی به public/apk)
.\scripts\build-apk.ps1
```

اسکریپت `build-apk.ps1`:
- پیش‌نیازها (`java`, `keytool`, `node`, `npx`) را بررسی می‌کند؛
- اگر keystore نبود، با `keytool` می‌سازد؛
- پروژه bubblewrap را در `android/` می‌سازد (`bubblewrap init`);
- خروجی را با `bubblewrap build` می‌سازد (اگر رمز بخواهد، از `ANDROID_KEYSTORE_PASSWORD`/`ANDROID_KEY_PASSWORD` می‌خواند)؛
- APK امضاشده را با نسخه `package.json` به `public/apk/app-vX.Y.Z.apk` کپی می‌کند؛
- اثر انگشت SHA-256 را چاپ می‌کند تا در `ANDROID_SHA256_FINGERPRINT` بگذارید.

نکته: `bubblewrap build` گاهی برای صحت PWA از شبکه استفاده می‌کند؛ اگر میزبان به اینترنت
دسترسی نداشت یا خطای PWA داد، می‌توانید به‌جای آن از:
```powershell
npx @bubblewrap/cli build --skipPwaValidation --directory android
```
استفاده کنید.

## انتشار

1. APK تولیدشده در `public/apk/app-vX.Y.Z.apk` را به سرور دپلوی کنید (همان‌جا که `public/` سایت است).
2. در `.env` سرور (VPS) مقدار دهید:
   ```
   ANDROID_PACKAGE_NAME=com.imamruhollahschool.app
   ANDROID_SHA256_FINGERPRINT=AB:CD:...
   ```
3. سایت را با `deploy-safe.sh` دپلوی کنید و تأیید کنید:
   - `https://imamruhollahschool.com/.well-known/assetlinks.json` مقدار `sha256_cert_fingerprints` را برگرداند؛
   - `https://imamruhollahschool.com/download` لینک دانلود را نشان دهد.
4. دستور تأیید اتصال تلفن/وب (اختیاری):
   ```
   adb shell am start -a android.intent.action.VIEW -d https://imamruhollahschool.com/
   ```

## به‌روزرسانی نسخه

نسخه در `package.json` (فیلد `version`) و `twa-manifest.json` (`appVersionName`/`appVersionCode`)
هماهنگ کنید، سپس دوباره `build-apk.ps1` را اجرا کنید. APK جدید با همان keystore امضا می‌شود تا
آپدیت کاربران قبلی بدون حذف نصب ممکن باشد.
