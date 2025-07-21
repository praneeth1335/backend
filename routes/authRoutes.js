const express = require("express");
const { body } = require("express-validator");
const {
  register,
  login,
  getProfile,
  updateProfile,
  forgotPassword,
  resetPassword,
  logout,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Validation rules
const registerValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please enter a valid email"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
];

const loginValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please enter a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
];

const updateProfileValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("avatar").optional().isURL().withMessage("Avatar must be a valid URL"),
];

const forgotPasswordValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please enter a valid email"),
];

const resetPasswordValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please enter a valid email"),
  body("otp")
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage("OTP must be a 6-digit number"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
];

// Public routes
router.post("/register", registerValidation, register);
router.post("/login", loginValidation, login);
router.post("/forgot-password", forgotPasswordValidation, forgotPassword);
router.post("/reset-password", resetPasswordValidation, resetPassword);

// Protected routes
router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfileValidation, updateProfile);
router.post("/logout", authMiddleware, logout);

module.exports = router;
