import crypto from "crypto";
import { generateToken, hashPassword } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendWelcomeEmail } from "@/lib/verification";
import { NextRequest, NextResponse } from "next/server";

const siteUrl = process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://imamruhollahschool.com";
const callbackUrl = `${siteUrl}/api/auth/google/callback`;

type GoogleProfile = { email?: string; email_verified?: boolean; name?: string; picture?: string };

export async function GET(req: NextRequest) {
  const errorRedirect = (reason: string) => NextResponse.redirect(new URL(`/login?google=${reason}`, siteUrl));
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const stored = req.cookies.get("google_oauth_state")?.value;
  if (!code || !state || !stored) return errorRedirect("failed");

  let oauthState: { state: string; redirect: string };
  try { oauthState = JSON.parse(stored); } catch { return errorRedirect("failed"); }
  const expectedState = oauthState.state || "";
  if (state.length !== expectedState.length || !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expectedState))) return errorRedirect("failed");

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", redirect_uri: callbackUrl, grant_type: "authorization_code" }) });
    if (!tokenResponse.ok) throw new Error("GOOGLE_TOKEN_FAILED");
    const tokenData = await tokenResponse.json() as { access_token?: string };
    if (!tokenData.access_token) throw new Error("GOOGLE_TOKEN_MISSING");
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    const profile = await profileResponse.json() as GoogleProfile;
    const email = profile.email?.trim().toLowerCase();
    if (!profileResponse.ok || !email || !profile.email_verified) throw new Error("GOOGLE_EMAIL_UNVERIFIED");

    let user = await prisma.user.findUnique({ where: { email } });
    let isNewUser = false;
    if (!user) {
      user = await prisma.user.create({ data: { email, name: profile.name?.trim() || email.split("@")[0], password: await hashPassword(crypto.randomBytes(32).toString("hex")), avatar: profile.picture || null, role: "user", userType: "student", profileVisible: false, emailVerified: true } });
      isNewUser = true;
    }
    if (isNewUser) sendWelcomeEmail(user.email, user.name).catch((error) => console.error("Google welcome email error:", error));

    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    const redirect = user.role === "admin" || user.role === "superadmin" ? "/admin" : !user.registrationCompleted ? "/register?google=1" : oauthState.redirect || "/dashboard";
    const response = NextResponse.redirect(new URL(redirect, siteUrl));
    response.cookies.set("token", token, { httpOnly: false, secure: siteUrl.startsWith("https://"), sameSite: "lax", maxAge: 7 * 86400, path: "/", domain: siteUrl.includes("imamruhollahschool.com") ? ".imamruhollahschool.com" : undefined });
    response.cookies.set("google_oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  } catch (error) {
    console.error("Google OAuth error:", error);
    return errorRedirect("failed");
  }
}
