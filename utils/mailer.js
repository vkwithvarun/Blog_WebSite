const nodemailer = require('nodemailer')

// FIX: Added explicit configuration for Port 587 to bypass Render's network restrictions
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for port 465, false for other ports like 587
    connectionTimeout: 10000, // Wait 10 seconds before timing out
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // Make sure this is your 16-character Google App Password
    },
    tls: {
        rejectUnauthorized: false // Helps prevent cloud hosting network drops
    },
    family: 4
})

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

async function sendOTPEmail(toEmail, otp, purpose) {
    const subject = purpose === 'verify'
    ? 'Verify your DevBlog account'
    : 'Reset your DevBlog password'

    const heading = purpose === 'verify'
    ? 'Verify your email'
    : 'Reset your password'

    const message = purpose === 'verify'
    ? 'Use the code below to verify your email and activate your account.'
    : 'Use the code below to reset your password.'

    await transporter.sendMail({
        from: `"DevBlog" <${process.env.EMAIL_USER}>`, // FIX: Closed the missing inner angle bracket string template right here
        to: toEmail,
        subject,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>${heading}</h2>
                <p>${message}</p>
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 16px 0;">
                    ${otp}
                </div>
                <p>This code expires in 5 minutes. If you did not request this, you can ignore this email.</p>
            </div>
        `
    })
}

module.exports = { generateOTP, sendOTPEmail }