// Simple test script to verify processSheets function
const { processAndSendSheetData } = require('./src/utils/processSheets.ts');

async function testProcessSheets() {
  console.log('🧪 Testing processSheets function...');
  
  try {
    // Test with a dummy sheet name
    const result = await processAndSendSheetData('test-sheet');
    console.log('📊 Test result:', result);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testProcessSheets();
