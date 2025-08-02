// Secure configuration management
// Only server-side environment variables are exposed here

interface ServerConfig {
  // Database
  DATABASE_URL: string;
  
  // JWT
  JWT_SECRET: string;
  
  // WhatsApp API
  GREEN_API_URL: string;
  GREEN_API_MEDIA_URL: string;
  GREEN_API_ID_INSTANCE: string;
  GREEN_API_API_TOKEN_INSTANCE: string;
  
  // Google Sheets
  GOOGLE_SHEETS_PRIVATE_KEY: string;
  GOOGLE_SHEETS_CLIENT_EMAIL: string;
  SPREADSHEET_ID: string;
  
  // Webhook Security
  WEBHOOK_API_KEY: string;
  
  // App
  NEXTAUTH_URL: string;
  NODE_ENV: string;
}

interface ClientConfig {
  // Only safe, non-sensitive config for client-side
  APP_NAME: string;
  NODE_ENV: string;
}

// Server-side configuration (never sent to client)
export const serverConfig: ServerConfig = {
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-key',
  GREEN_API_URL: process.env.GREEN_API_URL || '',
  GREEN_API_MEDIA_URL: process.env.GREEN_API_MEDIA_URL || '',
  GREEN_API_ID_INSTANCE: process.env.GREEN_API_ID_INSTANCE || '',
  GREEN_API_API_TOKEN_INSTANCE: process.env.GREEN_API_API_TOKEN_INSTANCE || '',
  GOOGLE_SHEETS_PRIVATE_KEY: process.env.GOOGLE_SHEETS_PRIVATE_KEY || '',
  GOOGLE_SHEETS_CLIENT_EMAIL: process.env.GOOGLE_SHEETS_CLIENT_EMAIL || '',
  SPREADSHEET_ID: process.env.SPREADSHEET_ID || '',
  WEBHOOK_API_KEY: process.env.WEBHOOK_API_KEY || 'default-webhook-key',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  NODE_ENV: process.env.NODE_ENV || 'development',
};

// Client-side configuration (safe to expose)
export const clientConfig: ClientConfig = {
  APP_NAME: 'Topex Logistics',
  NODE_ENV: process.env.NODE_ENV || 'development',
};

// Validation function to ensure all required env vars are present
export function validateServerConfig(): void {
  const requiredVars: (keyof ServerConfig)[] = [
    'DATABASE_URL',
    'JWT_SECRET',
    'GREEN_API_URL',
    'GREEN_API_ID_INSTANCE',
    'GREEN_API_API_TOKEN_INSTANCE',
    'GOOGLE_SHEETS_PRIVATE_KEY',
    'GOOGLE_SHEETS_CLIENT_EMAIL',
    'SPREADSHEET_ID',
  ];

  const missingVars = requiredVars.filter(key => !serverConfig[key]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars);
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  console.log('✅ All required environment variables are configured');
}

// Helper to check if we're in production
export const isProduction = serverConfig.NODE_ENV === 'production';
export const isDevelopment = serverConfig.NODE_ENV === 'development';

// Rate limiting configuration
export const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 100 : 1000, // Limit each IP to 100 requests per windowMs in production
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
};

// Security headers configuration
export const securityHeaders = {
  'X-DNS-Prefetch-Control': 'off',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  ...(isProduction && {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';",
  }),
};
