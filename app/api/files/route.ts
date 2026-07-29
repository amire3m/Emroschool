import { isAdminRole, verifyToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { lstat, mkdir, readdir, rename, statfs, unlink } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const uploadDir = path.join(process.cwd(), "public", "uploads");

function isAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const payload = verifyToken(authHeader.slice(7));
  return Boolean(payload && isAdminRole(payload.role));
}

function fileType(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif"].includes(ext)) return "image";
  if ([".mp4", ".webm", ".mov", ".mkv", ".avi"].includes(ext)) return "video";
  if ([".mp3", ".wav", ".ogg", ".m4a", ".aac"].includes(ext)) return "audio";
  if ([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv", ".zip", ".rar", ".7z"].includes(ext)) return "document";
  return "other";
}

async function listFiles(directory: string, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: Array<{ name: string; path: string; url: string; size: number; modifiedAt: string; type: string; extension: string }> = [];

  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(absolutePath, relativePath));
    } else if (entry.isFile()) {
      const stats = await lstat(absolutePath);
      files.push({
        name: entry.name,
        path: relativePath,
        url: `/uploads/${relativePath.split(path.sep).join("/")}`,
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        type: fileType(entry.name),
        extension: path.extname(entry.name).replace(".", "").toUpperCase() || "FILE",
      });
    }
  }

  return files;
}

