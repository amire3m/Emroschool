"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

const suggestions = ["جستجوی دوره‌ها...", "نام استاد را بنویسید...", "دنبال چه هنری هستید؟"];

interface AnimatedSearchBarProps {
  expanded?: boolean;
  autoFocus?: boolean;
  onSubmit?: () => void;
}

export default function AnimatedSearchBar({ expanded = false, autoFocus = false, onSubmit }: AnimatedSearchBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSuggestionIndex((current) => (current + 1) % suggestions.length);
    }, 2600);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      inputRef.current?.focus();
      return;
    }
    router.push(`/courses?q=${encodeURIComponent(normalizedQuery)}`);
    onSubmit?.();
  }

  return (
    <form
      role="search"
      onSubmit={submitSearch}
      className={`group/search relative h-11 overflow-hidden rounded-2xl transition-[width,box-shadow,transform] duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${expanded ? "w-full" : "w-11 hover:w-72 focus-within:w-72"} ${focused ? "shadow-[0_0_28px_rgba(255,222,171,0.2)] -translate-y-0.5" : ""}`}
    >
      <div className={`absolute -inset-24 bg-[conic-gradient(from_0deg,transparent_0_55%,#ffdeab_72%,transparent_88%)] transition-opacity duration-300 animate-[spin_3.8s_linear_infinite] ${focused ? "opacity-100" : "opacity-45 group-hover/search:opacity-80"}`} />
      <div className="absolute inset-px rounded-[15px] bg-primary-container/95 backdrop-blur-xl" />
      <div className={`absolute inset-y-1 right-1 w-9 rounded-xl bg-secondary-fixed text-primary flex items-center justify-center transition-transform duration-500 ${focused ? "rotate-[-8deg] scale-105" : "group-hover/search:rotate-[-8deg]"}`}>
        <Search size={18} strokeWidth={2.4} />
      </div>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setQuery("");
            inputRef.current?.blur();
          }
        }}
        aria-label="جستجوی دوره‌ها"
        className={`relative z-10 h-full w-full bg-transparent pr-14 pl-10 text-sm text-white outline-none [&::-webkit-search-cancel-button]:hidden transition-opacity duration-300 ${expanded ? "opacity-100" : "opacity-0 group-hover/search:opacity-100 group-focus-within/search:opacity-100"}`}
      />
      {!query && <span key={suggestionIndex} className={`pointer-events-none absolute z-10 right-[3.25rem] top-1/2 -translate-y-1/2 whitespace-nowrap text-xs text-white/55 animate-search-placeholder ${expanded ? "block" : "hidden group-hover/search:block group-focus-within/search:block"}`}>{suggestions[suggestionIndex]}</span>}
      {query && <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="absolute z-20 left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg text-white/45 hover:text-secondary-fixed hover:bg-white/5 flex items-center justify-center transition-colors" aria-label="پاک کردن جستجو"><X size={15} /></button>}
      <button type="submit" className="absolute z-20 inset-y-0 right-0 w-11" aria-label="اجرای جستجو" />
      <span className={`absolute bottom-0 right-10 h-px bg-gradient-to-l from-secondary-fixed via-secondary-fixed/60 to-transparent transition-all duration-700 ${focused ? "w-[70%] opacity-100" : "w-0 opacity-0"}`} />
    </form>
  );
}
