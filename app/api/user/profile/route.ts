import prisma from "@/lib/prisma";
import { verifyToken, hashPassword } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";
import { queueProfileReviewEvent } from "@/lib/bale-group-notifications";
import type { Prisma } from "@prisma/client";

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
          notificationEmailEnabled: true,
          notificationSmsEnabled: true,
          notificationBaleEnabled: true,
        name: true,
         email: true,
         registrationCompleted: true,
         phone: true, nationalCode: true, gender: true, phoneVerified: true, balePhone: true, emailVerified: true, birthDate: true,
        province: true, city: true, district: true, neighborhood: true, address: true, postalCode: true,
        workHistory: true, artHistory: true, educationLevel: true, educationField: true, university: true, universityField: true,
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
         profileRejectionReason: true,
         avatarSubmissions: { orderBy: { submittedAt: "desc" as const }, take: 1, select: { id: true, imageUrl: true, status: true, rejectionReason: true, submittedAt: true } },
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

const defaultPutDependencies = { db: prisma, authenticate: (req: NextRequest) => {
  const header = req.headers.get("authorization");
  return header?.startsWith("Bearer ") ? verifyToken(header.slice(7)) : null;
}, now: () => new Date() };

export async function PUT(req: NextRequest, _context: { params?: Record<string, string> } = {}, overrides: Partial<typeof defaultPutDependencies> = {}) {
  const dependencies = { ...defaultPutDependencies, ...overrides };
  try {
    const payload = dependencies.authenticate(req);
    if (!payload) {
      return NextResponse.json({ error: "توکن منقضی یا نامعتبر است" }, { status: 401 });
    }

    const existing = await dependencies.db.user.findUnique({ where: { id: payload.id } });
    if (!existing) {
      return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });
    }

    const body = await req.json();
    const { name, birthDate, province, city, district, neighborhood, address, postalCode, workHistory, artHistory, educationLevel, educationField, university, universityField, instagramId, virtualPhone, landline, password, avatar, bio, expertise, socialLinks, profileVisible, newsletterSubscribed, notificationEmailEnabled, notificationSmsEnabled, notificationBaleEnabled } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (birthDate !== undefined) data.birthDate = birthDate || null;
    if (province !== undefined) data.province = province || null;
    if (city !== undefined) data.city = city || null;
    if (district !== undefined) data.district = district || null;
    if (neighborhood !== undefined) data.neighborhood = neighborhood || null;
    if (address !== undefined) data.address = address || null;
    if (postalCode !== undefined) data.postalCode = postalCode || null;
    if (workHistory !== undefined) data.workHistory = workHistory || null;
    if (artHistory !== undefined) data.artHistory = artHistory || null;
    if (educationLevel !== undefined) data.educationLevel = educationLevel || null;
    if (educationField !== undefined) data.educationField = educationField || null;
    if (university !== undefined) data.university = university || null;
    if (universityField !== undefined) data.universityField = universityField || null;
    if (instagramId !== undefined) data.instagramId = instagramId || null;
    if (virtualPhone !== undefined) data.virtualPhone = virtualPhone || null;
    if (landline !== undefined) data.landline = landline || null;
    if (avatar !== undefined) data.avatar = avatar;
    if (bio !== undefined) data.bio = bio;
    if (expertise !== undefined) data.expertise = expertise;
    if (socialLinks !== undefined) data.socialLinks = socialLinks;
    const profileContentChanged = [
      [name, existing.name], [birthDate === undefined ? undefined : birthDate || null, existing.birthDate], [province === undefined ? undefined : province || null, existing.province],
      [city === undefined ? undefined : city || null, existing.city], [district === undefined ? undefined : district || null, existing.district], [neighborhood === undefined ? undefined : neighborhood || null, existing.neighborhood],
      [address === undefined ? undefined : address || null, existing.address], [postalCode === undefined ? undefined : postalCode || null, existing.postalCode],
      [workHistory === undefined ? undefined : workHistory || null, existing.workHistory], [artHistory === undefined ? undefined : artHistory || null, existing.artHistory], [educationLevel === undefined ? undefined : educationLevel || null, existing.educationLevel],
      [educationField === undefined ? undefined : educationField || null, existing.educationField], [university === undefined ? undefined : university || null, existing.university], [universityField === undefined ? undefined : universityField || null, existing.universityField],
      [instagramId === undefined ? undefined : instagramId || null, existing.instagramId], [virtualPhone === undefined ? undefined : virtualPhone || null, existing.virtualPhone],
      [landline === undefined ? undefined : landline || null, existing.landline], [avatar, existing.avatar], [bio, existing.bio], [expertise, existing.expertise], [socialLinks, existing.socialLinks],
    ].some(([nextValue, currentValue]) => nextValue !== undefined && nextValue !== currentValue);
    if (profileContentChanged) {
      data.profileApprovalStatus = "pending";
      data.profileVisible = false;
       data.profileReviewedAt = null;
       data.profileReviewerId = null;
       data.profileRejectionReason = null;
    }
    // Users cannot publish their own profile; approval is required even without a content edit.
    if (profileVisible === false) data.profileVisible = false;
    if (newsletterSubscribed !== undefined && typeof newsletterSubscribed === "boolean") data.newsletterSubscribed = newsletterSubscribed;
    const notificationPreferencesProvided = notificationEmailEnabled !== undefined || notificationSmsEnabled !== undefined || notificationBaleEnabled !== undefined;
    if (notificationPreferencesProvided) {
      if ([notificationEmailEnabled, notificationSmsEnabled, notificationBaleEnabled].some((value) => value !== undefined && typeof value !== "boolean")) {
        return NextResponse.json({ error: "تنظیمات اعلان نامعتبر است" }, { status: 400 });
      }
      const nextSmsEnabled = notificationSmsEnabled ?? existing.notificationSmsEnabled;
      const nextBaleEnabled = notificationBaleEnabled ?? existing.notificationBaleEnabled;
      if (nextSmsEnabled === nextBaleEnabled) {
        return NextResponse.json({ error: "دقیقاً یکی از روش‌های پیامکی یا بله را انتخاب کنید" }, { status: 400 });
      }
      if (nextSmsEnabled && !existing.phone) return NextResponse.json({ error: "برای دریافت پیامک، شماره موبایل لازم است" }, { status: 400 });
      if (nextBaleEnabled && !(existing.balePhone || existing.phone)) return NextResponse.json({ error: "برای دریافت اعلان بله، شماره بله یا موبایل لازم است" }, { status: 400 });
      if (notificationEmailEnabled !== undefined) data.notificationEmailEnabled = notificationEmailEnabled;
      if (notificationSmsEnabled !== undefined) data.notificationSmsEnabled = notificationSmsEnabled;
      if (notificationBaleEnabled !== undefined) data.notificationBaleEnabled = notificationBaleEnabled;
    }
    if (password !== undefined) {
      data.password = await hashPassword(password);
    }

    const select = {
         id: true,
          newsletterSubscribed: true,
          notificationEmailEnabled: true,
          notificationSmsEnabled: true,
          notificationBaleEnabled: true,
        name: true,
         email: true,
         registrationCompleted: true,
         phone: true, phoneVerified: true, balePhone: true, emailVerified: true, birthDate: true,
        province: true, city: true, district: true, neighborhood: true, address: true, postalCode: true,
        workHistory: true, artHistory: true, educationLevel: true, educationField: true, university: true, universityField: true,
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
         profileRejectionReason: true,
         avatarSubmissions: { orderBy: { submittedAt: "desc" }, take: 1, select: { id: true, imageUrl: true, status: true, rejectionReason: true, submittedAt: true } },
        permissions: true,
      } satisfies Prisma.UserSelect;
    const user = profileContentChanged ? await dependencies.db.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: { id: payload.id, profileReviewRevision: existing.profileReviewRevision },
        data: { ...data, profileReviewRevision: { increment: 1 } },
      });
      if (changed.count !== 1) throw new Error("PROFILE_REVISION_CONFLICT");
      const revision = existing.profileReviewRevision + 1;
      const current = await tx.user.findUniqueOrThrow({ where: { id: payload.id }, select });
      await queueProfileReviewEvent(tx, current, revision, dependencies.now());
      return current;
    }) : await dependencies.db.user.update({ where: { id: payload.id }, data, select });

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof Error && error.message === "PROFILE_REVISION_CONFLICT") return NextResponse.json({ error: "پروفایل هم‌زمان دیگری ثبت شده است" }, { status: 409 });
    if ((error as { code?: string }).code === "P2002") return NextResponse.json({ error: "این ایمیل قبلاً برای حساب دیگری ثبت شده است" }, { status: 409 });
    return NextResponse.json({ error: "خطا در بروزرسانی پروفایل" }, { status: 500 });
  }
}
