const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
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

    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Create user
    const user = new User({
      name,
      email,
      password,
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          isEmailVerified: user.isEmailVerified,
          totalOwedToUser: user.totalOwedToUser,
          totalUserOwes: user.totalUserOwes,
          netBalance: user.netBalance,
          friendCount: user.friendCount,
        },
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
// authController.js - login function
const login = async (req, res) => {
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

    const { email, password } = req.body;

    // Check if user exists and include password for comparison
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate token
    const token = generateToken(user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          isEmailVerified: user.isEmailVerified,
          totalOwedToUser: user.totalOwedToUser,
          totalUserOwes: user.totalUserOwes,
          netBalance: user.netBalance,
          friendCount: user.friendCount,
          lastLogin: user.lastLogin,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
};
// const login = async (req, res) => {
//   try {
//     // Check for validation errors
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({
//         success: false,
//         message: "Validation failed",
//         errors: errors.array(),
//       });
//     }

//     const { email, password } = req.body;

//     // Check if user exists and include password for comparison
//     const user = await User.findOne({ email }).select("+password");
//     if (!user) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid credentials",
//       });
//     }

//     // Check if account is active
//     if (!user.isActive) {
//       return res.status(401).json({
//         success: false,
//         message: "Account is deactivated",
//       });
//     }

//     // Check password
//     const isPasswordValid = await user.comparePassword(password);
//     if (!isPasswordValid) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid credentials",
//       });
//     }

//     // Generate token
//     const token = generateToken(user._id);

//     // Update last login
//     user.lastLogin = new Date();
//     await user.save();

//     res.json({
//       success: true,
//       message: "Login successful",
//       data: {
//         token,
//         user: {
//           id: user._id,
//           name: user.name,
//           email: user.email,
//           avatar: user.avatar,
//           isEmailVerified: user.isEmailVerified,
//           totalOwedToUser: user.totalOwedToUser,
//           totalUserOwes: user.totalUserOwes,
//           netBalance: user.netBalance,
//           friendCount: user.friendCount,
//           lastLogin: user.lastLogin,
//         },
//       },
//     });
//   } catch (error) {
//     console.error("Login error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error during login",
//     });
//   }
// };

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    // Update user balances before sending profile
    await req.user.updateBalances();

    res.json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          avatar: req.user.avatar,
          isEmailVerified: req.user.isEmailVerified,
          totalOwedToYou: req.user.totalOwedToYou,
          totalYouOwe: req.user.totalYouOwe,
          netBalance: req.user.netBalance,
          friendCount: req.user.friendCount,
          lastLogin: req.user.lastLogin,
          createdAt: req.user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching profile",
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
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

    const { name, avatar } = req.body;
    const user = req.user;

    // Update fields
    if (name) user.name = name;
    if (avatar) user.avatar = avatar;

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          isEmailVerified: user.isEmailVerified,
          totalOwedToUser: user.totalOwedToUser,
          totalUserOwes: user.totalUserOwes,
          netBalance: user.netBalance,
          friendCount: user.friendCount,
        },
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating profile",
    });
  }
};

// @desc    Request password reset OTP
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with this email",
      });
    }

    // Generate OTP
    const otp = user.generateResetOTP();
    await user.save();

    // Send OTP via email
    try {
      await sendEmail({
        to: user.email,
        subject: "Password Reset OTP - Bill Split Manager",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>Hi ${user.name},</p>
            <p>You requested a password reset for your Bill Split Manager account.</p>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <h3 style="color: #007bff; font-size: 24px; margin: 0;">Your OTP: ${otp}</h3>
            </div>
            <p>This OTP will expire in 10 minutes.</p>
            <p>If you didn't request this password reset, please ignore this email.</p>
            <hr style="margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">Bill Split Manager Team</p>
          </div>
        `,
      });

      res.json({
        success: true,
        message: "Password reset OTP sent to your email",
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);

      // Clear OTP if email fails
      user.resetPasswordOTP = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      res.status(500).json({
        success: false,
        message: "Error sending email. Please try again.",
      });
    }
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error processing password reset request",
    });
  }
};

// @desc    Reset password with OTP
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
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

    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({
      email,
      resetPasswordOTP: otp,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Update password
    user.password = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error resetting password",
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    // In a stateless JWT system, logout is handled client-side
    // But we can track logout time for analytics
    req.user.lastLogin = new Date();
    await req.user.save();

    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during logout",
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  forgotPassword,
  resetPassword,
  logout,
};
