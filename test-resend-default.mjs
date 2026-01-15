import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function testResend() {
  console.log('Testing Resend API with default onboarding domain...\n');
  
  try {
    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: 'andrew.hall@ethenta.com',
      subject: 'Test Email - Default Domain',
      html: '<h1>Test Email</h1><p>This test uses Resend default domain to verify API is working.</p>',
    });
    
    console.log('✅ SUCCESS! Email sent with default domain.');
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('\nIf this works but discovery@mail.ethenta.com does not,');
    console.log('you need to verify the mail.ethenta.com domain in Resend.');
    console.log('\nCheck: https://resend.com/domains');
  } catch (error) {
    console.error('❌ FAILED! Error:');
    console.error(error);
  }
}

testResend();
