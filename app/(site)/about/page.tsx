import Link from "next/link";
import { ArrowLeft, Instagram, MapPin, MessageCircle, Phone } from "lucide-react";

const address = "تهران، کارگر جنوبی، نظری، بین دانشگاه و قدیری، پلاک 72";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-surface pt-24">
      <section className="relative overflow-hidden bg-primary text-white">
        <div className="absolute -left-24 -top-32 h-80 w-80 rounded-full border border-secondary-fixed/20" />
        <div className="absolute -bottom-48 right-1/3 h-96 w-96 rounded-full border border-secondary-fixed/10" />
        <div className="relative mx-auto grid max-w-[1280px] gap-12 px-5 py-20 md:grid-cols-[1.2fr_.8fr] md:items-center md:px-8 md:py-28">
          <div>
            <p className="mb-5 text-sm font-bold tracking-[.2em] text-secondary-fixed">درباره آکادمی</p>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.35] md:text-6xl">
              جایی برای پرورش هنر متعهد و رسانه اثرگذار
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-white/70 md:text-lg">
              آکادمی هنر و رسانه امام روح‌الله (ره)، نهادی تخصصی برای تربیت نیروی انسانی متعهد و متخصص در حوزه‌های مختلف هنری و رسانه‌ای است. ما به دنبال تلفیق هنر اصیل و تکنولوژی روز هستیم.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/courses" className="inline-flex items-center gap-2 rounded-xl bg-secondary-fixed px-5 py-3 font-bold text-primary transition hover:bg-white">
                کشف دوره‌ها <ArrowLeft size={17} />
              </Link>
              <Link href="#contact" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 font-bold text-white transition hover:border-secondary-fixed hover:text-secondary-fixed">
                ارتباط با ما
              </Link>
            </div>
          </div>
          <div className="relative mx-auto flex h-64 w-64 items-center justify-center rounded-[2rem] border border-secondary-fixed/30 bg-white/5 shadow-2xl shadow-black/20 md:h-80 md:w-80">
            <div className="absolute inset-5 rounded-[1.5rem] border border-white/10" />
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-secondary-fixed shadow-xl shadow-black/20">
              <span className="text-6xl font-black text-primary">ه</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1280px] gap-5 px-5 py-16 md:grid-cols-3 md:px-8">
        {[
          ["01", "یادگیری عمیق", "دوره‌هایی کاربردی با تمرکز بر مهارت، تجربه و ساختن اثر واقعی."],
          ["02", "هنر متعالی", "پایبندی به هویت ایرانی اسلامی و نگاه مسئولانه به نقش هنرمند."],
          ["03", "رسانه آینده", "پیوند خلاقیت، فناوری و روایت برای حضور مؤثر در جهان امروز."],
        ].map(([number, title, text]) => (
          <article key={number} className="rounded-3xl border border-outline-variant/40 bg-white p-7 shadow-sm">
            <span className="text-4xl font-black text-secondary-fixed">{number}</span>
            <h2 className="mt-5 text-xl font-black text-primary">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-outline">{text}</p>
          </article>
        ))}
      </section>

      <section id="contact" className="bg-surface-low py-16 md:py-24">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-5 md:grid-cols-[.8fr_1.2fr] md:px-8">
          <div>
            <p className="text-sm font-bold text-secondary">در تماس باشیم</p>
            <h2 className="mt-3 text-3xl font-black text-primary md:text-4xl">با آکادمی همراه شوید</h2>
            <p className="mt-5 text-sm leading-8 text-outline">
              برای آشنایی بیشتر با دوره‌ها، همکاری یا دریافت راهنمایی، از مسیرهای ارتباطی زیر با ما در تماس باشید.
            </p>
            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3 rounded-2xl bg-white p-4"><MapPin className="mt-1 shrink-0 text-secondary" size={20} /><span className="text-sm leading-7 text-primary">{address}</span></div>
              <div className="flex items-center gap-3 rounded-2xl bg-white p-4"><Phone className="shrink-0 text-secondary" size={20} /><span className="text-sm text-primary">پاسخ‌گویی از طریق شبکه‌های اجتماعی</span></div>
            </div>
            <div className="mt-6 flex gap-3">
              <Link href="https://www.instagram.com/imamruhollahschool/" target="_blank" rel="noopener noreferrer" aria-label="اینستاگرام" className="rounded-xl bg-primary p-3 text-secondary-fixed transition hover:bg-secondary hover:text-white"><Instagram size={20} /></Link>
              <Link href="https://ble.ir/ImamRuhollahSchool" target="_blank" rel="noopener noreferrer" aria-label="بله" className="rounded-xl bg-primary p-3 text-secondary-fixed transition hover:bg-secondary hover:text-white"><MessageCircle size={20} /></Link>
            </div>
          </div>
          <div className="overflow-hidden rounded-[2rem] border border-white bg-white p-2 shadow-xl">
            <iframe title="موقعیت آکادمی هنر و رسانه امام روح‌الله" src="https://www.google.com/maps?q=35.699257969493395,51.39662703655142&z=16&output=embed" loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-[420px] w-full rounded-[1.5rem] border-0 grayscale-[25%]" />
          </div>
        </div>
      </section>
    </main>
  );
}
