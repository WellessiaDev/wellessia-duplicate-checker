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

app.get("/check", async (req, res) => {
  const phone = req.query.phone;

  // Security check
  if (req.headers["x-api-key"] !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!phone) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  try {
    const token = await getAccessToken();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const response = await fetch(
      `https://${process.env.SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&created_at_min=${since}`,
      { headers: { "X-Shopify-Access-Token": token } }
    );
    const data = await response.json();

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);

    const match = data.orders?.some(order => {
      const orderPhone = order.phone || order.customer?.phone || order.shipping_address?.phone;
      return orderPhone && orderPhone.replace(/\D/g, "").endsWith(cleanPhone);
    });

    res.json({ phone, duplicate: !!match });
  } catch (err) {
    res.status(500).json({ error: "Shopify API call failed", details: err.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
