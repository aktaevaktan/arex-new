import axios from "axios";
import { BatchProcessor, PerformanceMonitor } from "./performanceService";

interface WhatsAppMessage {
  chatId: string;
  message: string;
}

interface OrderInfo {
  fullName: string;
  phoneNumber: string;
  pickupPoint: string;
  trackingNumber: string;
  weight: number | null;
  price: number | null;
  status: string;
}

interface ClientOrders {
  fullName: string;
  phoneNumber: string;
  pickupPoint: string;
  orders: OrderInfo[];
}

// Performance constants
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const BATCH_SIZE = 10; // Process 10 messages at a time
const BATCH_DELAY = 2000; // 2 second delay between batches
const REQUEST_TIMEOUT = 30000; // 30 seconds timeout

class WhatsAppService {
  private apiUrl: string;
  private mediaUrl: string;
  private idInstance: string;
  private apiToken: string;

  constructor() {
    this.apiUrl = process.env.GREEN_API_URL || "";
    this.mediaUrl = process.env.GREEN_API_MEDIA_URL || "";
    this.idInstance = process.env.GREEN_API_ID_INSTANCE || "";
    this.apiToken = process.env.GREEN_API_API_TOKEN_INSTANCE || "";

    if (!this.apiUrl || !this.idInstance || !this.apiToken) {
      console.warn("⚠️ WhatsApp Green API credentials not configured");
    } else {
      console.log("✅ WhatsApp Green API configured successfully");
      console.log(`📱 Instance ID: ${this.idInstance}`);
    }
  }

  private getWorkingHours(pickupPoint: string): string {
    // Normalize pickup point for comparison (remove extra spaces, convert to lowercase)
    const normalizedPoint = pickupPoint.toLowerCase().trim();

    // Special pickup points with limited hours (10:00-19:00, closed Sunday)
    const limitedHoursPoints = [
      "7 апреля 2а/1",
      "уметалиева, 127",
      "уметалиева 127",
    ];

    // Check if current pickup point matches any limited hours location
    const isLimitedHours = limitedHoursPoints.some(
      (point) =>
        normalizedPoint.includes(point.toLowerCase()) ||
        point.toLowerCase().includes(normalizedPoint)
    );

    if (isLimitedHours) {
      return `⏰ Режим работы склада:
Пн-Сб: 10:00 - 19:00
Вс: выходной`;
    } else {
      return `⏰ Режим работы склада:
Ежедневно: 10:00 - 21:00`;
    }
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any spaces, dashes, or special characters
    const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, "");

    // If it starts with 996, it's already in international format
    if (cleaned.startsWith("996")) {
      return `${cleaned}@c.us`;
    }

    // If it starts with +996, remove the + and add @c.us
    if (cleaned.startsWith("+996")) {
      return `${cleaned.substring(1)}@c.us`;
    }

    // If it's a local Kyrgyzstan number (like 700100518), add 996 prefix
    if (cleaned.length === 9 && cleaned.match(/^[567]/)) {
      return `996${cleaned}@c.us`;
    }

