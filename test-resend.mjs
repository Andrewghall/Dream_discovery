import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  console.error('Missing RESEND_API_KEY. Set it in your environment before running this script.');
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);

async function testResend() {
  console.log('Testing Resend API...\n');
  
  try {
    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'DREAM Discovery <onboarding@resend.dev>',
      to: process.env.TEST_TO_EMAIL || 'andrew.hall@ethenta.com',
      subject: 'Test Email from DREAM Discovery Platform',
      html: '<h1>Test Email</h1><p>This is a test to verify Resend is working.</p>',
    });
    
    console.log('✅ SUCCESS! Email sent to Resend.');
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('\nCheck your inbox at andrew.hall@ethenta.com');
    console.log('Also check Resend dashboard: https://resend.com/emails');
  } catch (error) {
    console.error('❌ FAILED! Error sending email:');
    console.error(error);
    
    if (error.message) {
      console.error('\nError message:', error.message);
    }
    
    if (error.statusCode) {
      console.error('Status code:', error.statusCode);
    }
  }
}

testResend();
