import ErrorExperience from "@/components/ui/error-experience";

export default function NotFound() {
  return <ErrorExperience code="404" title="این مسیر به مقصد نرسید" description="صفحه‌ای که به دنبال آن هستید وجود ندارد، جابه‌جا شده یا نشانی آن درست وارد نشده است." />;
}
