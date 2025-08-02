import { NextRequest, NextResponse } from 'next/server';
import whatsappService from '../../../lib/whatsappService';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing WhatsApp API connection...');
    
    const isConnected = await whatsappService.testConnection();
    
    return NextResponse.json({
      success: true,
      connected: isConnected,
      message: isConnected ? 'WhatsApp API is working!' : 'WhatsApp API connection failed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to test WhatsApp connection'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, message, testOrder } = body;

    if (testOrder) {
      // Test with sample order data
      const sampleOrder = {
        fullName: testOrder.fullName || 'Тест Клиент',
        phoneNumber: testOrder.phoneNumber || phoneNumber || '700100518',
        pickupPoint: testOrder.pickupPoint || 'Бишкек, ул. Чуй 123',
        trackingNumber: testOrder.trackingNumber || 'TEST123456',
        weight: testOrder.weight || 2.5,
        price: testOrder.price || 1500,
        status: testOrder.status || 'Готов'
      };

      console.log('🧪 Testing WhatsApp order notification...');
      console.log('📦 Sample order:', sampleOrder);

      const success = await whatsappService.sendOrderNotification(sampleOrder);

      return NextResponse.json({
        success,
        message: success ? 'Test order notification sent!' : 'Failed to send test notification',
        order: sampleOrder,
        timestamp: new Date().toISOString()
      });
    } else if (phoneNumber && message) {
      // Test with custom message
      console.log('🧪 Testing WhatsApp custom message...');
      console.log(`📱 Phone: ${phoneNumber}`);
      console.log(`📄 Message: ${message}`);

      const success = await whatsappService.sendMessage(
        phoneNumber.includes('@') ? phoneNumber : `996${phoneNumber.replace(/^\+?996/, '')}@c.us`,
        message
      );

      return NextResponse.json({
        success,
        message: success ? 'Test message sent!' : 'Failed to send test message',
        phoneNumber,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Please provide either phoneNumber + message or testOrder data'
      }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to send test message'
    }, { status: 500 });
  }
}
