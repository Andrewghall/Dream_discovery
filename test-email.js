// Quick test script to verify Resend email sending
import 'dotenv/config';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmail() {
  console.log('Testing Resend email configuration...');
  console.log('API Key exists:', !!process.env.RESEND_API_KEY);
  console.log('From email:', process.env.FROM_EMAIL);
  
  try {
    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: 'andrew@ethenta.com', // Replace with your test email
      subject: 'Test Email from DREAM Discovery',
      html: '<h1>Test Email</h1><p>If you receive this, email sending is working!</p>',
    });
    
    console.log('✅ Email sent successfully!');
    console.log('Result:', result);
  } catch (error) {
    console.error('❌ Email sending failed:');
    console.error(error);
  }
}

testEmail();
