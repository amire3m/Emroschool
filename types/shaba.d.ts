declare module "shaba" {
  const shaba: {
    convertPersianToEnglishDigits(value: string): string;
    validateCard(cardNumber: string): boolean;
    getBankFromCard(prefix: string): [string, string | null, string];
  };
  export = shaba;
}
