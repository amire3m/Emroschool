const MAX_TRANSACTION_ATTEMPTS = 3;

export function isRetryablePaymentTransactionError(error: unknown, retryUniqueConflict = false) {
  const code = String((error as { code?: unknown })?.code || "");
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return ["P1008", "P2024", "P2034", "SQLITE_BUSY", "SQLITE_LOCKED"].includes(code) ||
    (retryUniqueConflict && ["P2002", "P2025"].includes(code)) ||
    /database (?:table )?is locked/.test(message);
}

export function isSqliteContentionError(error: unknown) {
  const code = String((error as { code?: unknown })?.code || "");
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return ["SQLITE_BUSY", "SQLITE_LOCKED"].includes(code) || /database (?:table )?is locked/.test(message);
}

export async function runPaymentTransaction<T>(
  db: { $transaction: <R>(callback: (tx: any) => Promise<R>) => Promise<R> },
  callback: (tx: any, transactionAttempt: number) => Promise<T>,
  options: { retryUniqueConflict?: boolean } = {},
) {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await db.$transaction((tx) => callback(tx, attempt));
    } catch (error) {
      if (!isRetryablePaymentTransactionError(error, options.retryUniqueConflict) || attempt === MAX_TRANSACTION_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 10));
    }
  }
  throw new Error("PAYMENT_TRANSACTION_RETRY_EXHAUSTED");
}
