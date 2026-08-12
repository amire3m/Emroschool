import { fileURLToPath } from "node:url";
import prisma from "../lib/prisma";
import { enrollmentGrantSources } from "../lib/payment-review";

export async function backfillEnrollmentGrants(db: any) {
  const enrollments = await db.enrollment.findMany({ select: { id: true, userId: true, courseId: true } });
  let grantsCreated = 0;
  for (const enrollment of enrollments) {
    try {
      await db.enrollmentGrant.create({
        data: { sourceType: enrollmentGrantSources.legacy, sourceId: enrollment.id, userId: enrollment.userId, courseId: enrollment.courseId, active: true },
      });
      grantsCreated += 1;
    } catch (error) {
      if ((error as { code?: string })?.code !== "P2002") throw error;
    }
  }
  return { grantsCreated };
}

export function isDirectExecution(moduleUrl: string, argvPath = process.argv[1]) {
  return Boolean(argvPath) && fileURLToPath(moduleUrl) === argvPath;
}

if (isDirectExecution(import.meta.url)) {
  backfillEnrollmentGrants(prisma)
    .then((result) => console.log(JSON.stringify(result)))
    .finally(() => prisma.$disconnect());
}
