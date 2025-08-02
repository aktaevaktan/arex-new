import { NextResponse } from 'next/server'
import { getSpreadsheetInfo } from '@/lib/googleSheets'

export async function GET() {
  try {
    const spreadsheetId = process.env.SPREADSHEET_ID
    
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'ID таблицы не настроен' },
        { status: 500 }
      )
    }

    const info = await getSpreadsheetInfo(spreadsheetId)
    
    return NextResponse.json(info)
  } catch (error) {
    console.error('Ошибка API получения информации о таблице:', error)
    return NextResponse.json(
      { error: 'Не удалось получить информацию о таблице' },
      { status: 500 }
    )
  }
}
