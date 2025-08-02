import { processAndSendSheetData } from "@/src/utils/processSheets";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { selectedSheet } = await req.json();
    const result = await processAndSendSheetData(selectedSheet);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { success: false, message: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}
