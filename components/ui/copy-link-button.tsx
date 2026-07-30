"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";

export default function CopyLinkButton({ path, label = "کپی لینک" }: { path?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copyLink() {
    const url = path ? new URL(path, window.location.origin).toString() : window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement("textarea");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return <button type="button" onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/70 bg-white px-3 py-2 text-xs font-bold text-outline transition hover:border-secondary hover:text-secondary" title={label}>{copied ? <Check size={15} /> : <Link2 size={15} />}{copied ? "کپی شد" : label}</button>;
}
