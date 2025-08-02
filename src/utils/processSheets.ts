import { google, sheets_v4 } from "googleapis";
// import fs from "fs/promises"; // Removed - using database storage for Vercel compatibility
// import path from "path"; // Removed - no file system operations needed
import DatabaseService from "../../lib/databaseService";
import whatsappService from "../../lib/whatsappService";
import axios from "axios";

interface ClientInfo {
  "Ф.И.О": string;
  "Номер телефона": string;
  "Пункт выдачи": string;
}

interface Order {
  Статус: string;
  "Вес заказа": number | null;
  "Цена заказа": number | null;
  "Номер отслеживания": string;
}

interface ClientOrders {
  "Ф.И.О": string;
  "Номер телефона": string;
  "Пункт выдачи": string;
  Заказы: Record<string, Order>;
}

interface ProcessResult {
  success: boolean;
  message: string;
}

// Configuration from environment variables
const SKLAD_SPREADSHEET_ID = process.env.SPREADSHEET_ID as string;
const CLIENTS_SPREADSHEET_ID = "1gp3KJYHLHB4tOR-yJVPwTeUYmfBoLYZHuuSEYlvnyGg";
// Storage file no longer needed - using database
const WEBHOOK_URL = `${
  process.env.NEXTAUTH_URL || "http://localhost:3001"
}/api/webhooks/googleSheets`;

// Debug configuration
console.log("🔧 Configuration loaded:");
console.log("📊 SKLAD_SPREADSHEET_ID:", SKLAD_SPREADSHEET_ID);
console.log("👥 CLIENTS_SPREADSHEET_ID:", CLIENTS_SPREADSHEET_ID);
console.log("🔗 WEBHOOK_URL:", WEBHOOK_URL);

// Google Sheets authentication
let auth: any;
let sheets: any;

try {
  console.log("🔐 Setting up Google Sheets authentication...");

  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error("Missing Google credentials in environment variables");
  }

  auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });

  sheets = google.sheets({ version: "v4", auth });
  console.log("✅ Google Sheets authentication configured successfully");
} catch (error) {
  console.error("❌ Failed to setup Google Sheets authentication:", error);
}

// Database-based tracking number management
const loadSentTrackingNumbers = async (): Promise<Set<string>> => {
  return await DatabaseService.loadSentTrackingNumbers();
};

const addTrackingNumbers = async (
  newTrackingNumbers: string[],
  clientData?: Array<{ name?: string; phone?: string }>
): Promise<void> => {
  await DatabaseService.addTrackingNumbers(newTrackingNumbers, clientData);
};

// Helper functions - removed unused functions for production optimization

// Database-based storage operations (replaces JSON files)
const saveStorageData = async (
  data: Record<string, ClientOrders>
): Promise<void> => {
  await DatabaseService.saveStorageData(data);
};

const saveLastProcessedSheet = async (sheetName: string): Promise<void> => {
  await DatabaseService.saveProcessedSheet(sheetName);
};

const buildClientMap = async (): Promise<Record<string, ClientInfo>> => {
  try {
    console.log("🔍 Building client map from spreadsheet...");

    if (!sheets) {
      throw new Error("Google Sheets not initialized");
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CLIENTS_SPREADSHEET_ID,
      range: "Клиенты",
    });

    const rows = response.data.values || [];
    console.log(`📋 Found ${rows.length} rows in client sheet`);

    if (rows.length === 0) {
      console.warn("⚠️ No data found in client sheet");
      return {};
    }

    const headers = rows[0] || [];
    console.log("📊 Headers found:", headers);

    const clientMap: Record<string, ClientInfo> = {};

    const getColumnIndex = (headerName: string) => {
      const index = headers.findIndex((h: string) => h === headerName);
      if (index === -1) {
        console.warn(`⚠️ Column "${headerName}" not found in headers`);
      }
      return index;
    };

    let processedCount = 0;
    for (const row of rows.slice(1)) {
      const codeIndex = getColumnIndex("181");
      const code =
        codeIndex >= 0 ? (row[codeIndex] || "").toString().trim() : "";

      if (code) {
        clientMap[code] = {
          "Ф.И.О": (row[getColumnIndex("Ф.И.О")] || "").toString().trim(),
          "Номер телефона": (row[getColumnIndex("Номер телефона")] || "")
            .toString()
            .trim(),
          "Пункт выдачи": (row[getColumnIndex("Пункт выдачи")] || "")
            .toString()
            .trim(),
        };
        processedCount++;
      }
    }

    console.log(`✅ Successfully processed ${processedCount} clients`);
    return clientMap;
  } catch (error) {
    console.error("❌ Error building client map:", error);
    console.error("📋 This might be due to:");
    console.error("  - Invalid CLIENTS_SPREADSHEET_ID");
    console.error("  - Missing 'Клиенты' sheet");
    console.error("  - Authentication issues");
    console.error("  - Network connectivity problems");
    return {};
  }
};

