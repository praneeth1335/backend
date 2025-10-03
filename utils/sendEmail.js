const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  try {
    // Create transporter with Gmail SMTP configuration
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465, // SSL port
      secure: true,
      auth: {
        user: process.env.EMAIL_USER, // your Gmail address
        pass: process.env.EMAIL_PASS, // Gmail App Password
      },
      connectionTimeout: 20000, // 20 seconds timeout
    });

    // Verify connection
    await transporter.verify();
    console.log("SMTP connection verified");

    // Email options
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);

    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
};

module.exports = sendEmail;
