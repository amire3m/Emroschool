import { getVapidPublicKey } from "@/lib/push";
import { NextResponse } from "next/server";

export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json({ publicKey: null });
  }
  return NextResponse.json({ publicKey });
}
