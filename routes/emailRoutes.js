const express = require("express");
const { body, validationResult } = require("express-validator");
const sendEmail = require("../utils/sendEmail");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Send email to friend
// const sendEmailValidation = [
//   body("to")
//     .isEmail()
//     .normalizeEmail()
//     .withMessage("Please enter a valid email address"),
//   body("subject")
//     .trim()
//     .isLength({ min: 1, max: 200 })
//     .withMessage("Subject must be between 1 and 200 characters"),
//   body("message")
//     .trim()
//     .isLength({ min: 1, max: 2000 })
//     .withMessage("Message must be between 1 and 2000 characters"),
// ];

router.post("/send", authMiddleware, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { to, subject, message } = req.body;
    const user = req.user;
    console.log(to, subject, message);

    // Create email content
    const emailOptions = {
      to: to,
      subject: subject,
      text: message,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color:black;">Quantify</h1>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; white-space: pre-line;">${message}</p>
          </div>
          <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
          <p style="color: #6c757d; font-size: 14px;">
            This email was sent from Quantify by ${user.name} (${user.email}).
          </p>
          <p style="color: #6c757d; font-size: 12px;">
            If you believe this email was sent in error, please contact the sender directly.
          </p>
        </div>
      `,
    };

    // Send email
    const emailSent = await sendEmail(emailOptions);

    if (emailSent) {
      res.status(200).json({
        success: true,
        message: "Email sent successfully",
        data: {
          to: to,
          subject: subject,
          sentAt: new Date().toISOString(),
        },
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to send email. Please try again later.",
      });
    }
  } catch (error) {
    console.error("Send email error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
