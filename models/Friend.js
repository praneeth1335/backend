const mongoose = require("mongoose");

const friendSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Please provide friend name"],
      trim: true,
      maxlength: [50, "Name cannot be more than 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Please provide friend email"],
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    avatar: {
      type: String,
      default: function () {
        return `https://i.pravatar.cc/150?u=${this.email}`;
      },
    },
    notes: {
      type: String,
      maxlength: [500, "Notes cannot be more than 500 characters"],
    },
    balance: {
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

// Indexes for better query performance
friendSchema.index({ user: 1, email: 1 });
friendSchema.index({ user: 1, isActive: 1 });

// Virtual for balance status
friendSchema.virtual("balanceStatus").get(function () {
  const balance = this.balance || 0;
  if (Math.abs(balance) < 0.01) {
    return "settled";
  } else if (balance > 0) {
    return "owes_you";
  } else {
    return "you_owe";
  }
});

// Calculate balance based on transactions
friendSchema.methods.calculateBalance = async function () {
  try {
    console.log("Calculating balance for friend:", this._id);

    const Transaction = mongoose.model("Transaction");

    // Get all active transactions for this friend
    const transactions = await Transaction.find({
      friend: this._id,
      user: this.user,
      isActive: true,
    }).sort({ createdAt: 1 });

    console.log(
      "Found transactions for balance calculation:",
      transactions.length
    );

    let balance = 0;

    // Calculate balance from all transactions
    for (const transaction of transactions) {
      if (transaction.type === "expense") {
        // For expense transactions
        const userExpense = transaction.userExpense || 0;
        const friendExpense = transaction.friendExpense || 0;
        const paidBy = transaction.paidBy;

        if (paidBy === "user") {
          // User paid the bill
          // Friend owes their share to user
          balance += friendExpense;
        } else if (paidBy === "friend") {
          // Friend paid the bill
          // User owes their share to friend
          balance -= userExpense;
        }
      } else if (transaction.type === "settlement") {
        // For settlement transactions
        const amount = transaction.amount || 0;
        const settledBy = transaction.settledBy;

        if (settledBy === "user") {
          // User paid friend
          balance -= amount;
        } else if (settledBy === "friend") {
          // Friend paid user
          balance += amount;
        }
      }
    }

    // Round to 2 decimal places to avoid floating point issues
    this.balance = Math.round(balance * 100) / 100;
    await this.save();

    console.log("Updated friend balance:", this.balance);
    return this.balance;
  } catch (error) {
    console.error("Error calculating friend balance:", error);
    // Set balance to 0 on error to prevent undefined values
    this.balance = 0;
    await this.save();
    return 0;
  }
};

// Get friend summary with balance
friendSchema.methods.getSummary = async function () {
  // Ensure balance is calculated
  await this.calculateBalance();

  return {
    id: this._id,
    name: this.name,
    email: this.email,
    avatar: this.avatar,
    balance: this.balance || 0,
    balanceStatus: this.balanceStatus,
    notes: this.notes,
    createdAt: this.createdAt,
  };
};

// Get transaction count for this friend
friendSchema.methods.getTransactionCount = async function () {
  try {
    const Transaction = mongoose.model("Transaction");
    const count = await Transaction.countDocuments({
      friend: this._id,
      user: this.user,
      isActive: true,
    });
    return count;
  } catch (error) {
    console.error("Error getting transaction count:", error);
    return 0;
  }
};

// Validate that friend doesn't already exist for user
friendSchema.pre("save", async function (next) {
  if (this.isNew) {
    try {
      const existingFriend = await this.constructor.findOne({
        user: this.user,
        email: this.email,
        isActive: true,
        _id: { $ne: this._id },
      });

      if (existingFriend) {
        const error = new Error("Friend with this email already exists");
        error.code = "DUPLICATE_FRIEND";
        return next(error);
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Ensure virtual fields are included in JSON output
friendSchema.set("toJSON", { virtuals: true });
friendSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Friend", friendSchema);