    // Default: assume it needs 996 prefix
    return `996${cleaned}@c.us`;
  }

  private createOrderMessage(order: OrderInfo): string {
    const weight = order.weight ? `${order.weight} кг` : "не указан";
    const price = order.price ? `${order.price} сом` : "не указана";
    const workingHours = this.getWorkingHours(order.pickupPoint);

    return `Добрый день, ${order.fullName}! Рады сообщить что ваш товар прибыл на наш склад.

📦 Tracking номер: ${order.trackingNumber}
⚖️ Вес: ${weight}
💰 Стоимость: ${price}
📍 Забрать можно по адресу: ${order.pickupPoint}

⚠️ ВАЖНО: На пунктах выдачи оплата принимается только по QR-коду/банковскому переводу. Наличные деньги, к сожалению, не принимаются.

${workingHours}

📱 Для вопросов звоните:
+996 (500) 685 685
+996 (504) 685 685

Спасибо за ваш заказ! 🙏`;
  }

  private createMultipleOrdersMessage(clientOrders: ClientOrders): string {
    const ordersText = clientOrders.orders
      .map((order, index) => {
        return `${index + 1}. 📦 Tracking: ${order.trackingNumber}`;
      })
      .join("\n");

    // Calculate totals
    const totalWeight = clientOrders.orders.reduce((sum, order) => {
      return sum + (order.weight || 0);
    }, 0);

    const totalPrice = clientOrders.orders.reduce((sum, order) => {
      return sum + (order.price || 0);
    }, 0);

    const totalOrders = clientOrders.orders.length;
    const orderWord =
      totalOrders === 1 ? "заказ" : totalOrders < 5 ? "заказа" : "заказов";

    const totalWeightText = totalWeight > 0 ? `${totalWeight} кг` : "не указан";
    const totalPriceText = totalPrice > 0 ? `${totalPrice} сом` : "не указана";
    const workingHours = this.getWorkingHours(clientOrders.pickupPoint);

    return `Добрый день, ${clientOrders.fullName}! Рады сообщить что ваши товары прибыли на наш склад.

У вас ${totalOrders} ${orderWord}:

${ordersText}

📊 ИТОГО:
⚖️ Общий вес: ${totalWeightText}
💰 Общая стоимость: ${totalPriceText}

📍 Забрать можно по адресу: ${clientOrders.pickupPoint}

⚠️ ВАЖНО: На пунктах выдачи оплата принимается только по QR-коду/банковскому переводу. Наличные деньги, к сожалению, не принимаются.

${workingHours}

📱 Для вопросов звоните:
+996 (500) 685 685
+996 (504) 685 685

Спасибо за ваши заказы! 🙏`;
  }

  async sendMessage(chatId: string, message: string): Promise<boolean> {
    try {
      if (!this.apiUrl || !this.idInstance || !this.apiToken) {
        console.error("❌ WhatsApp API not configured");
        return false;
      }

      const url = `${this.apiUrl}/waInstance${this.idInstance}/sendMessage/${this.apiToken}`;

      const payload = {
        chatId: chatId,
        message: message,
      };

      console.log(`📱 Sending WhatsApp message to: ${chatId}`);
      console.log(`📄 Message preview: ${message.substring(0, 100)}...`);

      const response = await axios.post(url, payload, {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000,
      });

      if (response.status === 200 && response.data) {
        console.log(`✅ WhatsApp message sent successfully to ${chatId}`);
        console.log(`📊 Response:`, response.data);
        return true;
      } else {
        console.error(
          `❌ Failed to send WhatsApp message. Status: ${response.status}`
        );
        console.error(`📄 Response:`, response.data);
        return false;
      }
    } catch (error: any) {
      console.error(`❌ Error sending WhatsApp message to ${chatId}:`, error);
      if (error.response) {
        console.error(`📊 Response status: ${error.response.status}`);
        console.error(`📄 Response data:`, error.response.data);
      }
      return false;
    }
  }

  async sendOrderNotification(order: OrderInfo): Promise<boolean> {
    try {
      if (!order.phoneNumber) {
        console.log(`⚠️ No phone number provided for ${order.fullName}`);
        return false;
      }

      const chatId = this.formatPhoneNumber(order.phoneNumber);
      const message = this.createOrderMessage(order);

      console.log(`📱 Preparing to send order notification:`);
      console.log(`👤 Client: ${order.fullName}`);
      console.log(`📞 Phone: ${order.phoneNumber} -> ${chatId}`);
      console.log(`📦 Tracking: ${order.trackingNumber}`);
      console.log(`📍 Pickup: ${order.pickupPoint}`);

      return await this.sendMessage(chatId, message);
    } catch (error) {
      console.error(`❌ Error sending order notification:`, error);
      return false;
    }
  }

  async sendClientOrdersNotification(
    clientOrders: ClientOrders
  ): Promise<boolean> {
    try {
      if (!clientOrders.phoneNumber) {
        console.log(`⚠️ No phone number provided for ${clientOrders.fullName}`);
        return false;
      }

      const chatId = this.formatPhoneNumber(clientOrders.phoneNumber);
      const message =
        clientOrders.orders.length === 1
          ? this.createOrderMessage(clientOrders.orders[0])
          : this.createMultipleOrdersMessage(clientOrders);

      console.log(`📱 Preparing to send notification:`);
      console.log(`👤 Client: ${clientOrders.fullName}`);
      console.log(`📞 Phone: ${clientOrders.phoneNumber} -> ${chatId}`);
      console.log(`📦 Orders: ${clientOrders.orders.length}`);
      console.log(
        `📋 Tracking numbers: ${clientOrders.orders
          .map((o) => o.trackingNumber)
          .join(", ")}`
      );
      console.log(`📍 Pickup: ${clientOrders.pickupPoint}`);

      return await this.sendMessage(chatId, message);
    } catch (error) {
      console.error(`❌ Error sending client orders notification:`, error);
      return false;
    }
  }

  async sendBulkOrderNotifications(
    orders: OrderInfo[]
  ): Promise<{ sent: number; failed: number }> {
    const endTimer = PerformanceMonitor.startTimer(
      "bulk-whatsapp-notifications"
    );

    try {
      // Group orders by client (phone number)
      const clientOrdersMap = new Map<string, ClientOrders>();

      for (const order of orders) {
        const key = order.phoneNumber;
        if (!clientOrdersMap.has(key)) {
          clientOrdersMap.set(key, {
            fullName: order.fullName,
            phoneNumber: order.phoneNumber,
            pickupPoint: order.pickupPoint,
            orders: [],
          });
        }
        clientOrdersMap.get(key)!.orders.push(order);
      }

      const clientOrdersList = Array.from(clientOrdersMap.values());
      console.log(
        `📱 Starting bulk WhatsApp notifications for ${clientOrdersList.length} clients with ${orders.length} total orders`
      );

      // Use batch processing for better performance with large datasets
      const results = await BatchProcessor.processBatch(
        clientOrdersList,
        async (clientOrders: ClientOrders) => {
          const success = await this.sendClientOrdersNotification(clientOrders);

          // Add delay between messages to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 1000));

          return success;
        },
        BATCH_SIZE
      );

      const sent = results.filter(Boolean).length;
      const failed = clientOrdersList.length - sent;

      console.log(
        `📊 Bulk notification results: ${sent} clients notified, ${failed} failed`
      );
      return { sent, failed };
    } finally {
      endTimer();
    }
  }

  // Test method to verify API connection
  async testConnection(): Promise<boolean> {
    try {
      if (!this.apiUrl || !this.idInstance || !this.apiToken) {
        console.error("❌ WhatsApp API credentials not configured");
        return false;
      }

      const url = `${this.apiUrl}/waInstance${this.idInstance}/getSettings/${this.apiToken}`;

      const response = await axios.get(url, {
        timeout: 10000,
      });

      if (response.status === 200) {
        console.log("✅ WhatsApp API connection test successful");
        console.log("📊 Instance settings:", response.data);
        return true;
      } else {
        console.error("❌ WhatsApp API connection test failed");
        return false;
      }
    } catch (error: any) {
      console.error("❌ WhatsApp API connection test error:", error);
      return false;
    }
  }
}

// Global instance
const whatsappService = new WhatsAppService();

export default whatsappService;
export type { OrderInfo, ClientOrders };
