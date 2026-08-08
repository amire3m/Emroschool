export const siteUrl = "https://imamruhollahschool.com";
export const magazineUrl = "https://mag.imamruhollahschool.com";
export const siteName = "آکادمی هنر و رسانه امام روح‌الله (ره)";

export function absoluteUrl(path: string, baseUrl = siteUrl) {
  return new URL(path, baseUrl).toString();
}
