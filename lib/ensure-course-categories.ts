import prisma from "./prisma";
import { primaryCourseCategories } from "./course-categories";

async function main() {
  for (const category of primaryCourseCategories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
  }
  console.log(`Ensured ${primaryCourseCategories.length} course categories`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
