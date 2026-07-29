import { redirect } from "next/navigation";

export default function LegacyPageBuilder() {
  redirect("/admin/settings");
}
