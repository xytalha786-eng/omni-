const nodemailer = require('nodemailer');

const hasEmailCreds = process.env.GMAIL_USER && process.env.GMAIL_USER !== 'your_store_email@gmail.com';
const transporter = hasEmailCreds ? nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
}) : null;

const sendOtpEmail = async (toEmail, firstName, otp) => {
  if (!transporter) {
    console.log(`\n================================`);
    console.log(`📧 MOCK EMAIL (OTP)`);
    console.log(`To: ${toEmail}`);
    console.log(`OTP Code: ${otp}`);
    console.log(`================================\n`);
    return;
  }
  
  const mailOptions = {
    from: `"Omni Store" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: '🔐 Your Omni Verification Code',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8"/>
        <style>
          body { font-family: 'Segoe UI', sans-serif; background: #0a0a0a; margin: 0; padding: 0; }
          .container { max-width: 520px; margin: 40px auto; background: #111111; border: 1px solid rgba(201,168,76,0.2); border-radius: 16px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #1a0e00, #2d1a00); padding: 40px 40px 32px; text-align: center; }
          .logo { font-family: Georgia, serif; font-size: 28px; font-weight: 600; color: #c9a84c; letter-spacing: 2px; }
          .logo span { color: #ffffff; }
          .tagline { font-size: 11px; color: #888; letter-spacing: 3px; text-transform: uppercase; margin-top: 6px; }
          .body { padding: 40px; }
          .greeting { font-size: 18px; color: #ffffff; margin-bottom: 16px; }
          .message { font-size: 14px; color: #888888; line-height: 1.8; margin-bottom: 32px; }
          .otp-box { background: rgba(201,168,76,0.08); border: 2px solid rgba(201,168,76,0.3); border-radius: 12px; padding: 28px; text-align: center; margin: 24px 0; }
          .otp-label { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #888; margin-bottom: 12px; }
          .otp-code { font-family: Georgia, serif; font-size: 48px; font-weight: 700; color: #c9a84c; letter-spacing: 16px; }
          .otp-expiry { font-size: 12px; color: #888; margin-top: 12px; }
          .warning { background: rgba(231,76,60,0.08); border: 1px solid rgba(231,76,60,0.2); border-radius: 8px; padding: 14px 18px; font-size: 13px; color: #e74c3c; margin: 24px 0; }
          .footer { border-top: 1px solid rgba(255,255,255,0.06); padding: 24px 40px; text-align: center; }
          .footer p { font-size: 12px; color: #555; line-height: 1.8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Om<span>ni</span></div>
            <div class="tagline">Premium Collection · Pakistan</div>
          </div>
          <div class="body">
            <div class="greeting">Hello, ${firstName}! 👋</div>
            <div class="message">
              Thank you for creating your Omni account. To complete your registration, please use the verification code below.
            </div>
            <div class="otp-box">
              <div class="otp-label">Your Verification Code</div>
              <div class="otp-code">${otp}</div>
              <div class="otp-expiry">⏱️ This code expires in <strong style="color:#c9a84c">10 minutes</strong></div>
            </div>
            <div class="warning">
              🔒 Never share this code with anyone. Omni will never ask for your OTP.
            </div>
            <div class="message" style="margin-bottom:0">
              If you did not create an account, please ignore this email. Your email will not be registered.
            </div>
          </div>
          <div class="footer">
            <p>© 2025 Omni Store · Pakistan<br/>
            <a href="https://wa.me/923037971616" style="color:#c9a84c;text-decoration:none">WhatsApp Support: 03037971616</a></p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

const sendOrderConfirmationEmail = async (toEmail, customerName, order) => {
  if (!toEmail) return;

  if (!transporter) {
    console.log(`\n================================`);
    console.log(`📧 MOCK EMAIL (ORDER CONFIRMATION)`);
    console.log(`To: ${toEmail}`);
    console.log(`Order: #${order.orderNumber}`);
    console.log(`Total: Rs. ${order.total}`);
    console.log(`================================\n`);
    return;
  }

  const itemsList = order.items.map(item =>
    `<tr>
      <td style="padding:10px;border-bottom:1px solid #222;color:#ccc">${item.productName}</td>
      <td style="padding:10px;border-bottom:1px solid #222;color:#ccc;text-align:center">${item.quantity}</td>
      <td style="padding:10px;border-bottom:1px solid #222;color:#c9a84c;text-align:right">Rs. ${(item.price * item.quantity).toLocaleString()}</td>
    </tr>`
  ).join('');

  const mailOptions = {
    from: `"Omni Store" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `✅ Order Confirmed — #${order.orderNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"/>
      <style>
        body { font-family: 'Segoe UI', sans-serif; background: #0a0a0a; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 40px auto; background: #111; border: 1px solid rgba(201,168,76,0.2); border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #1a0e00, #2d1a00); padding: 36px 40px; text-align: center; }
        .logo { font-family: Georgia, serif; font-size: 26px; font-weight: 600; color: #c9a84c; }
        .logo span { color: #fff; }
        .body { padding: 36px 40px; }
        .title { font-size: 22px; color: #fff; margin-bottom: 8px; font-family: Georgia, serif; }
        .order-id { color: #c9a84c; font-size: 18px; font-family: Georgia, serif; margin-bottom: 24px; }
        .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #222; font-size: 13px; }
        .label { color: #888; }
        .value { color: #fff; font-weight: 500; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { padding: 10px; background: #1a1a1a; color: #888; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; text-align: left; }
        .total-row { background: rgba(201,168,76,0.08); }
        .total-row td { padding: 14px 10px; font-family: Georgia, serif; font-size: 18px; color: #c9a84c; font-weight: 600; }
        .wa-box { background: rgba(37,211,102,0.08); border: 1px solid rgba(37,211,102,0.2); border-radius: 10px; padding: 20px; margin-top: 24px; text-align: center; }
        .wa-box p { color: #25d366; font-size: 13px; margin: 0 0 12px; }
        .wa-btn { display: inline-block; background: #25d366; color: #000; padding: 12px 28px; border-radius: 100px; font-size: 13px; font-weight: 700; text-decoration: none; }
        .footer { border-top: 1px solid #222; padding: 20px 40px; text-align: center; font-size: 12px; color: #555; }
      </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Om<span>ni</span></div>
          </div>
          <div class="body">
            <div class="title">Order Placed Successfully! 🎉</div>
            <div class="order-id">#${order.orderNumber}</div>
            <div class="info-row"><span class="label">Customer</span><span class="value">${customerName}</span></div>
            <div class="info-row"><span class="label">Payment</span><span class="value">${order.paymentMethod}</span></div>
            <div class="info-row"><span class="label">Delivery To</span><span class="value">${order.shippingAddress.city}, ${order.shippingAddress.province}</span></div>
            <div class="info-row"><span class="label">Estimated Delivery</span><span class="value">2-5 Working Days</span></div>
            <table>
              <tr><th>Product</th><th>Qty</th><th style="text-align:right">Price</th></tr>
              ${itemsList}
              <tr><td style="padding:10px;color:#888">Delivery Charge</td><td></td><td style="padding:10px;color:#c9a84c;text-align:right">Rs. ${order.deliveryCharge.toLocaleString()}</td></tr>
              <tr class="total-row"><td colspan="2">Total</td><td style="text-align:right">Rs. ${order.total.toLocaleString()}</td></tr>
            </table>
            <div class="wa-box">
              <p>📸 Send your payment screenshot on WhatsApp to confirm your order:</p>
              <a href="https://wa.me/923037971616" class="wa-btn">📲 Send Screenshot</a>
            </div>
          </div>
          <div class="footer">© 2025 Omni Store · Pakistan</div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendOtpEmail, sendOrderConfirmationEmail };
