const operatorPrefixes = [
  { name: "همراه اول", prefixes: ["091", "0990", "0991", "0992", "0993", "0994"] },
  { name: "ایرانسل", prefixes: ["090", "0930", "0933", "0935", "0936", "0937", "0938", "0939"] },
  { name: "رایتل", prefixes: ["0920", "0921", "0922", "0923"] },
  { name: "شاتل موبایل", prefixes: ["0998"] },
];

export function normalizeIranianMobile(value: string) {
  const digits = value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/\D/g, "");
  if (digits.startsWith("0098")) return `0${digits.slice(4, 13)}`;
  if (digits.startsWith("98")) return `0${digits.slice(2, 11)}`;
  return digits.slice(0, 11);
}

export function getIranianMobileOperator(value: string) {
  const mobile = normalizeIranianMobile(value);
  return operatorPrefixes.find((operator) => operator.prefixes.some((prefix) => mobile.startsWith(prefix)))?.name || null;
}

export function isValidIranianMobile(value: string) {
  const mobile = normalizeIranianMobile(value);
  return /^09\d{9}$/.test(mobile) && Boolean(getIranianMobileOperator(mobile));
}
