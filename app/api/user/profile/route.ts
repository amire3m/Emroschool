import prisma from "@/lib/prisma";
import { verifyToken, hashPassword } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "توکن معتبر نیست" }, { status: 401 });
    }

    const payload = verifyToken(authHeader.slice(7));
    if (!payload) {
      return NextResponse.json({ error: "توکن منقضی یا نامعتبر است" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
         id: true,
         newsletterSubscribed: true,
        name: true,
        email: true,
         phone: true, phoneVerified: true, balePhone: true, emailVerified: true, birthDate: true,
        province: true, city: true, address: true, postalCode: true,
        workHistory: true, artHistory: true, educationLevel: true, educationField: true,
        instagramId: true, virtualPhone: true, landline: true,
        avatar: true,
        bio: true,
        expertise: true,
        socialLinks: true,
        role: true,
        userType: true,
         profileVisible: true,
         profileApprovalStatus: true,
         profileReviewedAt: true,
        permissions: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: "خطا در دریافت پروفایل" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "توکن معتبر نیست" }, { status: 401 });
    }

    const payload = verifyToken(authHeader.slice(7));
    if (!payload) {
      return NextResponse.json({ error: "توکن منقضی یا نامعتبر است" }, { status: 401 });
    }

    const existing = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!existing) {
      return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });
    }

    const body = await req.json();
    const { name, birthDate, province, city, address, postalCode, workHistory, artHistory, educationLevel, educationField, instagramId, virtualPhone, landline, password, avatar, bio, expertise, socialLinks, profileVisible, newsletterSubscribed } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (birthDate !== undefined) data.birthDate = birthDate || null;
    if (province !== undefined) data.province = province || null;
    if (city !== undefined) data.city = city || null;
    if (address !== undefined) data.address = address || null;
    if (postalCode !== undefined) data.postalCode = postalCode || null;
    if (workHistory !== undefined) data.workHistory = workHistory || null;
    if (artHistory !== undefined) data.artHistory = artHistory || null;
    if (educationLevel !== undefined) data.educationLevel = educationLevel || null;
    if (educationField !== undefined) data.educationField = educationField || null;
    if (instagramId !== undefined) data.instagramId = instagramId || null;
    if (virtualPhone !== undefined) data.virtualPhone = virtualPhone || null;
    if (landline !== undefined) data.landline = landline || null;
    if (avatar !== undefined) data.avatar = avatar;
    if (bio !== undefined) data.bio = bio;
    if (expertise !== undefined) data.expertise = expertise;
    if (socialLinks !== undefined) data.socialLinks = socialLinks;
    const profileContentChanged = [
      [name, existing.name], [birthDate === undefined ? undefined : birthDate || null, existing.birthDate], [province === undefined ? undefined : province || null, existing.province],
      [city === undefined ? undefined : city || null, existing.city], [address === undefined ? undefined : address || null, existing.address], [postalCode === undefined ? undefined : postalCode || null, existing.postalCode],
      [workHistory === undefined ? undefined : workHistory || null, existing.workHistory], [artHistory === undefined ? undefined : artHistory || null, existing.artHistory], [educationLevel === undefined ? undefined : educationLevel || null, existing.educationLevel],
      [educationField === undefined ? undefined : educationField || null, existing.educationField], [instagramId === undefined ? undefined : instagramId || null, existing.instagramId], [virtualPhone === undefined ? undefined : virtualPhone || null, existing.virtualPhone],
      [landline === undefined ? undefined : landline || null, existing.landline], [avatar, existing.avatar], [bio, existing.bio], [expertise, existing.expertise], [socialLinks, existing.socialLinks],
    ].some(([nextValue, currentValue]) => nextValue !== undefined && nextValue !== currentValue);
    if (profileContentChanged) {
      data.profileApprovalStatus = "pending";
      data.profileVisible = false;
      data.profileReviewedAt = null;
      data.profileReviewerId = null;
    }
    // Users cannot publish their own profile; approval is required even without a content edit.
    if (profileVisible === false) data.profileVisible = false;
    if (newsletterSubscribed !== undefined && typeof newsletterSubscribed === "boolean") data.newsletterSubscribed = newsletterSubscribed;
    if (password !== undefined) {
      data.password = await hashPassword(password);
    }

    const user = await prisma.user.update({
      where: { id: payload.id },
      data,
      select: {
         id: true,
         newsletterSubscribed: true,
        name: true,
        email: true,
         phone: true, phoneVerified: true, balePhone: true, emailVerified: true, birthDate: true,
        province: true, city: true, address: true, postalCode: true,
        workHistory: true, artHistory: true, educationLevel: true, educationField: true,
        instagramId: true, virtualPhone: true, landline: true,
        avatar: true,
        bio: true,
        expertise: true,
        socialLinks: true,
        role: true,
        userType: true,
         profileVisible: true,
         profileApprovalStatus: true,
         profileReviewedAt: true,
        permissions: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return NextResponse.json({ error: "این ایمیل قبلاً برای حساب دیگری ثبت شده است" }, { status: 409 });
    return NextResponse.json({ error: "خطا در بروزرسانی پروفایل" }, { status: 500 });
  }
}
