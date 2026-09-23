const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "Wellessia Duplicate Checker is running"
  });
});

// Shopify theke access token neyar function
async function getAccessToken() {
  const response = await fetch(
    `https://${process.env.SHOPIFY_STORE}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        grant_type: "client_credentials"
      })
    }
  );
  const data = await response.json();
  return data.access_token;
}

// Manual test route (age theke ache)
app.get("/check", async (req, res) => {
  const phone = req.query.phone;
  if (!phone) return res.status(400).json({ error: "Phone number is required" });

  try {
    const token = await getAccessToken();
    const result = await checkDuplicate(phone, token);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Shopify API call failed", details: err.message });
  }
});

// Reusable duplicate-check function
async function checkDuplicate(phone, token, excludeOrderId = null) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const response = await fetch(
    `https://${process.env.SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&created_at_min=${since}`,
    { headers: { "X-Shopify-Access-Token": token } }
  );
  const data = await response.json();

  const cleanPhone = phone.replace(/\D/g, "").slice(-10);

  const matches = (data.orders || []).filter(order => {
    if (excludeOrderId && order.id === excludeOrderId) return false;
    const orderPhone = order.phone || order.customer?.phone || order.shipping_address?.phone;
    return orderPhone && orderPhone.replace(/\D/g, "").endsWith(cleanPhone);
  });

  return { phone, duplicate: matches.length > 0, matchCount: matches.length };
}

// === WEBHOOK: order create hole automatically call hobe ===
app.post("/webhooks/orders-create", async (req, res) => {
  // Shopify-ke shathe shathe response dite hobe, na hole webhook retry/fail hoy
  res.status(200).send("OK");

  try {
    const order = req.body;
    const phone = order.phone || order.customer?.phone || order.shipping_address?.phone;

    if (!phone) {
      console.log("No phone found on order", order.id);
      return;
    }

    const token = await getAccessToken();
    const result = await checkDuplicate(phone, token, order.id);

    console.log("Webhook check:", phone, "duplicate:", result.duplicate);

    if (result.duplicate) {
      // Order-e tag add korার জন্য existing tags নিয়ে নতুন tag যোগ করুন
      const existingTags = order.tags ? order.tags + ", " : "";
      const newTags = existingTags + "Duplicate";

      await fetch(
        `https://${process.env.SHOPIFY_STORE}/admin/api/2026-04/orders/${order.id}.json`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": token
          },
          body: JSON.stringify({
            order: {
              id: order.id,
              tags: newTags,
              note: (order.note ? order.note + " | " : "") + "Duplicate: same number used within 24h"
            }
          })
        }
      );

      console.log("Tagged order", order.id, "as Duplicate");
    }
  } catch (err) {
    console.log("Webhook processing error:", err.message);
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
