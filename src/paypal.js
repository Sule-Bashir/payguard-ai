const BASE = process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";

async function getAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
  ).toString("base64");

  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function createOrder({ amount, currency, description }) {
  const token = await getAccessToken();

  const res = await fetch(`${BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency || "USD",
            value: Number(amount).toFixed(2)
          },
          description: description || "PayGuard AI transaction"
        }
      ],
      application_context: {
        brand_name: "PayGuard AI",
        user_action: "PAY_NOW",
        return_url: "http://localhost:3000/paypal-return",
        cancel_url: "http://localhost:3000/paypal-cancel"
      }
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal createOrder failed: ${res.status} ${text}`);
  }

  const order = await res.json();
  const approveLink = (order.links || []).find((l) => l.rel === "approve");
  return { id: order.id, status: order.status, approveUrl: approveLink && approveLink.href };
}

async function captureOrder(orderId) {
  const token = await getAccessToken();

  const res = await fetch(`${BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal captureOrder failed: ${res.status} ${text}`);
  }

  return res.json();
}

module.exports = { getAccessToken, createOrder, captureOrder };
