const mongoose = require("mongoose");
//hiiii

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    friend: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Friend",
      required: true,
    },
    type: {
      type: String,
      enum: ["expense", "settlement"],
      required: true,
    },
    description: {
      type: String,
      required: [true, "Transaction description is required"],
      trim: true,
      maxlength: [200, "Description cannot exceed 200 characters"],
    },

    // For expense transactions
    billTotal: {
      type: Number,
      min: [0, "Bill total cannot be negative"],
      validate: {
        validator: function (value) {
          // Only validate if this is an expense transaction
          if (this.type === "expense") {
            return value != null && value > 0;
          }
          return true;
        },
        message: "Bill total is required for expense transactions",
      },
    },
    userExpense: {
      type: Number,
      min: [0, "User expense cannot be negative"],
      validate: {
        validator: function (value) {
          // Only validate if this is an expense transaction
          if (this.type === "expense") {
            return value != null && value >= 0;
          }
          return true;
        },
        message: "User expense is required for expense transactions",
      },
    },
    friendExpense: {
      type: Number,
      min: [0, "Friend expense cannot be negative"],
      validate: {
        validator: function (value) {
          // Only validate if this is an expense transaction
          if (this.type === "expense") {
            return value != null && value >= 0;
          }
          return true;
        },
        message: "Friend expense is required for expense transactions",
      },
    },
    paidBy: {
      type: String,
      enum: ["user", "friend"],
      validate: {
        validator: function (value) {
          // Only validate if this is an expense transaction
          if (this.type === "expense") {
            return value != null && ["user", "friend"].includes(value);
          }
          return true;
        },
        message: "PaidBy is required for expense transactions",
      },
    },

    // For settlement transactions
    amount: {
      type: Number,
      min: [0, "Settlement amount cannot be negative"],
      validate: {
        validator: function (value) {
          // Only validate if this is a settlement transaction
          if (this.type === "settlement") {
            return value != null && value > 0;
          }
          return true;
        },
        message: "Amount is required for settlement transactions",
      },
    },
    settledBy: {
      type: String,
      enum: ["user", "friend"],
      validate: {
        validator: function (value) {
          // Only validate if this is a settlement transaction
          if (this.type === "settlement") {
            return value != null && ["user", "friend"].includes(value);
          }
          return true;
        },
        message: "SettledBy is required for settlement transactions",
      },
    },

    // Balance after this transaction
    balanceAfter: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Enhanced validation for expense transactions
transactionSchema.pre("save", function (next) {
  try {
    console.log("Transaction pre-save validation:", {
      type: this.type,
      billTotal: this.billTotal,
      userExpense: this.userExpense,
      friendExpense: this.friendExpense,
      paidBy: this.paidBy,
      amount: this.amount,
      settledBy: this.settledBy,
    });

    if (this.type === "expense") {
      // Check required fields for expense transactions
      if (this.billTotal == null || this.billTotal <= 0) {
        return next(
          new Error(
            "Bill total is required and must be greater than 0 for expense transactions"
          )
        );
      }

      if (this.userExpense == null || this.userExpense < 0) {
        return next(
          new Error(
            "User expense is required and cannot be negative for expense transactions"
          )
        );
      }

      if (this.friendExpense == null || this.friendExpense < 0) {
        return next(
          new Error(
            "Friend expense is required and cannot be negative for expense transactions"
          )
        );
      }

      if (!this.paidBy || !["user", "friend"].includes(this.paidBy)) {
        return next(
          new Error(
            'PaidBy is required and must be either "user" or "friend" for expense transactions'
          )
        );
      }

      // Validate that expenses sum to bill total (with small tolerance for floating point)
      const sum = parseFloat(this.userExpense) + parseFloat(this.friendExpense);
      const total = parseFloat(this.billTotal);

      if (Math.abs(sum - total) > 0.01) {
        return next(
          new Error(
            `User expense (${this.userExpense}) and friend expense (${this.friendExpense}) must sum to bill total (${this.billTotal}). Current sum: ${sum}`
          )
        );
      }
    }

    if (this.type === "settlement") {
      // Check required fields for settlement transactions
      if (this.amount == null || this.amount <= 0) {
        return next(
          new Error(
            "Amount is required and must be greater than 0 for settlement transactions"
          )
        );
      }

      if (!this.settledBy || !["user", "friend"].includes(this.settledBy)) {
        return next(
          new Error(
            'SettledBy is required and must be either "user" or "friend" for settlement transactions'
          )
        );
      }
    }

    next();
  } catch (error) {
    console.error("Transaction validation error:", error);
    next(error);
  }
});

// Index for efficient queries
transactionSchema.index({ user: 1, friend: 1, createdAt: -1 });
transactionSchema.index({ friend: 1, createdAt: -1 });
transactionSchema.index({ user: 1, isActive: 1 });

// Static method to get transaction history for a friend
transactionSchema.statics.getHistoryForFriend = async function (
  userId,
  friendId,
  options = {}
) {
  try {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    const transactions = await this.find({
      user: userId,
      friend: friendId,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("friend", "name email avatar");

    const total = await this.countDocuments({
      user: userId,
      friend: friendId,
      isActive: true,
    });

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("Error getting transaction history:", error);
    throw error;
  }
};

// Instance method to format transaction for display
transactionSchema.methods.toDisplayFormat = function () {
  try {
    const transaction = this.toObject();

    if (transaction.type === "expense") {
      transaction.displayText = `${
        transaction.description
      } - $${transaction.billTotal.toFixed(2)}`;
      transaction.userAmount =
        transaction.paidBy === "user" ? transaction.billTotal : 0;
      transaction.friendAmount =
        transaction.paidBy === "friend" ? transaction.billTotal : 0;
    } else if (transaction.type === "settlement") {
      transaction.displayText = `Settlement - $${transaction.amount.toFixed(
        2
      )}`;
      transaction.userAmount =
        transaction.settledBy === "user" ? transaction.amount : 0;
      transaction.friendAmount =
        transaction.settledBy === "friend" ? transaction.amount : 0;
    }

    return transaction;
  } catch (error) {
    console.error("Error formatting transaction for display:", error);
    return this.toObject();
  }
};

module.exports = mongoose.model("Transaction", transactionSchema);
