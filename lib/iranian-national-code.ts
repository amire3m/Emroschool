const invalidNationalCodes = new Set(["0000000000", "1111111111", "2222222222", "3333333333", "4444444444", "5555555555", "6666666666", "7777777777", "8888888888", "9999999999"]);

export function normalizeIranianNationalCode(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/\D/g, "")
    .slice(0, 10);
}

// Based on the checksum algorithm from github.com/majidh1/iranianNationalCode.
export function isValidIranianNationalCode(value: string) {
  const code = normalizeIranianNationalCode(value);
  if (!/^\d{10}$/.test(code) || invalidNationalCodes.has(code)) return false;
  const checksum = code.slice(0, 9).split("").reduce((total, digit, index) => total + Number(digit) * (10 - index), 0) % 11;
  const checkDigit = Number(code[9]);
  return checksum < 2 ? checkDigit === checksum : checkDigit === 11 - checksum;
}
