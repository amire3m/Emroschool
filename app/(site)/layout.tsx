import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SiteSettingsProvider from "@/components/SiteSettingsProvider";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteSettingsProvider>
      <Navbar />
      <main className="flex-grow">{children}</main>
      <Footer />
    </SiteSettingsProvider>
  );
}
