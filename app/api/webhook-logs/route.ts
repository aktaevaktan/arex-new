import { NextRequest, NextResponse } from 'next/server'
import webhookLogger from '@/lib/webhookLogger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const logId = searchParams.get('id')

    if (logId) {
      // Get specific log by ID
      const log = webhookLogger.getLogById(logId)
      if (!log) {
        return NextResponse.json(
          { success: false, message: 'Log not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({ success: true, log })
    }

    // Get recent logs
    const logs = webhookLogger.getRecentLogs(limit)
    const stats = webhookLogger.getLogStats()

    return NextResponse.json({
      success: true,
      logs,
      stats,
      total: logs.length
    })
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch logs',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    webhookLogger.clearLogs()
    
    return NextResponse.json({
      success: true,
      message: 'All webhook logs cleared'
    })
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to clear logs',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
