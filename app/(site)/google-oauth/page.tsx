import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Imam Ruhollah School | Google Sign-In",
  description: "Imam Ruhollah School uses optional Google Sign-In to create and access student accounts for arts and media education.",
};

export default function GoogleOAuthPage() {
  return <main className="min-h-screen bg-surface pt-24 pb-16" dir="ltr">
    <section className="mx-auto max-w-4xl px-5 md:px-8">
      <div className="overflow-hidden rounded-[2rem] border border-primary/10 bg-white shadow-xl shadow-primary/10">
        <div className="bg-primary px-7 py-12 text-white md:px-12"><p className="text-sm font-bold tracking-[.2em] text-secondary-fixed">OFFICIAL APPLICATION PAGE</p><h1 className="mt-5 text-4xl font-black leading-tight md:text-5xl">Imam Ruhollah School</h1><p className="mt-5 max-w-2xl text-base leading-8 text-white/75">The official learning platform of Imam Ruhollah School for arts and media education, course registration, and student services.</p></div>
        <div className="p-7 md:p-12"><h2 className="text-2xl font-black text-primary">Optional Google Sign-In</h2><p className="mt-4 text-base leading-8 text-outline">Google Sign-In is an optional way for users to create an account or sign in to Imam Ruhollah School. Users may also register and sign in using their email address and password.</p><div className="mt-8 grid gap-4 md:grid-cols-3">{[[LockKeyhole, "Purpose", "Google Sign-In is used only to authenticate users and provide access to their learning dashboard."], [ShieldCheck, "Data Used", "We use the Google account name, verified email address, and profile image to create or access a user account."], [CheckCircle2, "User Choice", "Users can continue using email and password. Google Sign-In is never required to use the platform."]].map(([Icon, title, text]) => { const ItemIcon = Icon as typeof LockKeyhole; return <article key={title as string} className="rounded-2xl border border-surface-variant bg-surface-low p-5"><ItemIcon className="text-secondary" size={24} /><h3 className="mt-4 font-black text-primary">{title as string}</h3><p className="mt-2 text-sm leading-7 text-outline">{text as string}</p></article>; })}</div><div className="mt-10 border-t border-surface-variant pt-6 text-sm leading-7 text-outline"><p>Imam Ruhollah School is committed to protecting user information and using it solely for educational services and account access.</p><p className="mt-3"><Link href="/privacy-policy" className="font-bold text-secondary underline">Read our Privacy Policy</Link></p><div className="mt-5 flex flex-wrap gap-3"><Link href="/" className="rounded-xl bg-primary px-5 py-3 font-bold text-white">Visit Imam Ruhollah School</Link><Link href="/about" className="rounded-xl border border-outline-variant px-5 py-3 font-bold text-primary">About the School</Link></div></div></div>
      </div>
    </section>
  </main>;
}
