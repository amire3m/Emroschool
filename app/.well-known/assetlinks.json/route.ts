import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME || "com.imamruhollahschool.app";
  const fingerprint = process.env.ANDROID_SHA256_FINGERPRINT || "";
  const sha256CertFingerprints = fingerprint
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return NextResponse.json(
    [
      {
        relation: ["delegate_permission_for_handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: packageName,
          sha256_cert_fingerprints: sha256CertFingerprints,
        },
      },
    ],
    { headers: { "content-type": "application/json" } },
  );
}
