import type { Metadata } from "next";
import { magazineUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "مجله آکادمی",
  description: "روایت دوره‌ها، تجربه اساتید و داستان هنرآموختگان آکادمی امام روح‌الله (ره).",
  alternates: { canonical: `${magazineUrl}/` },
};

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
