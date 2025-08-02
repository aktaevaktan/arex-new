import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class DatabaseService {
  // Tracking numbers management
  static async loadSentTrackingNumbers(): Promise<Set<string>> {
    try {
      const records = await prisma.sentTrackingNumber.findMany({
        select: { trackingNumber: true },
      });
      const trackingNumbers = records.map((record) => record.trackingNumber);
      console.log(
        `📋 Loaded ${trackingNumbers.length} previously sent tracking numbers from database`
      );
      return new Set(trackingNumbers);
    } catch (error) {
      console.error("❌ Error loading tracking numbers from database:", error);
      return new Set();
    }
  }

  static async addTrackingNumbers(
    trackingNumbers: string[],
    clientData?: { name?: string; phone?: string }[]
  ): Promise<void> {
    try {
      const existingNumbers = await this.loadSentTrackingNumbers();
      const newNumbers = trackingNumbers.filter(
        (num) => !existingNumbers.has(num)
      );

      if (newNumbers.length === 0) {
        console.log("📋 No new tracking numbers to add");
        return;
      }

      const data = newNumbers.map((trackingNumber, index) => ({
        trackingNumber,
        clientName: clientData?.[index]?.name || null,
        phoneNumber: clientData?.[index]?.phone || null,
      }));

      await prisma.sentTrackingNumber.createMany({
        data,
        skipDuplicates: true,
      });

      console.log(
        `✅ Added ${newNumbers.length} new tracking numbers to database`
      );
    } catch (error) {
      console.error("❌ Error adding tracking numbers to database:", error);
    }
  }

  static async isTrackingNumberSent(trackingNumber: string): Promise<boolean> {
    try {
      const record = await prisma.sentTrackingNumber.findUnique({
        where: { trackingNumber },
      });
      return !!record;
    } catch (error) {
      console.error("❌ Error checking tracking number:", error);
      return false;
    }
  }

  // Processed sheets management
  static async getLastProcessedSheet(): Promise<string | null> {
    try {
      const record = await prisma.processedSheet.findFirst({
        orderBy: { processedAt: "desc" },
      });
      return record?.sheetName || null;
    } catch (error) {
      console.error("❌ Error getting last processed sheet:", error);
      return null;
    }
  }

  static async saveProcessedSheet(sheetName: string): Promise<void> {
    try {
      await prisma.processedSheet.upsert({
        where: { sheetName },
        update: { processedAt: new Date() },
        create: { sheetName },
      });
      console.log(`✅ Saved processed sheet: ${sheetName}`);
    } catch (error) {
      console.error("❌ Error saving processed sheet:", error);
    }
  }

  // Webhook logs management
  static async addWebhookLog(logData: {
    method: string;
    url: string;
    headers: any;
    body?: any;
    status: string;
    error?: string;
  }): Promise<void> {
    try {
      await prisma.webhookLog.create({
        data: {
          method: logData.method,
          url: logData.url,
          headers: logData.headers,
          body: logData.body || null,
          status: logData.status,
          error: logData.error || null,
        },
      });
    } catch (error) {
      console.error("❌ Error adding webhook log to database:", error);
    }
  }

  static async getWebhookLogs(limit: number = 100): Promise<any[]> {
    try {
      const logs = await prisma.webhookLog.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return logs;
    } catch (error) {
      console.error("❌ Error getting webhook logs from database:", error);
      return [];
    }
  }

  static async clearWebhookLogs(): Promise<void> {
    try {
      await prisma.webhookLog.deleteMany();
      console.log("✅ Cleared all webhook logs from database");
    } catch (error) {
      console.error("❌ Error clearing webhook logs:", error);
    }
  }

  static async getWebhookStats(): Promise<{
    total: number;
    success: number;
    error: number;
  }> {
    try {
      const [total, success, error] = await Promise.all([
        prisma.webhookLog.count(),
        prisma.webhookLog.count({ where: { status: "success" } }),
        prisma.webhookLog.count({ where: { status: "error" } }),
      ]);
      return { total, success, error };
    } catch (error) {
      console.error("❌ Error getting webhook stats:", error);
      return { total: 0, success: 0, error: 0 };
    }
  }

  // User management
  static async clearAllUsers(): Promise<void> {
    try {
      await prisma.user.deleteMany();
      console.log("✅ Cleared all users from database");
    } catch (error) {
      console.error("❌ Error clearing users:", error);
    }
  }

  static async createUser(email: string, password: string): Promise<void> {
    try {
      await prisma.user.create({
        data: { email, password },
      });
      console.log(`✅ Created user: ${email}`);
    } catch (error) {
      console.error("❌ Error creating user:", error);
    }
  }

  // Storage data management (replaces storage.json)
  static async getStorageData(): Promise<Record<string, any>> {
    try {
      // For now, we don't need to store the full storage data in database
      // The tracking numbers are already stored, which is the main requirement
      // Return empty object as storage.json is no longer needed
      return {};
    } catch (error) {
      console.error("❌ Error getting storage data:", error);
      return {};
    }
  }

  static async saveStorageData(data: Record<string, any>): Promise<void> {
    try {
      // Storage data is no longer needed since we store tracking numbers directly
      // This is a no-op to maintain compatibility
      console.log(
        "📋 Storage data save skipped - using database tracking instead"
      );
    } catch (error) {
      console.error("❌ Error saving storage data:", error);
    }
  }

  // Cleanup old data (optional)
  static async cleanupOldData(daysOld: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const [deletedLogs, deletedSheets] = await Promise.all([
        prisma.webhookLog.deleteMany({
          where: { createdAt: { lt: cutoffDate } },
        }),
        prisma.processedSheet.deleteMany({
          where: { processedAt: { lt: cutoffDate } },
        }),
      ]);

      console.log(
        `🧹 Cleanup completed: ${deletedLogs.count} logs, ${deletedSheets.count} sheets deleted`
      );
    } catch (error) {
      console.error("❌ Error during cleanup:", error);
    }
  }
}

export default DatabaseService;
