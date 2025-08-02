import { NextRequest, NextResponse } from "next/server";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private windowMs: number;
  public maxRequests: number;

  constructor(windowMs: number = 15 * 60 * 1000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const key in this.store) {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    }
  }

  private getClientId(request: NextRequest): string {
    // Try to get IP from various headers (for proxy/load balancer scenarios)
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = forwarded?.split(",")[0] || realIp || "unknown";

    // Include user agent for additional uniqueness
    const userAgent = request.headers.get("user-agent") || "unknown";
    return `${ip}-${userAgent.slice(0, 50)}`;
  }

  check(request: NextRequest): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const clientId = this.getClientId(request);
    const now = Date.now();

    if (!this.store[clientId] || this.store[clientId].resetTime < now) {
      // First request or window expired
      this.store[clientId] = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: this.store[clientId].resetTime,
      };
    }

    const entry = this.store[clientId];
    entry.count++;

    return {
      allowed: entry.count <= this.maxRequests,
      remaining: Math.max(0, this.maxRequests - entry.count),
      resetTime: entry.resetTime,
    };
  }
}

// Different rate limiters for different endpoints
const generalLimiter = new RateLimiter(15 * 60 * 1000, 100); // 100 requests per 15 minutes
const webhookLimiter = new RateLimiter(60 * 1000, 10); // 10 requests per minute for webhooks
const authLimiter = new RateLimiter(15 * 60 * 1000, 5); // 5 login attempts per 15 minutes

export function applyRateLimit(
  request: NextRequest,
  type: "general" | "webhook" | "auth" = "general"
): NextResponse | null {
  let limiter: RateLimiter;

  switch (type) {
    case "webhook":
      limiter = webhookLimiter;
      break;
    case "auth":
      limiter = authLimiter;
      break;
    default:
      limiter = generalLimiter;
  }

  const result = limiter.check(request);

  if (!result.allowed) {
    return new NextResponse(
      JSON.stringify({
        success: false,
        message: "Too many requests. Please try again later.",
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": limiter.maxRequests.toString(),
          "X-RateLimit-Remaining": result.remaining.toString(),
          "X-RateLimit-Reset": result.resetTime.toString(),
          "Retry-After": Math.ceil(
            (result.resetTime - Date.now()) / 1000
          ).toString(),
        },
      }
    );
  }

  return null; // Allow request to proceed
}

// Security headers helper
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Security headers
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Add rate limit headers
  response.headers.set("X-RateLimit-Limit", "100");

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';"
    );
  }

  return response;
}

// IP whitelist for webhook endpoints (optional)
const WEBHOOK_IP_WHITELIST = process.env.WEBHOOK_IP_WHITELIST?.split(",") || [];

export function checkWebhookIPWhitelist(request: NextRequest): boolean {
  if (WEBHOOK_IP_WHITELIST.length === 0) {
    return true; // No whitelist configured, allow all
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0] || realIp || "";

  return WEBHOOK_IP_WHITELIST.includes(ip);
}

export default {
  applyRateLimit,
  addSecurityHeaders,
  checkWebhookIPWhitelist,
};
