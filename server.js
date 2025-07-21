const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// Import routes
const authRoutes = require("./routes/authRoutes");
const friendRoutes = require("./routes/friendRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const emailRoutes = require("./routes/emailRoutes");

// Import database connection
const connectDB = require("./config/db");

const app = express();

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
});
app.use("/api/", limiter);

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Bill Split Manager API is running!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/email", emailRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("Global error handler:", error);

  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? error.stack : undefined,
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`
🚀 Bill Split Manager API Server is running!
📍 Environment: ${process.env.NODE_ENV || "development"}
🌐 Server: http://localhost:${PORT}
📊 Health Check: http://localhost:${PORT}/health
📚 API Base: http://localhost:${PORT}/api
  `);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log("Unhandled Promise Rejection:", err.message);
  // Close server & exit process
  process.exit(1);
});

module.exports = app;
