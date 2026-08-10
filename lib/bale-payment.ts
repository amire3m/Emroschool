const BALE_API_BASE = process.env.BALE_API_BASE || "https://tapi.bale.ai/bot";
const BALE_HTTP_TIMEOUT_MS = 8_000;

export type BaleDeliveryStatus = "definitive_rejection" | "delivery_uncertain";

export class BaleApiError extends Error {
  readonly baleDeliveryStatus: BaleDeliveryStatus;

  constructor(message: string, baleDeliveryStatus: BaleDeliveryStatus) {
    super(message);
    this.name = "BaleApiError";
    this.baleDeliveryStatus = baleDeliveryStatus;
  }
}

export function isDefinitiveBaleApiRejection(error: unknown) {
  return error instanceof Error &&
    (error as Error & { baleDeliveryStatus?: unknown }).baleDeliveryStatus === "definitive_rejection";
}

function botToken() {
  const botToken = process.env.BALE_BOT_TOKEN;
  if (!botToken) throw new BaleApiError("BALE_NOT_CONFIGURED", "definitive_rejection");
  return botToken;
}

function walletToken() {
  const token = process.env.BALE_WALLET_TOKEN;
  if (!token) throw new BaleApiError("BALE_NOT_CONFIGURED", "definitive_rejection");
  return token;
}

async function baleCall(method: string, body: Record<string, unknown>) {
  const token = botToken();
  let response: Response;
  try {
    response = await fetch(`${BALE_API_BASE}${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(BALE_HTTP_TIMEOUT_MS),
    });
  } catch (error) {
    const detail = error instanceof Error ? redactTokens(error.message) : "request failed";
    throw new BaleApiError(`BALE_${method.toUpperCase()}_FAILED: ${detail}`, "delivery_uncertain");
  }
  const result = await response.json().catch(() => null);
  const envelope = result && typeof result === "object" && !Array.isArray(result) ? result as Record<string, unknown> : null;
  if (!response.ok || envelope?.ok === false) {
    const providerCode = envelope?.error_code ? ` ${String(envelope.error_code)}` : "";
    const providerDescription = envelope?.description ?? envelope?.error ?? envelope?.message ?? response.statusText;
    const detail = redactTokens(String(providerDescription || "provider rejected request"));
    throw new BaleApiError(
      `BALE_${method.toUpperCase()}_FAILED: HTTP ${response.status}${providerCode} ${detail}`,
      "definitive_rejection",
    );
  }
  if (!envelope || envelope.ok !== true || !Object.prototype.hasOwnProperty.call(envelope, "result")) {
    throw new BaleApiError(`BALE_${method.toUpperCase()}_PROTOCOL_ERROR`, "delivery_uncertain");
  }
  return envelope.result;
}

function redactTokens(value: string) {
  return [process.env.BALE_BOT_TOKEN, process.env.BALE_WALLET_TOKEN]
    .filter((token): token is string => Boolean(token))
    .reduce((safe, token) => safe.split(token).join("[REDACTED]"), value);
}

export async function createInvoiceLink(input: { title: string; description: string; payload: string; amountRials: number }) {
  const token = walletToken();
  return baleCall("createInvoiceLink", {
    title: input.title.slice(0, 32),
    description: input.description.slice(0, 255),
    payload: input.payload,
    provider_token: token,
    currency: "IRR",
    prices: [{ label: input.title.slice(0, 32), amount: input.amountRials }],
  }) as Promise<string>;
}

export async function sendMessage(chatId: string, text: string) {
  return baleCall("sendMessage", { chat_id: chatId, text });
}

export async function sendInvoice(chatId: string, input: { title: string; description: string; payload: string; amountRials: number }) {
  return baleCall("sendInvoice", {
    chat_id: chatId,
    title: input.title.slice(0, 32),
    description: input.description.slice(0, 255),
    payload: input.payload,
    provider_token: walletToken(),
    currency: "IRR",
    prices: [{ label: input.title.slice(0, 32), amount: input.amountRials }],
  });
}

export async function answerPreCheckoutQuery(id: string, ok: boolean, errorMessage?: string) {
  return baleCall("answerPreCheckoutQuery", { pre_checkout_query_id: id, ok, ...(errorMessage ? { error_message: errorMessage } : {}) });
}

export async function inquireTransaction(transactionReference: string) {
  const result = await baleCall("inquireTransaction", { transaction_id: transactionReference }) as {
    status?: unknown;
    state?: unknown;
    success?: unknown;
    paid?: unknown;
  };
  const state = String(result?.status ?? result?.state ?? "").toLowerCase();
  return { result, verified: result?.success === true || result?.paid === true || ["paid", "success", "successful", "completed"].includes(state) };
}
