// test-email.js
const nodemailer = require("nodemailer");
require("dotenv").config({ path: __dirname + "/../.env" });
console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log(
  "EMAIL_PASS:",
  process.env.EMAIL_PASS ? "✅ Present" : "❌ Missing"
);

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for port 465, false for port 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const testEmail = async () => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: "126003050@sastra.ac.in", // Replace with your real email
      subject: "Test Email - Bill Split Manager",
      text: "If you receive this, your email configuration is working!",
    });
    console.log("✅ Email sent successfully:", info.messageId);
  } catch (error) {
    console.error("❌ Email failed:", error);
  }
};

testEmail();
