const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());


const SHOPIFY_STORE = "trento-8304.myshopify.com";
const SHOPIFY_TOKEN = "TU_TOKEN_AQUI";

app.post("/wompi/webhook", async (req, res) => {
  const event = req.body;

  console.log("Evento recibido:", JSON.stringify(event, null, 2));

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
              "X-Shopify-Access-Token": SHOPIFY_TOKEN,
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

app.listen(3000, () => console.log("Servidor listo"));
