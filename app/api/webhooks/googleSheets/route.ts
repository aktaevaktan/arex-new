import { NextRequest, NextResponse } from "next/server";
import webhookLogger from "../../../../lib/webhookLogger";
import whatsappService, { OrderInfo } from "../../../../lib/whatsappService";
import {
  applyRateLimit,
  addSecurityHeaders,
} from "../../../../lib/rateLimiter";
import { PerformanceMonitor } from "../../../../lib/performanceService";

// Helper function to extract orders from webhook data
function extractOrdersFromWebhookData(data: any): OrderInfo[] {
  const orders: OrderInfo[] = [];

  try {
    // The data should be in format: { "clientCode": { "Ф.И.О": "...", "Номер телефона": "...", "Заказы": {...} } }
    for (const clientCode in data) {
      const clientData = data[clientCode];

      if (!clientData || typeof clientData !== "object") continue;

      const fullName = clientData["Ф.И.О"] || "Клиент";
      const phoneNumber = clientData["Номер телефона"] || "";
      const pickupPoint = clientData["Пункт выдачи"] || "Не указан";
      const clientOrders = clientData["Заказы"] || {};

      // Process each order for this client
      for (const orderId in clientOrders) {
        const order = clientOrders[orderId];

        if (!order || typeof order !== "object") continue;

        orders.push({
          fullName,
          phoneNumber,
          pickupPoint,
          trackingNumber: order["Номер отслеживания"] || "Не указан",
          weight: order["Вес заказа"] || null,
          price: order["Цена заказа"] || null,
          status: order["Статус"] || "Готов",
        });
      }
    }
  } catch (error) {
    console.error("❌ Error extracting orders from webhook data:", error);
  }

  return orders;
}

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = applyRateLimit(request, "webhook");
  if (rateLimitResponse) {
    return addSecurityHeaders(rateLimitResponse);
  }

  const endTimer = PerformanceMonitor.startTimer("webhook-processing");

  try {
    // Get the JSON body from the request
    const body = await request.json();

    // Get headers for additional context
    const headers = Object.fromEntries(request.headers.entries());

    // Log to webhook logger
    webhookLogger.addLog({
      method: request.method,
      url: request.url,
      headers,
      body,
      status: "success",
    });

    // Process WhatsApp notifications if this is order data
    let whatsappResults = { sent: 0, failed: 0 };

    if (body && typeof body === "object" && !body.test) {
      console.log("📱 Processing webhook data for WhatsApp notifications...");

      // Extract orders from the webhook data
      const orders = extractOrdersFromWebhookData(body);

      if (orders.length > 0) {
        console.log(`📦 Found ${orders.length} orders to process for WhatsApp`);
        whatsappResults = await whatsappService.sendBulkOrderNotifications(
          orders
        );
      } else {
        console.log("📋 No valid orders found in webhook data");
      }
    }

    // Return success response
    const response = NextResponse.json(
      {
        success: true,
        message: "Webhook received successfully",
        timestamp: new Date().toISOString(),
        received: body,
        whatsapp: {
          processed: whatsappResults.sent + whatsappResults.failed,
          sent: whatsappResults.sent,
          failed: whatsappResults.failed,
        },
      },
      { status: 200 }
    );

    return addSecurityHeaders(response);
  } catch (error) {
    const headers = Object.fromEntries(request.headers.entries());

    // Log error to webhook logger
    webhookLogger.addLog({
      method: request.method,
      url: request.url,
      headers,
      body: null,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    const errorResponse = NextResponse.json(
      {
        success: false,
        error: "Failed to process webhook",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );

    return addSecurityHeaders(errorResponse);
  } finally {
    endTimer();
  }
}

export async function GET(request: NextRequest) {
  const headers = Object.fromEntries(request.headers.entries());

  // Log to webhook logger
  webhookLogger.addLog({
    method: request.method,
    url: request.url,
    headers,
    body: null,
    status: "success",
  });

  return NextResponse.json(
    {
      success: true,
      message: "Google Sheets webhook endpoint is active",
      timestamp: new Date().toISOString(),
      endpoint: "/api/webhooks/googleSheets",
      methods: ["GET", "POST", "PUT", "PATCH"],
      description: "This endpoint receives and logs Google Sheets webhook data",
    },
    { status: 200 }
  );
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const timestamp = new Date().toISOString();

    console.log("\n🔔 WEBHOOK PUT REQUEST - Google Sheets");
    console.log("⏰ Timestamp:", timestamp);
    console.log("🌐 URL:", request.url);
    console.log("📋 Method:", request.method);
    console.log("📄 Body:", JSON.stringify(body, null, 2));
    console.log("─".repeat(80));

    return NextResponse.json(
      {
        success: true,
        message: "PUT webhook received successfully",
        timestamp,
        received: body,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("\n❌ WEBHOOK PUT ERROR - Google Sheets");
    console.error("⏰ Timestamp:", new Date().toISOString());
    console.error("🚨 Error:", error);
    console.log("─".repeat(80));

    return NextResponse.json(
      {
        success: false,
        error: "Failed to process PUT webhook",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const timestamp = new Date().toISOString();

    console.log("\n🔔 WEBHOOK PATCH REQUEST - Google Sheets");
    console.log("⏰ Timestamp:", timestamp);
    console.log("🌐 URL:", request.url);
    console.log("📋 Method:", request.method);
    console.log("📄 Body:", JSON.stringify(body, null, 2));
    console.log("─".repeat(80));

    return NextResponse.json(
      {
        success: true,
        message: "PATCH webhook received successfully",
        timestamp,
        received: body,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("\n❌ WEBHOOK PATCH ERROR - Google Sheets");
    console.error("⏰ Timestamp:", new Date().toISOString());
    console.error("🚨 Error:", error);
    console.log("─".repeat(80));

    return NextResponse.json(
      {
        success: false,
        error: "Failed to process PATCH webhook",
      },
      { status: 500 }
    );
  }
}
