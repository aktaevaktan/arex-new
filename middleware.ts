import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// JWT verification function for middleware (Edge Runtime compatible)
async function verifyTokenInMiddleware(token: string): Promise<any> {
  try {
    // Use the same secret as in the JWT library - must match exactly
    const secretString =
      process.env.JWT_SECRET ||
      process.env.JWT_ACCESS_SECRET ||
      "fallback-access-secret";
    const secret = new TextEncoder().encode(secretString);

    console.log("Middleware JWT verification:", {
      tokenLength: token.length,
      tokenStart: token.substring(0, 20) + "...",
      secretLength: secretString.length,
      secretStart: secretString.substring(0, 10) + "...",
    });

    // Verify with HMAC SHA256 algorithm (same as jsonwebtoken default)
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    console.log("Middleware JWT verification successful:", {
      userId: payload.userId,
      email: payload.email,
      exp: payload.exp,
    });

    return payload;
  } catch (error) {
    console.log("Middleware JWT verification error:", error);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/logo.svg")
  ) {
    return NextResponse.next();
  }

  // Handle API route protection
  if (pathname.startsWith("/api/")) {
    // Public API routes (no authentication required)
    const publicApiRoutes = [
      "/api/auth/login",
      "/api/auth/refresh",
      "/api/auth/verify",
      "/api/auth/me",
      "/api/auth/debug",
    ];
    const isPublicApi = publicApiRoutes.some((route) =>
      pathname.startsWith(route)
    );

    if (isPublicApi) {
      console.log(`Middleware - Allowing public API access to ${pathname}`);
      return NextResponse.next();
    }

    // Webhook routes need special protection
    if (pathname.startsWith("/api/webhooks/")) {
      const apiKey = request.headers.get("x-api-key");
      const authHeader = request.headers.get("authorization");

      // Check API key first
      if (apiKey && apiKey === process.env.WEBHOOK_API_KEY) {
        console.log(
          `Middleware - Allowing webhook access with API key: ${pathname}`
        );
        return NextResponse.next();
      }

      // Check JWT token from cookie or header
      const cookieToken = request.cookies.get("accessToken")?.value;
      const headerToken = authHeader?.startsWith("Bearer ")
        ? authHeader.substring(7)
        : null;
      const token = headerToken || cookieToken;

      if (token) {
        const payload = await verifyTokenInMiddleware(token);
        if (payload) {
          console.log(
            `Middleware - Allowing webhook access with JWT: ${pathname}`
          );
          return NextResponse.next();
        }
      }

      // Reject unauthorized webhook access
      console.log(
        `Middleware - Rejecting unauthorized webhook access: ${pathname}`
      );
      return new NextResponse(
        JSON.stringify({
          success: false,
          message: "Unauthorized access to webhook endpoint",
        }),
        {
          status: 401,
          headers: { "content-type": "application/json" },
        }
      );
    }

    // Protected API routes
    const protectedApiRoutes = [
      "/api/sheets",
      "/api/webhook-logs",
      "/api/test-whatsapp",
      "/api/auth/logout",
    ];
    const isProtectedApi = protectedApiRoutes.some((route) =>
      pathname.startsWith(route)
    );

    if (isProtectedApi) {
      const token = request.cookies.get("accessToken")?.value;

      if (!token) {
        console.log(`Middleware - No token for protected API: ${pathname}`);
        return new NextResponse(
          JSON.stringify({
            success: false,
            message: "Authentication required",
          }),
          { status: 401, headers: { "content-type": "application/json" } }
        );
      }

      const payload = await verifyTokenInMiddleware(token);
      if (!payload) {
        console.log(
          `Middleware - Invalid token for protected API: ${pathname}`
        );
        return new NextResponse(
          JSON.stringify({
            success: false,
            message: "Invalid or expired token",
          }),
          { status: 401, headers: { "content-type": "application/json" } }
        );
      }

      console.log(
        `Middleware - Allowing authenticated API access to ${pathname}`
      );
    } else {
      console.log(
        `Middleware - Allowing unprotected API access to ${pathname}`
      );
    }

    return NextResponse.next();
  }

  const accessToken = request.cookies.get("accessToken")?.value;
  const refreshToken = request.cookies.get("refreshToken")?.value;

  console.log(`Middleware - Processing ${pathname}:`, {
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
    accessTokenLength: accessToken?.length || 0,
    jwtSecret: process.env.JWT_SECRET ? "present" : "missing",
    nodeEnv: process.env.NODE_ENV,
  });

  // Handle /auth/login route
  if (pathname.startsWith("/auth/login")) {
    console.log(`Middleware - Processing login route: ${pathname}`);

    if (accessToken) {
      // Verify access token
      const payload = await verifyTokenInMiddleware(accessToken);
      if (payload) {
        console.log("Middleware - User authenticated, redirecting to admin");
        // User is authenticated, redirect to /crm/admin
        return NextResponse.redirect(new URL("/crm/admin", request.url));
      }

      // If access token is invalid but refresh token exists, try to refresh
      if (refreshToken) {
        console.log("Middleware - Access token invalid, trying refresh");
        try {
          const refreshResponse = await fetch(
            new URL("/api/auth/refresh", request.url).toString(),
            {
              method: "POST",
              headers: {
                Cookie: `refreshToken=${refreshToken}`,
              },
            }
          );

          if (refreshResponse.ok) {
            console.log(
              "Middleware - Refresh successful, redirecting to admin"
            );
            // Refresh successful, redirect to /crm/admin
            const response = NextResponse.redirect(
              new URL("/crm/admin", request.url)
            );
            const newCookies = refreshResponse.headers.get("set-cookie");
            if (newCookies) {
              response.headers.set("set-cookie", newCookies);
            }
            return response;
          }
        } catch (error) {
          console.log("Middleware - Refresh failed:", error);
        }
      }
    }

    // No valid tokens, allow access to /auth/login
    console.log("Middleware - No valid tokens, allowing login access");
    return NextResponse.next();
  }

  // Protected routes that require authentication
  const protectedRoutes = ["/crm/admin", "/webhookLogs"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtectedRoute) {
    console.log(`Middleware - Processing protected route: ${pathname}`);

    if (!accessToken || !refreshToken) {
      console.log("Middleware - No tokens, redirecting to login");
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }

    // Verify access token
    try {
      const payload = await verifyTokenInMiddleware(accessToken);
      console.log("Middleware - Token verification result:", {
        valid: !!payload,
        payload: payload
          ? { userId: payload.userId, email: payload.email }
          : null,
      });

      if (!payload) {
        console.log("Middleware - Access token invalid, trying refresh");
        // Try to refresh the token
        try {
          const refreshResponse = await fetch(
            new URL("/api/auth/refresh", request.url).toString(),
            {
              method: "POST",
              headers: {
                Cookie: `refreshToken=${refreshToken}`,
              },
            }
          );

          if (refreshResponse.ok) {
            console.log("Middleware - Refresh successful, allowing access");
            const response = NextResponse.next();
            const newCookies = refreshResponse.headers.get("set-cookie");
            if (newCookies) {
              response.headers.set("set-cookie", newCookies);
            }
            return response;
          } else {
            console.log("Middleware - Refresh failed, redirecting to login");
            return NextResponse.redirect(new URL("/auth/login", request.url));
          }
        } catch (error) {
          console.log("Middleware - Refresh error:", error);
          return NextResponse.redirect(new URL("/auth/login", request.url));
        }
      }

      // Token is valid, continue
      console.log("Middleware - Access token valid, allowing access");
      return NextResponse.next();
    } catch (error) {
      console.log("Middleware - Token verification error:", error);
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
  }

  // Allow access to other routes (e.g., "/")
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg).*)"],
};
