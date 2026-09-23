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

app.get("/check", (req, res) => {
  const phone = req.query.phone;

  if (!phone) {
    return res.status(400).json({
      error: "Phone number is required"
    });
  }

  res.json({
    phone: phone,
    duplicate: false,
    message: "Shopify connection is not added yet"
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
