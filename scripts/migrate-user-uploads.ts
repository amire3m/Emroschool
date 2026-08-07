import { mkdir, rename } from "fs/promises";
import path from "path";
import prisma from "../lib/prisma";

const uploadsRoot = path.join(process.cwd(), "public", "uploads");
const mappings = new Map<string, string>();

async function move(oldUrl: string | null, newUrl: string) {
  if (!oldUrl || !oldUrl.startsWith("/uploads/") || mappings.has(oldUrl)) return;
  const source = path.resolve(uploadsRoot, oldUrl.slice("/uploads/".length));
  const destination = path.resolve(uploadsRoot, newUrl.slice("/uploads/".length));
  if (!source.startsWith(`${uploadsRoot}${path.sep}`) || !destination.startsWith(`${uploadsRoot}${path.sep}`)) return;
  try {
    await mkdir(path.dirname(destination), { recursive: true });
    await rename(source, destination);
    mappings.set(oldUrl, newUrl);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function main() {
  const [users, submissions, orders, attempts] = await Promise.all([
    prisma.user.findMany({ select: { id: true, avatar: true } }),
    prisma.avatarSubmission.findMany({ select: { userId: true, imageUrl: true } }),
    prisma.paymentOrder.findMany({ select: { id: true, userId: true, receiptUrl: true } }),
    prisma.paymentAttempt.findMany({ select: { receiptUrl: true, order: { select: { id: true, userId: true } } } }),
  ]);

  for (const item of users) if (item.avatar?.startsWith("/uploads/profiles/")) await move(item.avatar, `/uploads/users/profiles/${item.id}/avatar/${path.basename(item.avatar)}`);
  for (const item of submissions) if (item.imageUrl.startsWith("/uploads/profiles/")) await move(item.imageUrl, `/uploads/users/profiles/${item.userId}/avatar/${path.basename(item.imageUrl)}`);
  for (const item of orders) if (item.receiptUrl?.startsWith("/uploads/payment-receipts/")) await move(item.receiptUrl, `/uploads/users/receipts/${item.userId}/${item.id}/${path.basename(item.receiptUrl)}`);
  for (const item of attempts) if (item.receiptUrl?.startsWith("/uploads/payment-receipts/")) await move(item.receiptUrl, `/uploads/users/receipts/${item.order.userId}/${item.order.id}/${path.basename(item.receiptUrl)}`);

  await prisma.$transaction([...mappings].flatMap(([oldUrl, newUrl]) => [
    prisma.user.updateMany({ where: { avatar: oldUrl }, data: { avatar: newUrl } }),
    prisma.avatarSubmission.updateMany({ where: { imageUrl: oldUrl }, data: { imageUrl: newUrl } }),
    prisma.paymentOrder.updateMany({ where: { receiptUrl: oldUrl }, data: { receiptUrl: newUrl } }),
    prisma.paymentAttempt.updateMany({ where: { receiptUrl: oldUrl }, data: { receiptUrl: newUrl } }),
  ]));
  console.log(`Migrated ${mappings.size} user upload(s).`);
}

main().finally(() => prisma.$disconnect());