const isValidTrackNumber = (trackNumber: string): boolean =>
  !!(trackNumber && trackNumber.trim().length > 0);

const processOrders = async (
  sheet: sheets_v4.Schema$Sheet,
  clientMap: Record<string, ClientInfo>
): Promise<Record<string, ClientOrders>> => {
  try {
    const sheetTitle = sheet.properties?.title;
    if (!sheetTitle) throw new Error("Sheet title is missing");

    console.log(`📊 Processing orders from sheet: ${sheetTitle}`);

    if (!sheets) {
      throw new Error("Google Sheets not initialized");
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SKLAD_SPREADSHEET_ID,
      range: sheetTitle,
    });

    const rows = response.data.values || [];
    console.log(`📋 Found ${rows.length} rows in order sheet`);

    if (rows.length === 0) {
      console.warn("⚠️ No data found in order sheet");
      return {};
    }

    const storage: Record<string, ClientOrders> = {};
    let processedOrders = 0;
    let skippedOrders = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      if (!row || row.length < 4) {
        console.log(
          `⚠️ Row ${i + 1}: Insufficient columns (${
            row?.length || 0
          }/4) - need at least tracking number and client code`
        );
        skippedOrders++;
        continue;
      }

      // Extract data from available columns
      const status = row[0] ? row[0].toString().trim() : "";
      const trackNumber = row[2] ? row[2].toString().trim() : "";
      const clientCode = row[3] ? row[3].toString().trim() : "";
      const weightOfOrder = row[4] ? row[4].toString().trim() : "";
      const priceOfOrder = row[7] ? row[7].toString().trim() : "";

      // Validation with detailed logging
      if (!trackNumber) {
        console.log(`⚠️ Row ${i + 1}: Missing tracking number`);
        skippedOrders++;
        continue;
      }

      if (!clientCode) {
        console.log(`⚠️ Row ${i + 1}: Missing client code`);
        skippedOrders++;
        continue;
      }

      if (!isValidTrackNumber(trackNumber)) {
        console.log(
          `⚠️ Row ${i + 1}: Empty or invalid tracking number: ${trackNumber}`
        );
        skippedOrders++;
        continue;
      }

      if (!clientMap[clientCode]) {
        console.log(
          `⚠️ Row ${i + 1}: Client code not found in client map: ${clientCode}`
        );
        skippedOrders++;
        continue;
      }

      // Create client entry if doesn't exist
      if (!storage[clientCode]) {
        storage[clientCode] = {
          "Ф.И.О": clientMap[clientCode]["Ф.И.О"],
          "Номер телефона": clientMap[clientCode]["Номер телефона"],
          "Пункт выдачи": clientMap[clientCode]["Пункт выдачи"],
          Заказы: {},
        };
      }

      // Add order
      const existingOrders = storage[clientCode].Заказы;
      const orderId = Object.keys(existingOrders).length
        ? Math.max(...Object.keys(existingOrders).map(Number)) + 1
        : 1;

      storage[clientCode].Заказы[orderId] = {
        Статус: status || "Неизвестно",
        "Вес заказа": weightOfOrder
          ? parseFloat(weightOfOrder.replace(",", "."))
          : null,
        "Цена заказа": priceOfOrder
          ? parseFloat(priceOfOrder.replace(",", "."))
          : null,
        "Номер отслеживания": trackNumber,
      };

      processedOrders++;
    }

    console.log(
      `✅ Processed ${processedOrders} orders, skipped ${skippedOrders} orders`
    );
    console.log(`👥 Found orders for ${Object.keys(storage).length} clients`);

    return storage;
  } catch (error) {
    console.error("❌ Error processing orders:", error);
    console.error("📋 This might be due to:");
    console.error("  - Invalid SKLAD_SPREADSHEET_ID");
    console.error("  - Missing or renamed sheet");
    console.error("  - Authentication issues");
    console.error("  - Network connectivity problems");
    return {};
  }
};

