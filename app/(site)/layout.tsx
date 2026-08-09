import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SiteSettingsProvider from "@/components/SiteSettingsProvider";
import MagazineShell from "@/components/magazine/magazine-shell";
import { headers } from "next/headers";
import { siteName, siteUrl } from "@/lib/seo";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const hostname = (headers().get("host") || "").split(":")[0].toLowerCase();
  const isMagazine = hostname === "mag.imamruhollahschool.com" || hostname.startsWith("mag.");
  if (isMagazine) return <MagazineShell>{children}</MagazineShell>;
  return (
    <SiteSettingsProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: siteName,
            url: siteUrl,
            sameAs: ["https://www.instagram.com/imamruhollahschool/", "https://ble.ir/ImamRuhollahSchool"],
            address: {
              "@type": "PostalAddress",
              addressLocality: "تهران",
              streetAddress: "میدان انقلاب، کارگر جنوبی، خیابان نظری، بین خیابان دانشگاه و قدیری، پلاک 72",
              addressCountry: "IR",
            },
          }),
        }}
      />
      <Navbar />
      <main className="flex-grow">{children}</main>
      <Footer />
    </SiteSettingsProvider>
  );
}
