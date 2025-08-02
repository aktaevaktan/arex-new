import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

async function migrateDataToDatabase() {
  console.log("🚀 Starting database migration and setup...");

  try {
    // 1. Clear all existing users
    console.log("🗑️ Clearing existing users...");
    await prisma.user.deleteMany();

    // 2. Create new user
    console.log("👤 Creating new user...");
    const hashedPassword = await bcrypt.hash("12345", 10);
    await prisma.user.create({
      data: {
        email: "Kasymbek0v650@gmail.com",
        password: hashedPassword,
      },
    });
    console.log("✅ Created user: Kasymbek0v650@gmail.com");

    // 3. Migrate tracking numbers from JSON file
    console.log("📋 Migrating tracking numbers...");
    const trackingFilePath = path.join(
      process.cwd(),
      "src/data/sent_tracking_numbers.json"
    );
    try {
      const trackingData = await fs.readFile(trackingFilePath, "utf-8");
      const trackingNumbers = JSON.parse(trackingData);

      if (Array.isArray(trackingNumbers) && trackingNumbers.length > 0) {
        const trackingRecords = trackingNumbers.map((trackingNumber) => ({
          trackingNumber,
          sentAt: new Date(),
        }));

        await prisma.sentTrackingNumber.createMany({
          data: trackingRecords,
          skipDuplicates: true,
        });
        console.log(`✅ Migrated ${trackingNumbers.length} tracking numbers`);
      } else {
        console.log("📋 No tracking numbers to migrate");
      }
    } catch (error) {
      console.log("📋 No existing tracking numbers file found, starting fresh");
    }

    // 4. Migrate last processed sheet
    console.log("📄 Migrating last processed sheet...");
    const lastSheetPath = path.join(
      process.cwd(),
      "src/data/last_processed_sheet.txt"
    );
    try {
      const lastSheet = await fs.readFile(lastSheetPath, "utf-8");
      if (lastSheet.trim()) {
        await prisma.processedSheet.create({
          data: {
            sheetName: lastSheet.trim(),
            processedAt: new Date(),
          },
        });
        console.log(`✅ Migrated last processed sheet: ${lastSheet.trim()}`);
      }
    } catch (error) {
      console.log("📄 No last processed sheet found");
    }

    // 5. Clear old webhook logs (if any exist in files)
    console.log("🧹 Clearing old webhook logs...");
    await prisma.webhookLog.deleteMany();
    console.log("✅ Webhook logs cleared");

    console.log("🎉 Database migration and setup completed successfully!");

    // 6. Display summary
    const stats = await Promise.all([
      prisma.user.count(),
      prisma.sentTrackingNumber.count(),
      prisma.processedSheet.count(),
      prisma.webhookLog.count(),
    ]);

    console.log("\n📊 Database Summary:");
    console.log(`👥 Users: ${stats[0]}`);
    console.log(`📋 Tracking Numbers: ${stats[1]}`);
    console.log(`📄 Processed Sheets: ${stats[2]}`);
    console.log(`📝 Webhook Logs: ${stats[3]}`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateDataToDatabase();
}

export default migrateDataToDatabase;
