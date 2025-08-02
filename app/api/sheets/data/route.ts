import { NextRequest, NextResponse } from 'next/server'
import { getSheetData, getAllSheetsData } from '@/lib/googleSheets'

export async function GET(request: NextRequest) {
  try {
    const spreadsheetId = process.env.SPREADSHEET_ID
    
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'ID таблицы не настроен' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const sheetName = searchParams.get('sheet')

    if (sheetName) {
      // Get data from specific sheet
      const data = await getSheetData(spreadsheetId, sheetName)
      return NextResponse.json(data)
    } else {
      // Get data from all sheets
      const data = await getAllSheetsData(spreadsheetId)
      return NextResponse.json(data)
    }
  } catch (error) {
    console.error('Ошибка API получения данных:', error)
    return NextResponse.json(
      { error: 'Не удалось получить данные таблицы' },
      { status: 500 }
    )
  }
}
