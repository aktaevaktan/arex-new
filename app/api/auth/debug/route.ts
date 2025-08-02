import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../lib/jwt";

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("accessToken")?.value;
    const refreshToken = request.cookies.get("refreshToken")?.value;

    console.log("Debug - Cookies found:", {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      accessTokenLength: accessToken?.length || 0,
      refreshTokenLength: refreshToken?.length || 0,
    });

    let tokenValid = false;
    let tokenPayload = null;

    if (accessToken) {
      try {
        tokenPayload = verifyAccessToken(accessToken);
        tokenValid = !!tokenPayload;
        console.log("Debug - Token verification:", {
          valid: tokenValid,
          payload: tokenPayload
            ? { userId: tokenPayload.userId, email: tokenPayload.email }
            : null,
        });
      } catch (error) {
        console.log("Debug - Token verification failed:", error);
      }
    }

    return NextResponse.json({
      success: true,
      debug: {
        cookies: {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          accessTokenPreview: accessToken
            ? `${accessToken.substring(0, 20)}...`
            : null,
        },
        token: {
          valid: tokenValid,
          payload: tokenPayload
            ? {
                userId: tokenPayload.userId,
                email: tokenPayload.email,
                exp: tokenPayload.exp,
                iat: tokenPayload.iat,
              }
            : null,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Debug endpoint error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Debug endpoint failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