// Removed unused getSentTracks function for production optimization

// Direct WhatsApp notification function
const sendWhatsAppNotifications = async (
  data: Record<string, ClientOrders>
): Promise<{ sent: number; failed: number }> => {
  try {
    console.log(
      `📱 Starting WhatsApp notifications for ${
        Object.keys(data).length
      } clients...`
    );

    // Convert data to WhatsApp service format
    const orders = [];
    for (const clientCode in data) {
      const client = data[clientCode];
      for (const orderKey in client.Заказы) {
        const order = client.Заказы[orderKey];
        orders.push({
          fullName: client["Ф.И.О"],
          phoneNumber: client["Номер телефона"],
          pickupPoint: client["Пункт выдачи"],
          trackingNumber: order["Номер отслеживания"],
          weight: order["Вес заказа"],
          price: order["Цена заказа"],
          status: order.Статус,
        });
      }
    }

    console.log(
      `📦 Prepared ${orders.length} orders for WhatsApp notifications`
    );

    // Send bulk notifications using WhatsApp service
    const result = await whatsappService.sendBulkOrderNotifications(orders);

    console.log(
      `📊 WhatsApp notification results: ${result.sent} sent, ${result.failed} failed`
    );
    return result;
  } catch (error) {
    console.error("❌ Error sending WhatsApp notifications:", error);
    return { sent: 0, failed: Object.keys(data).length };
  }
};

const sendToServer = async (
  data: Record<string, ClientOrders>
): Promise<ProcessResult> => {
  // Check if webhook URL is configured
  if (!WEBHOOK_URL || WEBHOOK_URL.trim() === "") {
    console.log("📡 No webhook URL configured, skipping webhook call");
    return {
      success: true,
      message: "Data processed successfully (no webhook configured)",
    };
  }

  try {
    console.log(`📡 Sending data to webhook: ${WEBHOOK_URL}`);
    console.log(`📦 Sending data for ${Object.keys(data).length} clients`);

    const response = await axios.post(WEBHOOK_URL, data, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Topex-Logistics-Bot/1.0",
      },
      timeout: 30000, // 30 second timeout
    });

    console.log(`✅ Data successfully sent to server: ${WEBHOOK_URL}`);
    console.log(`📊 Response status: ${response.status}`);
    console.log(`📄 Response data:`, response.data);

    return { success: true, message: "Data sent successfully" };
  } catch (error: any) {
    console.error(`❌ Error sending data to webhook:`, error);

    if (error.response) {
      console.error(`📊 Response status: ${error.response.status}`);
      console.error(`📄 Response data:`, error.response.data);
      return {
        success: false,
        message: `Webhook error (${error.response.status}): ${
          error.response.data?.message || error.message
        }`,
      };
    } else if (error.request) {
      console.error(`📡 No response received from webhook`);
      return {
        success: false,
        message: `No response from webhook server. Check if server is running.`,
      };
    } else {
      console.error(`⚙️ Request setup error:`, error.message);
      return {
        success: false,
        message: `Request error: ${error.message}`,
      };
    }
  }
};

// Removed unused appendOrdersToJson function for production optimization

