const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
        user: 'b0ac2a001@smtp-brevo.com',
        pass: 'bskq0knHEbr0GbH'
    }
});
t.verify((err, success) => {
    if (err) console.log('FAILED:', err.message);
    else console.log('SUCCESS');
});