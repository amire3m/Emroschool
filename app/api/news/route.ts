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
  try {
    const permissions = JSON.parse(user.permissions);
    return Array.isArray(permissions) && (permissions.length === 0 || permissions.includes("news")) ? user : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getNewsAdmin(req);
    const news = await prisma.newsPost.findMany({
      where: admin ? undefined : { published: true },
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ news });
  } catch (error) {
    console.error("News GET error:", error);
    return NextResponse.json({ error: "خطا در دریافت اخبار" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getNewsAdmin(req);
  if (!admin) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  try {
    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    const excerpt = typeof body.excerpt === "string" ? body.excerpt.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!title || !slug || !excerpt || !content) return NextResponse.json({ error: "عنوان، اسلاگ، خلاصه و متن خبر الزامی است" }, { status: 400 });
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return NextResponse.json({ error: "اسلاگ باید انگلیسی و با خط تیره نوشته شود" }, { status: 400 });
    if (!categories.has(body.category)) return NextResponse.json({ error: "دسته‌بندی نامعتبر است" }, { status: 400 });

    const newsPost = await prisma.newsPost.create({
      data: {
        title,
        slug,
        excerpt,
        content,
        coverImage: body.coverImage || null,
        category: body.category,
        authorName: body.authorName?.trim() || admin.name,
        tags: body.tags?.trim() || null,
        featured: Boolean(body.featured),
        published: Boolean(body.published),
        publishedAt: body.published ? new Date() : null,
      },
    });
    return NextResponse.json({ newsPost }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return NextResponse.json({ error: "این اسلاگ قبلاً استفاده شده است" }, { status: 409 });
    console.error("News POST error:", error);
    return NextResponse.json({ error: "خطا در ایجاد خبر" }, { status: 500 });
  }
}
