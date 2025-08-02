import { google } from 'googleapis'

// Initialize Google Sheets API
const initializeGoogleSheets = () => {
  const credentials = {
    type: 'service_account',
    project_id: process.env.GOOGLE_PROJECT_ID,
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  return google.sheets({ version: 'v4', auth })
}

export interface SheetData {
  sheetName: string
  data: string[][]
}

export interface SpreadsheetInfo {
  title: string
  sheets: {
    title: string
    sheetId: number
  }[]
}

// Get spreadsheet information (title and sheet names)
export async function getSpreadsheetInfo(spreadsheetId: string): Promise<SpreadsheetInfo> {
  try {
    const sheets = initializeGoogleSheets()
    
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    })

    const spreadsheet = response.data
    
    return {
      title: spreadsheet.properties?.title || 'Неизвестная таблица',
      sheets: spreadsheet.sheets?.map(sheet => ({
        title: sheet.properties?.title || 'Неизвестный лист',
        sheetId: sheet.properties?.sheetId || 0
      })) || []
    }
  } catch (error) {
    console.error('Ошибка получения информации о таблице:', error)
    throw new Error('Не удалось получить информацию о таблице')
  }
}

// Get data from a specific sheet
export async function getSheetData(spreadsheetId: string, sheetName: string): Promise<SheetData> {
  try {
    const sheets = initializeGoogleSheets()
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`, // Get all data from columns A to Z
    })

    return {
      sheetName,
      data: response.data.values || []
    }
  } catch (error) {
    console.error('Ошибка получения данных листа:', error)
    throw new Error('Не удалось получить данные листа')
  }
}

// Get data from all sheets
export async function getAllSheetsData(spreadsheetId: string): Promise<SheetData[]> {
  try {
    const spreadsheetInfo = await getSpreadsheetInfo(spreadsheetId)
    const allData: SheetData[] = []

    for (const sheet of spreadsheetInfo.sheets) {
      try {
        const sheetData = await getSheetData(spreadsheetId, sheet.title)
        allData.push(sheetData)
      } catch (error) {
        console.error(`Ошибка получения данных для листа ${sheet.title}:`, error)
        // Continue with other sheets even if one fails
      }
    }

    return allData
  } catch (error) {
    console.error('Ошибка получения всех данных:', error)
    throw new Error('Не удалось получить данные таблицы')
  }
}
