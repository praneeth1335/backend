const express = require("express");
const { param, query } = require("express-validator");
const {
  getTransactionHistory,
  getAllTransactions,
  getTransaction,
  deleteTransaction,
  getTransactionStats,
} = require("../controllers/transactionController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Validation rules
const mongoIdValidation = [
  param("id").isMongoId().withMessage("Invalid transaction ID"),
];

const friendIdValidation = [
  param("friendId").isMongoId().withMessage("Invalid friend ID"),
];

const paginationValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

// Transaction routes
router.get("/", paginationValidation, getAllTransactions);
router.get("/stats", getTransactionStats);
router.get(
  "/friend/:friendId",
  friendIdValidation,
  paginationValidation,
  getTransactionHistory
);
router.get("/:id", mongoIdValidation, getTransaction);
router.delete("/:id", mongoIdValidation, deleteTransaction);

module.exports = router;