export const processAndSendSheetData = async (
  selectedSheet: string
): Promise<ProcessResult> => {
  try {
    console.log(`🔄 Starting to process selected sheet: ${selectedSheet}`);

    // Validate inputs
    if (!selectedSheet || selectedSheet.trim() === "") {
      return { success: false, message: "Sheet name is required" };
    }

    if (!SKLAD_SPREADSHEET_ID) {
      return {
        success: false,
        message: "SPREADSHEET_ID not configured in environment",
      };
    }

    if (!sheets) {
      return {
        success: false,
        message: "Google Sheets authentication not initialized",
      };
    }

    // Note: Using database storage instead of file system (Vercel compatible)
    console.log("📁 Using database storage (serverless compatible)");

    // Validate that the selected sheet exists
    console.log(
      `🔍 Searching for sheet "${selectedSheet}" in spreadsheet ${SKLAD_SPREADSHEET_ID}`
    );

    const response = await sheets.spreadsheets.get({
      spreadsheetId: SKLAD_SPREADSHEET_ID,
    });

    const sheetsList = response.data.sheets || [];
    console.log(`📋 Found ${sheetsList.length} sheets in spreadsheet`);
    console.log(
      `📋 Available sheets:`,
      sheetsList.map((s: any) => s.properties?.title)
    );

    const targetSheet = sheetsList.find(
      (sheet: any) => sheet.properties?.title === selectedSheet
    );

    if (!targetSheet || !targetSheet.properties?.title) {
      return {
        success: false,
        message: `Sheet "${selectedSheet}" not found. Available sheets: ${sheetsList
          .map((s: any) => s.properties?.title)
          .join(", ")}`,
      };
    }

    console.log(`✅ Found sheet: ${selectedSheet}`);

    // Load tracking data and client map
    const sentTrackingNumbers = await loadSentTrackingNumbers();
    const clientMap = await buildClientMap();

    console.log(
      `📊 Building client map... Found ${Object.keys(clientMap).length} clients`
    );
    console.log(
      `📋 Previously sent tracking numbers: ${sentTrackingNumbers.size}`
    );

    // Process all orders from the sheet
    console.log(`🔄 Processing sheet: ${selectedSheet}`);
    const storage = await processOrders(targetSheet, clientMap);

    if (!Object.keys(storage).length) {
      return { success: false, message: "No valid orders to process." };
    }

    // Filter out orders that were already sent
    const newToSend: Record<string, ClientOrders> = {};
    let newCount = 0;
    let alreadySentCount = 0;

    for (const clientCode in storage) {
      const newOrders: Record<string, Order> = {};
      for (const [orderId, order] of Object.entries(
        storage[clientCode].Заказы
      )) {
        const trackingNumber = order["Номер отслеживания"];
        if (!sentTrackingNumbers.has(trackingNumber)) {
          newOrders[orderId] = order;
          newCount++;
        } else {
          alreadySentCount++;
          console.log(
            `⏭️ Skipping already sent tracking number: ${trackingNumber}`
          );
        }
      }

      if (Object.keys(newOrders).length > 0) {
        newToSend[clientCode] = {
          "Ф.И.О": storage[clientCode]["Ф.И.О"],
          "Номер телефона": storage[clientCode]["Номер телефона"],
          "Пункт выдачи": storage[clientCode]["Пункт выдачи"],
          Заказы: newOrders,
        };
      }
    }

    console.log(`📊 Processing summary:`);
    console.log(`  - Total orders found: ${newCount + alreadySentCount}`);
    console.log(`  - New orders to send: ${newCount}`);
    console.log(`  - Already sent orders: ${alreadySentCount}`);

    if (newCount > 0) {
      console.log(`📤 Processing ${newCount} new orders...`);

      // Prepare tracking numbers and client data
      const newTrackingNumbers: string[] = [];
      const clientData: Array<{ name?: string; phone?: string }> = [];
      for (const clientCode in newToSend) {
        const client = newToSend[clientCode];
        for (const order of Object.values(client.Заказы)) {
          newTrackingNumbers.push(order["Номер отслеживания"]);
          clientData.push({
            name: client["Ф.И.О"],
            phone: client["Номер телефона"],
          });
        }
      }

      // Send WhatsApp notifications directly
      console.log("📱 Sending WhatsApp notifications...");
      const whatsappResult = await sendWhatsAppNotifications(newToSend);

      // Try to send to webhook (optional, for external integrations)
      const sendResult = await sendToServer(newToSend);

      let notificationMessage = "";
      if (whatsappResult.sent > 0) {
        notificationMessage = ` WhatsApp sent: ${whatsappResult.sent}/${
          whatsappResult.sent + whatsappResult.failed
        }.`;
      } else {
        notificationMessage = ` WhatsApp failed: ${whatsappResult.failed} messages not sent.`;
      }

      if (sendResult.success) {
        notificationMessage += " Webhook notification sent.";
      } else {
        console.log(
          `⚠️ Webhook failed but continuing with database save: ${sendResult.message}`
        );
      }

      // Always save to database regardless of webhook result
      await addTrackingNumbers(newTrackingNumbers, clientData);
      await saveStorageData(storage);
      await saveLastProcessedSheet(selectedSheet);

      return {
        success: true,
        message: `✅ Successfully processed ${newCount} new orders. ${alreadySentCount} orders were already sent before.${notificationMessage}`,
      };
    }

    return {
      success: true,
      message: `📋 No new orders to send. All ${alreadySentCount} orders were already sent before.`,
    };
  } catch (error: any) {
    console.error("❌ Error processing sheet:", error);
    return { success: false, message: `Error: ${error.message}` };
  }
};
