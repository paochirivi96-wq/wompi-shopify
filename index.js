const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// =======================
// VARIABLES DE ENTORNO
// =======================
const SHOPIFY_STORE = process.env.SHOPIFY_STORE; // trento-8304.myshopify.com
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;

// Token dinámico (OAuth)
let SHOPIFY_ACCESS_TOKEN_RUNTIME = null;

// =======================
// 1. INICIAR OAUTH
// =======================
app.get("/auth", (req, res) => {
  const scopes = "read_orders,write_orders";

  const redirectUri =
    "https://courteous-expression-production-4e45.up.railway.app/auth/callback";

  const installUrl = `https://${SHOPIFY_STORE}/admin/oauth/authorize?client_id=${CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}`;

  res.redirect(installUrl);
});

// =======================
// 2. CALLBACK (OBTENER TOKEN)
// =======================
app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const response = await axios.post(
      `https://${SHOPIFY_STORE}/admin/oauth/access_token`,
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      }
    );

    SHOPIFY_ACCESS_TOKEN_RUNTIME = response.data.access_token;

    console.log(
      "✅ TOKEN OBTENIDO:",
      SHOPIFY_ACCESS_TOKEN_RUNTIME?.slice(0, 10)
    );

    res.send("✅ App instalada correctamente. Ya puedes probar pagos.");
  } catch (error) {
    console.error(
      "❌ Error OAuth:",
      error.response?.data || error.message
    );
    res.status(500).send("Error en OAuth");
  }
});

// =======================
// 3. WEBHOOK WOMPI
// =======================
app.post("/wompi/webhook", async (req, res) => {
  const event = req.body;

  console.log("Evento recibido:", JSON.stringify(event, null, 2));

  if (event.event === "transaction.updated") {
    const transaction = event.data.transaction;

    if (transaction.status === "APPROVED") {
      try {
        if (!SHOPIFY_ACCESS_TOKEN_RUNTIME) {
          console.error("❌ No hay token OAuth todavía");
          return res.sendStatus(200);
        }

        await axios.post(
          `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json`,
          {
            order: {
              email: transaction.customer_email || "cliente@trento.com",
              financial_status: "paid",
              send_receipt: true,
              send_fulfillment_receipt: true,
              line_items: [
                {
                  title: "Pedido desde Wompi",
                  price: transaction.amount_in_cents / 100,
                  quantity: 1,
                },
              ],
            },
          },
          {
            headers: {
              "X-Shopify-Access-Token":
                SHOPIFY_ACCESS_TOKEN_RUNTIME,
              "Content-Type": "application/json",
            },
          }
        );

        console.log("✅ Pedido creado en Shopify");
      } catch (error) {
        console.error(
          "❌ Error creando pedido:",
          error.response?.data || error.message
        );
      }
    }
  }

  res.sendStatus(200);
});

// =======================
// 4. PÁGINA GRACIAS (PREMIUM)
// =======================
app.get("/gracias", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Pedido confirmado | Trento</title>

    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial;
        background: #f9f7f4;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
      }

      .container {
        background: white;
        padding: 50px 40px;
        border-radius: 20px;
        max-width: 480px;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0,0,0,0.08);
        animation: fadeIn 0.8s ease;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .check {
        font-size: 56px;
        margin-bottom: 20px;
      }

      h1 {
        font-size: 26px;
        margin-bottom: 10px;
        color: #111;
      }

      p {
        color: #666;
        font-size: 15px;
        margin-bottom: 30px;
        line-height: 1.5;
      }

      .divider {
        height: 1px;
        background: #eee;
        margin: 25px 0;
      }

      .info {
        font-size: 14px;
        color: #888;
        margin-bottom: 25px;
      }

      .btn {
        display: inline-block;
        background: #111;
        color: white;
        padding: 14px 22px;
        border-radius: 10px;
        text-decoration: none;
        font-size: 14px;
      }

      .btn:hover {
        background: #333;
      }

      .logo {
        font-weight: bold;
        letter-spacing: 2px;
        margin-bottom: 20px;
        color: #111;
      }
    </style>
  </head>

  <body>

    <div class="container">
      
      <div class="logo">TRENTO</div>

      <div class="check">✓</div>

      <h1>Pago confirmado</h1>

      <p>
        Tu pedido ha sido procesado correctamente.<br>
        Estamos preparando todo para enviarlo lo antes posible.
      </p>

      <div class="divider"></div>

      <div class="info">
        Recibirás un correo con los detalles de tu compra.
      </div>

      <a href="https://trento-8304.myshopify.com" class="btn">
        Volver a la tienda
      </a>

    </div>

  </body>
  </html>
  `);
});

// =======================
// SERVER
// =======================
app.listen(3000, () => console.log("🚀 Servidor listo"));
