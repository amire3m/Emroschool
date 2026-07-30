import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

const siteUrl = process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://imamruhollahschool.com";
const callbackUrl = `${siteUrl}/api/auth/google/callback`;

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) return NextResponse.redirect(new URL("/login?google=unavailable", siteUrl));

  const redirect = req.nextUrl.searchParams.get("redirect");
  const safeRedirect = redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : "/dashboard";
  const state = crypto.randomBytes(32).toString("hex");
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", callbackUrl);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", "openid email profile");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set("google_oauth_state", JSON.stringify({ state, redirect: safeRedirect }), { httpOnly: true, secure: siteUrl.startsWith("https://"), sameSite: "lax", maxAge: 600, path: "/" });
  return response;
}
