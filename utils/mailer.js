const axios = require('axios');

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(toEmail, otp, purpose) {
    const subject = purpose === 'verify'
        ? 'Verify your DevBlog account'
        : 'Reset your DevBlog password';

    const heading = purpose === 'verify'
        ? 'Verify your email'
        : 'Reset your password';

    const message = purpose === 'verify'
        ? 'Use the code below to verify your email and activate your account.'
        : 'Use the code below to reset your password.';

    await axios.post('https://api.brevo.com/v3/smtp/email', {
        sender: { name: 'DevBlog', email: 'forgot493@gmail.com' },
        to: [{ email: toEmail }],
        subject,
        htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>${heading}</h2>
                <p>${message}</p>
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 16px 0;">
                    ${otp}
                </div>
                <p>This code expires in 5 minutes. If you did not request this, you can ignore this email.</p>
            </div>
        `
    }, {
        headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json'
        }
    });
}

module.exports = { generateOTP, sendOTPEmail };