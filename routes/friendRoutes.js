const express = require("express");
const { body, param } = require("express-validator");
const authMiddleware = require("../middleware/authMiddleware");

// Import controller functions
const friendController = require("../controllers/friendController");

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Validation rules
const addFriendValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please enter a valid email"),
  body("avatar")
    .optional({ nullable: true, checkFalsy: true })
    .isURL()
    .withMessage("Avatar must be a valid URL"),
  body("notes")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Notes cannot be more than 500 characters"),
];

const updateFriendValidation = [
  param("id").isMongoId().withMessage("Invalid friend ID"),
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("avatar")
    .optional({ nullable: true, checkFalsy: true })
    .isURL()
    .withMessage("Avatar must be a valid URL"),
  body("notes")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Notes cannot be more than 500 characters"),
];

const addTransactionValidation = [
  param("id").isMongoId().withMessage("Invalid friend ID"),
  body("billTotal")
    .isFloat({ min: 0.01 })
    .withMessage("Bill total must be greater than 0"),
  body("userExpense")
    .isFloat({ min: 0 })
    .withMessage("User expense must be 0 or greater"),
  body("friendExpense")
    .isFloat({ min: 0 })
    .withMessage("Friend expense must be 0 or greater"),
  body("paidBy")
    .isIn(["user", "friend"])
    .withMessage('Paid by must be either "user" or "friend"'),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Description cannot be more than 200 characters"),
];

const settleBalanceValidation = [
  param("id").isMongoId().withMessage("Invalid friend ID"),
  body("amount")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Amount must be greater than 0"),
  body("settledBy")
    .optional()
    .isIn(["user", "friend"])
    .withMessage('Settled by must be either "user" or "friend"'),
];

const mongoIdValidation = [
  param("id").isMongoId().withMessage("Invalid friend ID"),
];

// Friend routes
router.get("/", friendController.getFriends);
router.post("/", addFriendValidation, friendController.addFriend);
router.get("/:id", mongoIdValidation, friendController.getFriend);
router.put("/:id", updateFriendValidation, friendController.updateFriend);
router.delete("/:id", mongoIdValidation, friendController.deleteFriend);

// Transaction routes
router.post(
  "/:id/transactions",
  addTransactionValidation,
  friendController.addTransaction
);

// Settlement routes
router.post(
  "/:id/settle",
  settleBalanceValidation,
  friendController.settleBalance
);

module.exports = router;
