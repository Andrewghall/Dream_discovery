import { Resend } from 'resend';

const resend = new Resend('re_gQfoyJnm_DQ7wSK3tLqEKC6KH9Wv1vF8o');

async function testResend() {
  console.log('Testing Resend API...\n');
  
  try {
    const result = await resend.emails.send({
      from: 'DREAM Discovery <discovery@mail.ethenta.com>',
      to: 'andrew.hall@ethenta.com',
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
