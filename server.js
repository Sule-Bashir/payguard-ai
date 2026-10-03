require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { analyzePurchaseIntent } = require("./src/ai");
const { evaluateTransaction } = require("./src/policy");
const { createOrder, captureOrder } = require("./src/paypal");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// In-memory audit trail (per server session)
const auditLog = [];

function recordAudit(entry) {
  auditLog.push(Object.assign({ timestamp: new Date().toISOString() }, entry));
  if (auditLog.length > 200) auditLog.shift();
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, project: "PayGuard AI" });
});

app.post("/api/analyze", async (req, res) => {
  try {
    const { intent } = req.body;
    if (!intent) return res.status(400).json({ error: "Intent required" });
    const policy = await analyzePurchaseIntent(intent);
    recordAudit({
      type: "POLICY_CREATED",
      intent,
      policy
    });
    res.json({ success: true, policy });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/evaluate", (req, res) => {
  try {
    const { policy, transaction } = req.body;
    if (!policy || !transaction) {
      return res.status(400).json({ error: "policy and transaction required" });
    }
    const result = evaluateTransaction(policy, transaction);
    recordAudit({
      type: "DECISION",
      decision: result.decision,
      transaction: result.transaction_snapshot,
      reasons: result.reasons
    });
    res.json({ success: true, result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/paypal/create-order", async (req, res) => {
  try {
    const { amount, currency, description } = req.body;
    if (amount == null) return res.status(400).json({ error: "amount required" });
    const order = await createOrder({ amount, currency, description });
    recordAudit({
      type: "PAYPAL_ORDER_CREATED",
      orderId: order.id,
      amount,
      currency: currency || "USD",
      description
    });
    res.json({ success: true, order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/paypal/capture-order", async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: "orderId required" });
    const capture = await captureOrder(orderId);

    let captureId = null;
    let amount = null;
    let fee = null;
    let net = null;
    try {
      const c = capture.purchase_units[0].payments.captures[0];
      captureId = c.id;
      amount = c.amount.value;
      fee = c.seller_receivable_breakdown ? c.seller_receivable_breakdown.paypal_fee.value : null;
      net = c.seller_receivable_breakdown ? c.seller_receivable_breakdown.net_amount.value : null;
    } catch (e) { /* ignore */ }

    recordAudit({
      type: "PAYMENT_CAPTURED",
      orderId,
      captureId,
      amount,
      fee,
      net,
      status: capture.status
    });

    res.json({ success: true, capture });
  } catch (error) {
    console.error("CAPTURE ERROR:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Audit log JSON (for programmatic access)
app.get("/api/audit", (req, res) => {
  res.json({ success: true, count: auditLog.length, entries: auditLog });
});

// Audit log human view
app.get("/audit", (req, res) => {
  res.sendFile(__dirname + "/public/audit.html");
});

app.get("/paypal-return", (req, res) => {
  const { token } = req.query;
  res.send(`
    <html><body style="font-family:Arial;padding:40px;max-width:600px;margin:auto">
      <h2>PayPal approval complete</h2>
      <p>Order ID: <code>${token || "unknown"}</code></p>
      <p>Return to the PayGuard AI tab to finish capturing the payment.</p>
      <p><a href="/">Back to PayGuard AI</a></p>
    </body></html>
  `);
});

app.get("/paypal-cancel", (req, res) => {
  res.send(`
    <html><body style="font-family:Arial;padding:40px;max-width:600px;margin:auto">
      <h2>PayPal approval cancelled</h2>
      <p>No payment was made.</p>
      <p><a href="/">Back to PayGuard AI</a></p>
    </body></html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PayGuard running on port ${PORT}`));
