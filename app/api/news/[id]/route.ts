import prisma from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const categories = new Set(["general", "course", "instructor", "alumni"]);

async function getNewsAdmin(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const user = await getUserFromToken(authorization.slice(7));
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) return null;
  if (user.role === "superadmin" || !user.permissions) return user;
  try { const permissions = JSON.parse(user.permissions); return Array.isArray(permissions) && (permissions.length === 0 || permissions.includes("news")) ? user : null; } catch { return null; }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await getNewsAdmin(req);
    const newsPost = await prisma.newsPost.findFirst({
      where: { OR: [{ id: params.id }, { slug: params.id }], ...(admin ? {} : { published: true }) },
    });
    if (!newsPost) return NextResponse.json({ error: "خبر پیدا نشد" }, { status: 404 });
    return NextResponse.json({ newsPost });
  } catch {
    return NextResponse.json({ error: "خطا در دریافت خبر" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getNewsAdmin(req);
  if (!admin) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  try {
    const body = await req.json();
    const existing = await prisma.newsPost.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "خبر پیدا نشد" }, { status: 404 });
    const title = typeof body.title === "string" ? body.title.trim() : existing.title;
    const excerpt = typeof body.excerpt === "string" ? body.excerpt.trim() : existing.excerpt;
    const content = typeof body.content === "string" ? body.content.trim() : existing.content;
    if (!title || !excerpt || !content) return NextResponse.json({ error: "عنوان، خلاصه و متن خبر الزامی است" }, { status: 400 });
    const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : existing.slug;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return NextResponse.json({ error: "اسلاگ باید انگلیسی و با خط تیره نوشته شود" }, { status: 400 });
    if (body.category !== undefined && !categories.has(body.category)) return NextResponse.json({ error: "دسته‌بندی نامعتبر است" }, { status: 400 });
    const becomingPublished = body.published === true && !existing.published;
    const newsPost = await prisma.newsPost.update({
      where: { id: params.id },
      data: {
        title, slug, excerpt, content,
        coverImage: body.coverImage || null, category: body.category, authorName: body.authorName?.trim() || null,
        tags: body.tags?.trim() || null, featured: Boolean(body.featured), published: Boolean(body.published),
        publishedAt: becomingPublished ? new Date() : body.published === false ? null : existing.publishedAt,
      },
    });
    return NextResponse.json({ newsPost });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return NextResponse.json({ error: "این اسلاگ قبلاً استفاده شده است" }, { status: 409 });
    return NextResponse.json({ error: "خطا در بروزرسانی خبر" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getNewsAdmin(req);
  if (!admin) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  try {
    await prisma.newsPost.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "خبر حذف شد" });
  } catch (error) {
    if ((error as { code?: string }).code === "P2025") return NextResponse.json({ error: "خبر پیدا نشد" }, { status: 404 });
    return NextResponse.json({ error: "خطا در حذف خبر" }, { status: 500 });
  }
}
