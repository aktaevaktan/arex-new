import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sheetName = searchParams.get('sheetName');

    if (!sheetName) {
      return NextResponse.json({
        success: false,
        error: 'Sheet name is required'
      }, { status: 400 });
    }

    // Get processed sheet information
    const processedSheet = await prisma.processedSheet.findUnique({
      where: { sheetName }
    });

    // Get tracking numbers count for this sheet (approximate)
    const trackingCount = await prisma.sentTrackingNumber.count({
      where: {
        sentAt: processedSheet?.processedAt ? {
          gte: new Date(processedSheet.processedAt.getTime() - 24 * 60 * 60 * 1000), // 24 hours before processing
          lte: new Date(processedSheet.processedAt.getTime() + 24 * 60 * 60 * 1000)  // 24 hours after processing
        } : undefined
      }
    });

    // Get webhook logs for this sheet (if any)
    const webhookLogs = await prisma.webhookLog.count({
      where: {
        createdAt: processedSheet?.processedAt ? {
          gte: new Date(processedSheet.processedAt.getTime() - 1 * 60 * 60 * 1000), // 1 hour before
          lte: new Date(processedSheet.processedAt.getTime() + 1 * 60 * 60 * 1000)  // 1 hour after
        } : undefined
      }
    });

    const isScanned = !!processedSheet;
    const scannedAt = processedSheet?.processedAt || null;

    return NextResponse.json({
      success: true,
      data: {
        sheetName,
        isScanned,
        scannedAt,
        statistics: {
          trackingNumbers: trackingCount,
          webhookEvents: webhookLogs,
          usersNotified: trackingCount // Approximate - each tracking number represents a user notification
        }
      }
    });

  } catch (error) {
    console.error('❌ Error getting sheet status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get sheet status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Get all processed sheets summary
export async function POST(request: NextRequest) {
  try {
    const { sheetNames } = await request.json();

    if (!Array.isArray(sheetNames)) {
      return NextResponse.json({
        success: false,
        error: 'Sheet names array is required'
      }, { status: 400 });
    }

    // Get all processed sheets
    const processedSheets = await prisma.processedSheet.findMany({
      where: {
        sheetName: {
          in: sheetNames
        }
      },
      orderBy: { processedAt: 'desc' }
    });

    // Create a map for quick lookup
    const processedMap = new Map(
      processedSheets.map(sheet => [sheet.sheetName, sheet])
    );

    // Build response for each sheet
    const sheetsStatus = await Promise.all(
      sheetNames.map(async (sheetName) => {
        const processedSheet = processedMap.get(sheetName);
        const isScanned = !!processedSheet;

        let trackingCount = 0;
        if (processedSheet) {
          trackingCount = await prisma.sentTrackingNumber.count({
            where: {
              sentAt: {
                gte: new Date(processedSheet.processedAt.getTime() - 24 * 60 * 60 * 1000),
                lte: new Date(processedSheet.processedAt.getTime() + 24 * 60 * 60 * 1000)
              }
            }
          });
        }

        return {
          sheetName,
          isScanned,
          scannedAt: processedSheet?.processedAt || null,
          statistics: {
            trackingNumbers: trackingCount,
            usersNotified: trackingCount
          }
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: sheetsStatus
    });

  } catch (error) {
    console.error('❌ Error getting sheets status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get sheets status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
