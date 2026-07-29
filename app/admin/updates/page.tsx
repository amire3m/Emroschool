import { APP_VERSION, releaseNotes, type ReleaseNote } from "@/lib/version";
import { CheckCircle2, History, Rocket, Sparkles, Wrench } from "lucide-react";

const typeMeta: Record<ReleaseNote["type"], { label: string; icon: typeof Rocket; color: string; bg: string }> = {
  release: { label: "انتشار نسخه", icon: Rocket, color: "text-primary", bg: "bg-secondary-fixed" },
  feature: { label: "قابلیت جدید", icon: Sparkles, color: "text-secondary", bg: "bg-secondary-fixed/40" },
  improvement: { label: "بهبود", icon: CheckCircle2, color: "text-blue-700", bg: "bg-blue-50" },
  fix: { label: "رفع مشکل", icon: Wrench, color: "text-green-700", bg: "bg-green-50" },
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("fa-IR", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function UpdatesPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-primary p-7 text-white">
        <Rocket className="absolute -left-5 -bottom-6 text-white/5" size={150} />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div><p className="text-secondary-fixed text-sm font-bold">نسخه جاری سامانه</p><h2 className="text-4xl font-black mt-2">نسخه {APP_VERSION}</h2><p className="text-white/60 text-sm mt-3">آخرین قابلیت‌ها و بهبودهای سامانه به ترتیب زمان انتشار</p></div>
          <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center"><History size={30} className="text-secondary-fixed" /></div>
        </div>
      </div>

      <div className="relative pr-8 space-y-4 before:absolute before:right-[11px] before:top-4 before:bottom-4 before:w-px before:bg-outline-variant">
        {releaseNotes.map((note) => {
          const meta = typeMeta[note.type];
          const Icon = meta.icon;
          return <article key={note.id} className="relative bg-white rounded-2xl border border-surface-variant p-5 shadow-sm">
            <span className="absolute -right-[31px] top-7 w-3 h-3 rounded-full bg-secondary ring-4 ring-surface" />
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div><div className="flex items-center gap-2 mb-2"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${meta.bg} ${meta.color}`}><Icon size={13} />{meta.label}</span>{note.version && <span className="text-xs font-bold text-primary">نسخه {note.version}</span>}</div><h3 className="font-bold text-primary text-lg">{note.title}</h3><p className="text-outline text-sm leading-7 mt-2">{note.summary}</p></div>
              <time className="text-xs text-outline whitespace-nowrap" dateTime={note.publishedAt}>{formatDate(note.publishedAt)}</time>
            </div>
          </article>;
        })}
      </div>
    </div>
  );
}
