export function applyDiscountToAmount(priceTomans: number, discountPercent: number): number {
  const percent = Number.isFinite(discountPercent) && discountPercent > 0 ? discountPercent : 0;
  return Math.round(priceTomans * (100 - percent) / 100);
}

export interface DiscountLookup {
  code: string;
  label: string;
  percent: number;
  requiresDocument?: boolean;
}

export function resolveDiscountFields(
  discount: DiscountLookup | null,
): { discountCode: string | null; discountLabel: string | null; discountPercent: number } {
  if (!discount) {
    return { discountCode: null, discountLabel: null, discountPercent: 0 };
  }
  return {
    discountCode: discount.code,
    discountLabel: discount.label,
    discountPercent: discount.percent,
  };
}
