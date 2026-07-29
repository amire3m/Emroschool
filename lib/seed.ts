import prisma from "./prisma";
import { hashPassword } from "./auth";
import { primaryCourseCategories } from "./course-categories";

const categories = primaryCourseCategories;

const pageSections = [
  { slug: "hero_title", content: "آموزش هنر و رسانه در تراز انقلاب اسلامی", order: 1 },
  { slug: "hero_subtitle", content: "مدرسه امام روح‌الله، بستری برای شکوفایی استعدادهای مومن و هنرمند", order: 2 },
  { slug: "hero_description", content: "", order: 3 },
  { slug: "about_title", content: "درباره مدرسه", order: 4 },
  { slug: "about_text", content: "مدرسه هنر و رسانه امام روح‌الله با هدف تربیت نیروی متخصص و متعهد در عرصه هنر و رسانه فعالیت می‌کند.", order: 5 },
  { slug: "cta_text", content: "به جامعه هنرمندان متعهد بپیوندید", order: 6 },
];

const sliders = [
  {
    title: "آموزش هنر و رسانه",
    subtitle: "در تراز انقلاب اسلامی",
    imageUrl: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=2000&auto=format&fit=crop",
    linkUrl: "/courses",
    linkText: "مشاهده دوره‌ها",
    order: 1,
    published: true,
  },
  {
    title: "اساتید برجسته کشوری",
    subtitle: "یادگیری در کنار بهترین‌ها",
    imageUrl: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=2000&auto=format&fit=crop",
    linkUrl: "/instructors",
    linkText: "مشاهده اساتید",
    order: 2,
    published: true,
  },
  {
    title: "رویدادهای تخصصی",
    subtitle: "کارگاه‌ها و همایش‌های هنری",
    imageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=2000&auto=format&fit=crop",
    linkUrl: "/events",
    linkText: "رویدادهای پیش رو",
    order: 3,
    published: true,
  },
];

async function main() {
  // Admin user
  const existing = await prisma.user.findUnique({
    where: { email: "admin@honar-media.ir" },
  });
  if (!existing) {
    const hashed = await hashPassword("admin123");
    await prisma.user.create({
      data: { email: "admin@honar-media.ir", name: "مدیر سایت", password: hashed, role: "admin" },
    });
    console.log("✅ Admin created: admin@honar-media.ir / admin123");
  } else {
    console.log("ℹ️  Admin already exists");
  }

  // Categories
  for (const cat of categories) {
    const exists = await prisma.category.findFirst({
      where: { OR: [{ slug: cat.slug }, { name: cat.name }] },
    });
    if (exists) {
      await prisma.category.update({ where: { id: exists.id }, data: cat });
    } else {
      await prisma.category.create({ data: cat });
      console.log(`  📁 Category: ${cat.name}`);
    }
  }

  // Page sections
  for (const sec of pageSections) {
    await prisma.pageSection.upsert({
      where: { slug: sec.slug },
      update: { content: sec.content, order: sec.order },
      create: { slug: sec.slug, content: sec.content, order: sec.order },
    });
  }
  console.log("  📄 Page sections seeded");

  // Sliders
  for (const sl of sliders) {
    const exists = await prisma.slider.findFirst({ where: { title: sl.title } });
    if (!exists) {
      await prisma.slider.create({ data: sl });
    }
  }
  console.log("  🎠 Sliders seeded");

  await prisma.$disconnect();
  console.log("✅ Seed complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
