const BALE_API_BASE = process.env.BALE_API_BASE || "https://tapi.bale.ai/bot";

function botToken() {
  const botToken = process.env.BALE_BOT_TOKEN;
  if (!botToken) throw new Error("BALE_NOT_CONFIGURED");
  return botToken;
}

function walletToken() {
  const token = process.env.BALE_WALLET_TOKEN;
  if (!token) throw new Error("BALE_NOT_CONFIGURED");
  return token;
}

async function baleCall(method: string, body: Record<string, unknown>) {
  const token = botToken();
  const response = await fetch(`${BALE_API_BASE}${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok === false) throw new Error(`BALE_${method.toUpperCase()}_FAILED`);
  return result?.result ?? result;
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
  const result = await baleCall("inquireTransaction", { transaction_id: transactionReference });
  const state = String(result?.status ?? result?.state ?? "").toLowerCase();
  return { result, verified: result?.success === true || result?.paid === true || ["paid", "success", "successful", "completed"].includes(state) };
}
