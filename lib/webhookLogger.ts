interface WebhookLog {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: any;
  status: 'success' | 'error';
  error?: string;
}

class WebhookLogger {
  private logs: WebhookLog[] = [];
  private maxLogs = 1000; // Keep last 1000 logs

  addLog(log: Omit<WebhookLog, 'id' | 'timestamp'>) {
    const newLog: WebhookLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      ...log
    };

    this.logs.unshift(newLog); // Add to beginning
    
    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Also log to console for terminal visibility
    this.logToConsole(newLog);
  }

  private logToConsole(log: WebhookLog) {
    console.log('\n🔔 WEBHOOK LOG ENTRY');
    console.log('🆔 ID:', log.id);
    console.log('⏰ Timestamp:', log.timestamp);
    console.log('🌐 URL:', log.url);
    console.log('📋 Method:', log.method);
    console.log('📦 Headers:', JSON.stringify(log.headers, null, 2));
    console.log('📄 Body:', JSON.stringify(log.body, null, 2));
    console.log('✅ Status:', log.status);
    if (log.error) {
      console.log('❌ Error:', log.error);
    }
    console.log('─'.repeat(80));
  }

  getLogs(): WebhookLog[] {
    return [...this.logs]; // Return copy
  }

  getRecentLogs(limit: number = 50): WebhookLog[] {
    return this.logs.slice(0, limit);
  }

  clearLogs() {
    this.logs = [];
    console.log('🧹 Webhook logs cleared');
  }

  getLogById(id: string): WebhookLog | undefined {
    return this.logs.find(log => log.id === id);
  }

  getLogStats() {
    const total = this.logs.length;
    const success = this.logs.filter(log => log.status === 'success').length;
    const errors = this.logs.filter(log => log.status === 'error').length;
    const methods = this.logs.reduce((acc, log) => {
      acc[log.method] = (acc[log.method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      success,
      errors,
      methods,
      lastActivity: this.logs[0]?.timestamp || null
    };
  }
}

// Global instance
const webhookLogger = new WebhookLogger();

export default webhookLogger;
export type { WebhookLog };
