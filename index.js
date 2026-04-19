const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// Variables
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const SHOP = "trento-8304.myshopify.com";
const REDIRECT_URI = "https://courteous-expression-production-4e45.up.railway.app/auth/callback";

// Token en memoria
let SHOPIFY_ACCESS_TOKEN_RUNTIME = null;


// =====================
// WEBHOOK WOMPI
// =====================
app.post("/wompi/webhook", async (req, res) => {
  const event = req.body;

  console.log("Evento recibido:", JSON.stringify(event, null, 2));

  if (!SHOPIFY_ACCESS_TOKEN_RUNTIME) {
    console.log("❌ No hay token aún. Ejecuta /auth primero");
    return res.sendStatus(200);
  }

  if (event.event === "transaction.updated") {
    const transaction = event.data.transaction;

    if (transaction.status === "APPROVED") {
      try {
        await axios.post(
          `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json`,
          {
            order: {
              email: transaction.customer_email,
              financial_status: "paid",
              send_receipt: true,
              send_fulfillment_receipt: true,
              line_items: [
                {
                  title: "Pedido desde Wompi",
                  price: transaction.amount_in_cents / 100,
                  quantity: 1
                }
              ]
            }
          },
          {
            headers: {
              "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN_RUNTIME,
              "Content-Type": "application/json"
            }
          }
        );

        console.log("✅ Pedido creado en Shopify");
      } catch (error) {
        console.error("❌ Error creando pedido:", error.response?.data || error.message);
      }
    }
  }

  res.sendStatus(200);
});


// =====================
// OAUTH SHOPIFY
// =====================

// 1. Iniciar instalación
app.get("/auth", (req, res) => {
  const scopes = "read_orders,write_orders";

  const url = `https://${SHOP}/admin/oauth/authorize?client_id=${CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  res.redirect(url);
});

// 2. Callback
app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const response = await axios.post(
      `https://${SHOP}/admin/oauth/access_token`,
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code
      }
    );

    SHOPIFY_ACCESS_TOKEN_RUNTIME = response.data.access_token;

    console.log("✅ TOKEN OBTENIDO:", SHOPIFY_ACCESS_TOKEN_RUNTIME?.slice(0, 10));

    res.send("App instalada correctamente 🎉");
  } catch (err) {
    console.error("❌ Error OAuth:", err.response?.data || err.message);
    res.status(500).send("Error en OAuth");
  }
});


app.listen(3000, () => console.log("Servidor listo"));

console.log("CLIENT_ID:", process.env.SHOPIFY_CLIENT_ID);
