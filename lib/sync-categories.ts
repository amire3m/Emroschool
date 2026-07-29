import prisma from "./prisma";
import { primaryCourseCategories } from "./course-categories";

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const existingCategories = await tx.category.findMany();
    const retainedIds: string[] = [];

    for (const category of primaryCourseCategories) {
      const existing = existingCategories.find((item) => item.name === category.name)
        || existingCategories.find((item) => item.slug === category.slug);

      const saved = existing
        ? await tx.category.update({ where: { id: existing.id }, data: category })
        : await tx.category.create({ data: category });

      retainedIds.push(saved.id);
      await tx.course.updateMany({
        where: { categoryId: saved.id },
        data: { categoryName: saved.name },
      });
    }

    const obsolete = existingCategories.filter((category) => !retainedIds.includes(category.id));
    let detachedCourses = 0;

    for (const category of obsolete) {
      const update = await tx.course.updateMany({
        where: { categoryId: category.id },
        data: { categoryId: null, categoryName: null },
      });
      detachedCourses += update.count;
      await tx.category.delete({ where: { id: category.id } });
    }

    return { categories: primaryCourseCategories.length, removed: obsolete.length, detachedCourses };
  });

  console.log(`Categories synchronized: ${result.categories}`);
  console.log(`Old categories removed: ${result.removed}`);
  console.log(`Courses preserved and detached from removed categories: ${result.detachedCourses}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
