const { validationResult } = require("express-validator");
const Transaction = require("../models/Transaction");
const Friend = require("../models/Friend");

// @desc    Get transaction history for a friend
// @route   GET /api/transactions/friend/:friendId
// @access  Private
const getTransactionHistory = async (req, res) => {
  try {
    const { friendId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Verify friend belongs to user
    const friend = await Friend.findOne({
      _id: friendId,
      user: req.user._id,
      isActive: true,
    });

    if (!friend) {
      return res.status(404).json({
        success: false,
        message: "Friend not found",
      });
    }

    // Get transaction history
    const result = await Transaction.getHistoryForFriend(
      req.user._id,
      friendId,
      { page: parseInt(page), limit: parseInt(limit) }
    );

    // Format transactions for display
    const formattedTransactions = result.transactions.map((transaction) =>
      transaction.toDisplayFormat()
    );

    res.json({
      success: true,
      data: {
        friend: {
          id: friend._id,
          name: friend.name,
          email: friend.email,
          avatar: friend.avatar,
          balance: friend.balance,
          balanceStatus: friend.balanceStatus,
        },
        transactions: formattedTransactions,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error("Get transaction history error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching transaction history",
    });
  }
};

// @desc    Get all transactions for user
// @route   GET /api/transactions
// @access  Private
const getAllTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({
      user: req.user._id,
      isActive: true,
    })
      .populate("friend", "name email avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments({
      user: req.user._id,
      isActive: true,
    });

    // Format transactions for display
    const formattedTransactions = transactions.map((transaction) =>
      transaction.toDisplayFormat()
    );

    res.json({
      success: true,
      data: {
        transactions: formattedTransactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get all transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching transactions",
    });
  }
};

// @desc    Get single transaction
// @route   GET /api/transactions/:id
// @access  Private
const getTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id,
      isActive: true,
    }).populate("friend", "name email avatar");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    res.json({
      success: true,
      data: {
        transaction: transaction.toDisplayFormat(),
      },
    });
  } catch (error) {
    console.error("Get transaction error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching transaction",
    });
  }
};

// @desc    Delete transaction (soft delete)
// @route   DELETE /api/transactions/:id
// @access  Private
const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id,
      isActive: true,
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    // Soft delete transaction
    transaction.isActive = false;
    await transaction.save();

    // Recalculate friend balance
    const friend = await Friend.findById(transaction.friend);
    if (friend) {
      await friend.calculateBalance();
      await req.user.updateBalances();
    }

    res.json({
      success: true,
      message: "Transaction deleted successfully",
    });
  } catch (error) {
    console.error("Delete transaction error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting transaction",
    });
  }
};

// @desc    Get transaction statistics
// @route   GET /api/transactions/stats
// @access  Private
const getTransactionStats = async (req, res) => {
  try {
    const stats = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          isActive: true,
        },
      },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          totalAmount: {
            $sum: {
              $cond: [{ $eq: ["$type", "expense"] }, "$billTotal", "$amount"],
            },
          },
        },
      },
    ]);

    const formattedStats = {
      expenses: {
        count: 0,
        totalAmount: 0,
      },
      settlements: {
        count: 0,
        totalAmount: 0,
      },
    };

    stats.forEach((stat) => {
      if (stat._id === "expense") {
        formattedStats.expenses = {
          count: stat.count,
          totalAmount: stat.totalAmount,
        };
      } else if (stat._id === "settlement") {
        formattedStats.settlements = {
          count: stat.count,
          totalAmount: stat.totalAmount,
        };
      }
    });

    res.json({
      success: true,
      data: { stats: formattedStats },
    });
  } catch (error) {
    console.error("Get transaction stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching transaction statistics",
    });
  }
};

module.exports = {
  getTransactionHistory,
  getAllTransactions,
  getTransaction,
  deleteTransaction,
  getTransactionStats,
};