async function getReferences() {
  const [courses, courseImages, galleries, sliders, users, instructors, alumni, events, partners, settings, sections] = await Promise.all([
    prisma.course.findMany({ select: { title: true, thumbnail: true, videoUrl: true } }),
    prisma.courseImage.findMany({ select: { url: true, course: { select: { title: true } } } }),
    prisma.gallery.findMany({ select: { imageUrl: true, altText: true } }),
    prisma.slider.findMany({ select: { imageUrl: true, title: true } }),
    prisma.user.findMany({ select: { avatar: true, name: true } }),
    prisma.instructor.findMany({ select: { avatar: true, name: true } }),
    prisma.alumni.findMany({ select: { imageUrl: true, name: true } }),
    prisma.event.findMany({ select: { imageUrl: true, title: true } }),
    prisma.partner.findMany({ select: { logoUrl: true, name: true } }),
    prisma.siteSetting.findMany({ select: { siteLogo: true, bgPattern: true } }),
    prisma.pageSection.findMany({ select: { content: true, slug: true } }),
  ]);

  const references = new Map<string, Set<string>>();
  const add = (url: string | null | undefined, label: string) => {
    if (!url?.startsWith("/uploads/")) return;
    if (!references.has(url)) references.set(url, new Set());
    references.get(url)?.add(label);
  };

  courses.forEach((item) => { add(item.thumbnail, `دوره: ${item.title}`); add(item.videoUrl, `ویدئوی دوره: ${item.title}`); });
  courseImages.forEach((item) => add(item.url, `تصاویر دوره: ${item.course.title}`));
  galleries.forEach((item) => add(item.imageUrl, `گالری: ${item.altText || "بدون عنوان"}`));
  sliders.forEach((item) => add(item.imageUrl, `اسلایدر: ${item.title || "بدون عنوان"}`));
  users.forEach((item) => add(item.avatar, `پروفایل کاربر: ${item.name}`));
  instructors.forEach((item) => add(item.avatar, `استاد: ${item.name || "بدون نام"}`));
  alumni.forEach((item) => add(item.imageUrl, `هنرآموخته: ${item.name}`));
  events.forEach((item) => add(item.imageUrl, `رویداد: ${item.title}`));
  partners.forEach((item) => add(item.logoUrl, `همراه: ${item.name}`));
  settings.forEach((item) => { add(item.siteLogo, "لوگوی سایت"); add(item.bgPattern, "پس‌زمینه سایت"); });
  sections.forEach((item) => {
    for (const match of item.content.matchAll(/\/uploads\/[A-Za-z0-9._%/-]+/g)) add(match[0], `صفحه اصلی: ${item.slug}`);
  });

  return references;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  try {
    await mkdir(uploadDir, { recursive: true });
    const [files, disk, references] = await Promise.all([listFiles(uploadDir), statfs(uploadDir), getReferences()]);
    const uploadsBytes = files.reduce((sum, file) => sum + file.size, 0);
    const totalBytes = disk.blocks * disk.bsize;
    const availableBytes = disk.bavail * disk.bsize;

    return NextResponse.json({
      files: files
        .map((file) => ({
          ...file,
          references: [...(references.get(file.url) || [])],
        }))
        .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)),
      storage: {
        uploadsBytes,
        totalBytes,
        availableBytes,
        usedBytes: Math.max(0, totalBytes - availableBytes),
      },
    });
  } catch (error) {
    console.error("File manager GET error:", error);
    return NextResponse.json({ error: "خطا در دریافت فایل‌ها" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  try {
    const body = await req.json();
    const requestedPath = typeof body.path === "string" ? body.path.replace(/\\/g, "/").replace(/^\/+/, "") : "";
    if (!requestedPath || requestedPath.split("/").includes("..")) {
      return NextResponse.json({ error: "مسیر فایل نامعتبر است" }, { status: 400 });
    }

    const absolutePath = path.resolve(uploadDir, requestedPath);
    if (!absolutePath.startsWith(`${path.resolve(uploadDir)}${path.sep}`)) {
      return NextResponse.json({ error: "مسیر فایل نامعتبر است" }, { status: 400 });
    }

    const stats = await lstat(absolutePath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      return NextResponse.json({ error: "فایل معتبر نیست" }, { status: 400 });
    }

    const url = `/uploads/${requestedPath}`;
    const references = [...((await getReferences()).get(url) || [])];
    if (references.length > 0) {
      return NextResponse.json({ error: "این فایل در سایت استفاده شده و قابل حذف نیست", references }, { status: 409 });
    }

    await unlink(absolutePath);
    return NextResponse.json({ message: "فایل حذف شد" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "فایل پیدا نشد" }, { status: 404 });
    }
    console.error("File manager DELETE error:", error);
    return NextResponse.json({ error: "خطا در حذف فایل" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  let oldAbsolutePath = "";
  let newAbsolutePath = "";
  let fileRenamed = false;

  try {
    const body = await req.json();
    const requestedPath = typeof body.path === "string" ? body.path.replace(/\\/g, "/").replace(/^\/+/, "") : "";
    const requestedName = typeof body.name === "string" ? body.name.trim() : "";
    if (!requestedPath || requestedPath.split("/").includes("..")) {
      return NextResponse.json({ error: "مسیر فایل نامعتبر است" }, { status: 400 });
    }

    const oldExtension = path.extname(requestedPath).toLowerCase();
    const suppliedExtension = path.extname(requestedName).toLowerCase();
    const newBaseName = suppliedExtension ? path.basename(requestedName, suppliedExtension) : requestedName;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,79}$/.test(newBaseName)) {
      return NextResponse.json({ error: "نام باید ۲ تا ۸۰ نویسه و فقط شامل حروف انگلیسی، عدد، خط تیره یا زیرخط باشد" }, { status: 400 });
    }
    if (suppliedExtension && suppliedExtension !== oldExtension) {
      return NextResponse.json({ error: "پسوند فایل قابل تغییر نیست" }, { status: 400 });
    }

    const directory = path.posix.dirname(requestedPath);
    const newFileName = `${newBaseName}${oldExtension}`;
    const newPath = directory === "." ? newFileName : `${directory}/${newFileName}`;
    oldAbsolutePath = path.resolve(uploadDir, requestedPath);
    newAbsolutePath = path.resolve(uploadDir, newPath);
    const uploadRoot = `${path.resolve(uploadDir)}${path.sep}`;
    if (!oldAbsolutePath.startsWith(uploadRoot) || !newAbsolutePath.startsWith(uploadRoot)) {
      return NextResponse.json({ error: "مسیر فایل نامعتبر است" }, { status: 400 });
    }

    const stats = await lstat(oldAbsolutePath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      return NextResponse.json({ error: "فایل معتبر نیست" }, { status: 400 });
    }
    if (oldAbsolutePath === newAbsolutePath) {
      return NextResponse.json({ path: newPath, url: `/uploads/${newPath}`, name: newFileName });
    }
    try {
      await lstat(newAbsolutePath);
      return NextResponse.json({ error: "فایلی با این نام وجود دارد" }, { status: 409 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    const oldUrl = `/uploads/${requestedPath}`;
    const newUrl = `/uploads/${newPath}`;
    const sections = await prisma.pageSection.findMany({ where: { content: { contains: oldUrl } }, select: { id: true, content: true } });

    await rename(oldAbsolutePath, newAbsolutePath);
    fileRenamed = true;
    await prisma.$transaction([
      prisma.course.updateMany({ where: { thumbnail: oldUrl }, data: { thumbnail: newUrl } }),
      prisma.course.updateMany({ where: { videoUrl: oldUrl }, data: { videoUrl: newUrl } }),
      prisma.courseImage.updateMany({ where: { url: oldUrl }, data: { url: newUrl } }),
      prisma.gallery.updateMany({ where: { imageUrl: oldUrl }, data: { imageUrl: newUrl } }),
      prisma.slider.updateMany({ where: { imageUrl: oldUrl }, data: { imageUrl: newUrl } }),
      prisma.user.updateMany({ where: { avatar: oldUrl }, data: { avatar: newUrl } }),
      prisma.instructor.updateMany({ where: { avatar: oldUrl }, data: { avatar: newUrl } }),
      prisma.alumni.updateMany({ where: { imageUrl: oldUrl }, data: { imageUrl: newUrl } }),
      prisma.event.updateMany({ where: { imageUrl: oldUrl }, data: { imageUrl: newUrl } }),
      prisma.partner.updateMany({ where: { logoUrl: oldUrl }, data: { logoUrl: newUrl } }),
      prisma.siteSetting.updateMany({ where: { siteLogo: oldUrl }, data: { siteLogo: newUrl } }),
      prisma.siteSetting.updateMany({ where: { bgPattern: oldUrl }, data: { bgPattern: newUrl } }),
      ...sections.map((section) => prisma.pageSection.update({ where: { id: section.id }, data: { content: section.content.split(oldUrl).join(newUrl) } })),
    ]);

    return NextResponse.json({ path: newPath, url: newUrl, name: newFileName });
  } catch (error) {
    if (fileRenamed) {
      try { await rename(newAbsolutePath, oldAbsolutePath); } catch (rollbackError) { console.error("File rename rollback error:", rollbackError); }
    }
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "فایل پیدا نشد" }, { status: 404 });
    }
    console.error("File manager PATCH error:", error);
    return NextResponse.json({ error: "خطا در تغییر نام فایل" }, { status: 500 });
  }
}
