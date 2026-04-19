const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const SHOPIFY_STORE = "TU-TIENDA.myshopify.com";
const SHOPIFY_TOKEN = "TU_ACCESS_TOKEN";

app.post("/wompi/webhook", async (req, res) => {
  const event = req.body;

  console.log("Evento recibido:", event);

  if (event.event === "transaction.updated") {
    const transaction = event.data.transaction;

    if (transaction.status === "APPROVED") {
  const email = transaction.customer_email;
  const amount = transaction.amount_in_cents / 100;

  const order = await buscarPedido(email, amount);

  if (!order) {
    console.log("❌ No se encontró pedido");
    return;
  }

  const orderId = order.id;

      try {
        await axios.post(
          `https://${SHOPIFY_STORE}/admin/api/2024-01/orders/${orderId}/transactions.json`,
          {
            transaction: {
              kind: "capture",
              status: "success",
              amount: transaction.amount_in_cents / 100,
              gateway: "Wompi"
            }
          },
          {
            headers: {
              "X-Shopify-Access-Token": SHOPIFY_TOKEN,
              "Content-Type": "application/json"
            }
          }
        );

        console.log("✅ Pedido pagado:", orderId);
      } catch (error) {
        console.error("❌ Error:", error.response?.data || error.message);
      }
    }
  }

  res.sendStatus(200);
});

app.listen(3000, () => console.log("Servidor listo"));
async function buscarPedido(email, amount) {
  const SHOP = "TU-TIENDA.myshopify.com";
  const TOKEN = "TU_ACCESS_TOKEN";

  const response = await axios.get(
    `https://${SHOP}/admin/api/2024-01/orders.json?status=open`,
    {
      headers: {
        "X-Shopify-Access-Token": TOKEN
      }
    }
  );

  const orders = response.data.orders;

  return orders.find(order =>
    order.email === email &&
    parseFloat(order.total_price) === amount &&
    order.financial_status === "pending"
  );
}
