import shaba from "shaba";

export function getIranianCardInfo(value: string) {
  const cardNumber = shaba.convertPersianToEnglishDigits(value).replace(/\D/g, "");
  if (!shaba.validateCard(cardNumber)) return null;
  const [bankSlug, bankPrefix, bankName] = shaba.getBankFromCard(cardNumber.slice(0, 6));
  return {
    cardNumber,
    bankSlug: bankPrefix ? bankSlug : "unknown",
    bankName: bankPrefix ? bankName : "بانک نامشخص",
    maskedCardNumber: `${cardNumber.slice(0, 6)}******${cardNumber.slice(-4)}`,
  };
}
