import prisma from "@/lib/prisma";

const initialCodes = [
  ["سازمان تبلیغات", "tr405", 80],
  ["امام روح الله", "er405", 80],
  ["باب الرضاع", "B405", 60],
  ["ویژه", "405vip", 100],
  ["بسیج دانشجویی", "405basijr", 30],
  ["گروهی", "G405", 70],
  ["باشگاه امید", "Teen405", 60],
  ["هنرستان صدا و سیما", "Irib405", 30],
  ["هنرستان فرهنگ", "Farhang405", 40],
] as const;

export async function ensureDiscountCodes() {
  await Promise.all(initialCodes.map(([label, code, percent]) =>
    prisma.discountCode.upsert({
      where: { code },
      create: { label, code, percent, active: true, requiresDocument: true },
      update: {},
    }),
  ));
}

export async function findActiveDiscountCode(identifier: string, allowCode = false) {
  const value = identifier.trim().toLocaleLowerCase();
  const codes = await prisma.discountCode.findMany({ where: { active: true } });
  return codes.find((discount) =>
    (allowCode && discount.code.toLocaleLowerCase() === value) || discount.label.toLocaleLowerCase() === value,
  ) ?? null;
}
