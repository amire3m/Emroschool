export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerPushSubscription(
  token: string,
  subscription: PushSubscription,
): Promise<Response> {
  const keys = subscription.toJSON().keys;
  return fetch("/api/push/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: keys || {},
      userAgent: navigator.userAgent,
    }),
  });
}

export async function unregisterPushSubscription(token: string, endpoint: string): Promise<Response> {
  return fetch("/api/push/unregister", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ endpoint }),
  });
}
