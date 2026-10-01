import { APP_VERSION, releaseNotes, type ReleaseNote } from "@/lib/version";
import { CheckCircle2, History, Rocket, Sparkles, Wrench } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/admin/ui";

const typeMeta: Record<ReleaseNote["type"], { label: string; icon: typeof Rocket; tone: BadgeTone }> = {
  release: { label: "انتشار نسخه", icon: Rocket, tone: "navy" },
  feature: { label: "قابلیت جدید", icon: Sparkles, tone: "blue" },
  improvement: { label: "بهبود", icon: CheckCircle2, tone: "emerald" },
  fix: { label: "رفع مشکل", icon: Wrench, tone: "amber" },
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("fa-IR", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function UpdatesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5" dir="rtl">
      <div className="rounded-xl border border-slate-200 bg-white p-6 md:p-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div><p className="text-sm font-bold text-slate-500">نسخه جاری سامانه</p><h2 className="mt-2 text-4xl font-black tabular-nums text-slate-900">نسخه {APP_VERSION}</h2><p className="mt-3 text-sm text-slate-500">آخرین قابلیت‌ها و بهبودهای سامانه به ترتیب زمان انتشار</p></div>
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><History size={30} /></div>
        </div>
      </div>

      <div className="relative space-y-4 pr-8 before:absolute before:bottom-4 before:right-[11px] before:top-4 before:w-px before:bg-slate-200">
        {releaseNotes.map((note) => {
          const meta = typeMeta[note.type];
          const Icon = meta.icon;
          return <article key={note.id} className="relative rounded-xl border border-slate-200 bg-white p-5">
            <span className="absolute -right-[31px] top-7 h-3 w-3 rounded-full bg-[#03004b] ring-4 ring-slate-100" />
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div><div className="mb-2 flex items-center gap-2"><Badge tone={meta.tone}><Icon size={13} />{meta.label}</Badge>{note.version && <span className="text-xs font-bold tabular-nums text-slate-700">نسخه {note.version}</span>}</div><h3 className="text-lg font-bold text-slate-900">{note.title}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{note.summary}</p></div>
              <time className="whitespace-nowrap text-xs tabular-nums text-slate-500" dateTime={note.publishedAt}>{formatDate(note.publishedAt)}</time>
            </div>
          </article>;
        })}
      </div>
    </div>
  );
}
