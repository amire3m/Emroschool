import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SiteSettingsProvider from "@/components/SiteSettingsProvider";
import MagazineShell from "@/components/magazine/magazine-shell";
import { headers } from "next/headers";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const hostname = (headers().get("host") || "").split(":")[0].toLowerCase();
  const isMagazine = hostname === "mag.imamruhollahschool.com" || hostname.startsWith("mag.");
  if (isMagazine) return <MagazineShell>{children}</MagazineShell>;
  return (
    <SiteSettingsProvider>
      <Navbar />
      <main className="flex-grow">{children}</main>
      <Footer />
    </SiteSettingsProvider>
  );
}
