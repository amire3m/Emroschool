export function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : undefined;
}

export function setCookie(name: string, value: string, days = 7): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  const sharedDomain = window.location.hostname === "imamruhollahschool.com" || window.location.hostname.endsWith(".imamruhollahschool.com");
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${sharedDomain ? "; domain=.imamruhollahschool.com; Secure" : ""}`;
}

export function removeCookie(name: string): void {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
  if (window.location.hostname === "imamruhollahschool.com" || window.location.hostname.endsWith(".imamruhollahschool.com")) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.imamruhollahschool.com; Secure; SameSite=Lax`;
  }
}
