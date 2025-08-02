import { PrismaClient } from "@prisma/client";

// Connection pooling and performance optimization
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Optimized Prisma client with connection pooling
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Batch processing for large operations
export class BatchProcessor {
  private static readonly BATCH_SIZE = 50; // Process 50 items at a time
  private static readonly CONCURRENT_BATCHES = 5; // Max 5 concurrent batches

  static async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = this.BATCH_SIZE
  ): Promise<R[]> {
    const results: R[] = [];
    const batches: T[][] = [];

    // Split items into batches
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    console.log(
      `📦 Processing ${items.length} items in ${batches.length} batches`
    );

    // Process batches with concurrency limit
    for (let i = 0; i < batches.length; i += this.CONCURRENT_BATCHES) {
      const currentBatches = batches.slice(i, i + this.CONCURRENT_BATCHES);

      const batchPromises = currentBatches.map(async (batch, batchIndex) => {
        console.log(
          `🔄 Processing batch ${i + batchIndex + 1}/${batches.length} (${
            batch.length
          } items)`
        );

        const batchResults = await Promise.allSettled(
          batch.map((item) => processor(item))
        );

        const successful: R[] = [];
        let failed = 0;

        for (const result of batchResults) {
          if (result.status === "fulfilled") {
            successful.push(result.value);
          } else {
            failed++;
          }
        }

        if (failed > 0) {
          console.warn(
            `⚠️ Batch ${i + batchIndex + 1}: ${failed} items failed`
          );
        }

        return successful;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());
    }

    console.log(
      `✅ Batch processing complete: ${results.length}/${items.length} successful`
    );
    return results;
  }
}

// Memory-efficient data streaming
export class DataStreamer {
  static async streamLargeDataset<T>(
    query: () => Promise<T[]>,
    processor: (chunk: T[]) => Promise<void>,
    chunkSize: number = 100
  ): Promise<void> {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const chunk = await query();

      if (chunk.length === 0) {
        hasMore = false;
        break;
      }

      await processor(chunk);
      offset += chunkSize;

      // Small delay to prevent overwhelming the system
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}

// Request queuing for high-load scenarios
export class RequestQueue {
  private static queues = new Map<string, Array<() => Promise<any>>>();
  private static processing = new Map<string, boolean>();
  private static readonly MAX_CONCURRENT = 10;

  static async enqueue<T>(
    queueName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.queues.has(queueName)) {
        this.queues.set(queueName, []);
      }

      const queue = this.queues.get(queueName)!;

      queue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue(queueName);
    });
  }

  private static async processQueue(queueName: string): Promise<void> {
    if (this.processing.get(queueName)) {
      return; // Already processing this queue
    }

    const queue = this.queues.get(queueName);
    if (!queue || queue.length === 0) {
      return;
    }

    this.processing.set(queueName, true);

    try {
      const batch = queue.splice(0, this.MAX_CONCURRENT);
      await Promise.allSettled(batch.map((operation) => operation()));

      // Continue processing if there are more items
      if (queue.length > 0) {
        setImmediate(() => this.processQueue(queueName));
      }
    } finally {
      this.processing.set(queueName, false);
    }
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private static metrics = new Map<string, number[]>();

  static startTimer(operation: string): () => void {
    const start = Date.now();

    return () => {
      const duration = Date.now() - start;

      if (!this.metrics.has(operation)) {
        this.metrics.set(operation, []);
      }

      const operationMetrics = this.metrics.get(operation)!;
      operationMetrics.push(duration);

      // Keep only last 100 measurements
      if (operationMetrics.length > 100) {
        operationMetrics.shift();
      }

      console.log(`⏱️ ${operation}: ${duration}ms`);
    };
  }

  static getStats(
    operation: string
  ): { avg: number; min: number; max: number; count: number } | null {
    const metrics = this.metrics.get(operation);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const avg = metrics.reduce((sum, val) => sum + val, 0) / metrics.length;
    const min = Math.min(...metrics);
    const max = Math.max(...metrics);

    return { avg: Math.round(avg), min, max, count: metrics.length };
  }

  static logAllStats(): void {
    console.log("\n📊 Performance Statistics:");
    for (const [operation, metrics] of this.metrics.entries()) {
      const stats = this.getStats(operation);
      if (stats) {
        console.log(
          `  ${operation}: avg=${stats.avg}ms, min=${stats.min}ms, max=${stats.max}ms, count=${stats.count}`
        );
      }
    }
  }
}

// Database optimization helpers
export class DatabaseOptimizer {
  static async optimizeTrackingNumberQueries(): Promise<void> {
    try {
      // Create indexes for better performance
      await prisma.$executeRaw`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracking_number ON sent_tracking_numbers(tracking_number);`;
      await prisma.$executeRaw`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sent_at ON sent_tracking_numbers(sent_at);`;
      await prisma.$executeRaw`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_created_at ON webhook_logs(created_at);`;
      console.log("✅ Database indexes optimized");
    } catch (error) {
      console.warn("⚠️ Database optimization failed:", error);
    }
  }

  static async cleanupOldData(daysOld: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    try {
      const [deletedLogs] = await Promise.all([
        prisma.webhookLog.deleteMany({
          where: { createdAt: { lt: cutoffDate } },
        }),
      ]);

      console.log(`🧹 Cleanup: ${deletedLogs.count} old records deleted`);
    } catch (error) {
      console.error("❌ Cleanup failed:", error);
    }
  }
}

export default {
  BatchProcessor,
  DataStreamer,
  RequestQueue,
  PerformanceMonitor,
  DatabaseOptimizer,
  prisma,
};
