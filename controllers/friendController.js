const { validationResult } = require("express-validator");
const Friend = require("../models/Friend");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

// @desc    Get all friends
// @route   GET /api/friends
// @access  Private
const getFriends = async (req, res) => {
  try {
    console.log("Getting friends for user:", req.user._id);

    const friends = await Friend.find({
      user: req.user._id,
      isActive: true,
    }).sort({ createdAt: -1 });

    console.log("Found friends:", friends.length);

    // Update balances for all friends (only if there are friends)
    if (friends.length > 0) {
      for (let friend of friends) {
        await friend.calculateBalance();
      }
    }

    // Always update user balances, even if no friends, to ensure analytics are zeroed out
    await req.user.updateBalances();

    res.json({
      success: true,
      count: friends.length,
      data: { friends },
    });
  } catch (error) {
    console.error("Get friends error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching friends",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Get single friend
// @route   GET /api/friends/:id
// @access  Private
const getFriend = async (req, res) => {
  try {
    console.log("Getting friend:", req.params.id, "for user:", req.user._id);

    const friend = await Friend.findOne({
      _id: req.params.id,
      user: req.user._id,
      isActive: true,
    });

    if (!friend) {
      return res.status(404).json({
        success: false,
        message: "Friend not found",
      });
    }

    // Update friend balance
    await friend.calculateBalance();

    res.json({
      success: true,
      data: { friend },
    });
  } catch (error) {
    console.error("Get friend error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching friend",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Add new friend
// @route   POST /api/friends
// @access  Private
const addFriend = async (req, res) => {
  try {
    console.log("Adding friend for user:", req.user._id, "Data:", req.body);

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Validation errors:", errors.array());
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { name, email, avatar, notes } = req.body;

    // Check if friend already exists for this user
    const existingFriend = await Friend.findOne({
      user: req.user._id,
      email: email.toLowerCase(),
      isActive: true,
    });

    if (existingFriend) {
      return res.status(400).json({
        success: false,
        message: "Friend with this email already exists",
      });
    }

    // Create new friend
    const friend = new Friend({
      user: req.user._id,
      name,
      email: email.toLowerCase(),
      avatar: avatar || `https://i.pravatar.cc/150?u=${email}`,
      notes,
    });

    await friend.save();
    console.log("Friend saved:", friend._id);

    // Add friend reference to user
    req.user.friends.push(friend._id);
    await req.user.save();

    // Update user balances after adding a friend
    await req.user.updateBalances();

    res.status(201).json({
      success: true,
      message: "Friend added successfully",
      data: { friend },
    });
  } catch (error) {
    console.error("Add friend error:", error);
    res.status(500).json({
      success: false,
      message: "Server error adding friend",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Update friend
// @route   PUT /api/friends/:id
// @access  Private
const updateFriend = async (req, res) => {
  try {
    console.log("Updating friend:", req.params.id, "Data:", req.body);

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { name, avatar, notes } = req.body;

    const friend = await Friend.findOne({
      _id: req.params.id,
      user: req.user._id,
      isActive: true,
    });

    if (!friend) {
      return res.status(404).json({
        success: false,
        message: "Friend not found",
      });
    }

    // Update fields
    if (name) friend.name = name;
    if (avatar) friend.avatar = avatar;
    if (notes !== undefined) friend.notes = notes;

    await friend.save();

    res.json({
      success: true,
      message: "Friend updated successfully",
      data: { friend },
    });
  } catch (error) {
    console.error("Update friend error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating friend",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Delete friend
// @route   DELETE /api/friends/:id
// @access  Private
const deleteFriend = async (req, res) => {
  try {
    console.log("Deleting friend:", req.params.id);

    const friend = await Friend.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!friend) {
      return res.status(404).json({
        success: false,
        message: "Friend not found",
      });
    }

    // Update balance before checking
    await friend.calculateBalance();

    // Check if there's an outstanding balance
    if (Math.abs(friend.balance) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete ${
          friend.name
        }. You must settle all balances first. Current balance: $${Math.abs(
          friend.balance
        ).toFixed(2)}`,
      });
    }

    // Permanently delete all transactions with this friend
    await Transaction.deleteMany({ friend: friend._id });

    // Remove friend reference from user
    req.user.friends = req.user.friends.filter(
      (friendId) => friendId.toString() !== friend._id.toString()
    );
    await req.user.save();

    // Permanently delete the friend from DB
    await Friend.deleteOne({ _id: friend._id });

    // Update user balances
    await req.user.updateBalances();

    res.json({
      success: true,
      message: "Friend deleted permanently",
    });
  } catch (error) {
    console.error("Delete friend error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting friend",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Add transaction (split bill)
// @route   POST /api/friends/:id/transactions
// @access  Private
const addTransaction = async (req, res) => {
  try {
    console.log(
      "Adding transaction for friend:",
      req.params.id,
      "Data:",
      req.body
    );

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Transaction validation errors:", errors.array());
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { billTotal, userExpense, friendExpense, paidBy, description } =
      req.body;

    // Validate input data types and values
    const parsedBillTotal = parseFloat(billTotal);
    const parsedUserExpense = parseFloat(userExpense);
    const parsedFriendExpense = parseFloat(friendExpense);

    if (isNaN(parsedBillTotal) || parsedBillTotal <= 0) {
      return res.status(400).json({
        success: false,
        message: "Bill total must be a valid number greater than 0",
      });
    }

    if (isNaN(parsedUserExpense) || parsedUserExpense < 0) {
      return res.status(400).json({
        success: false,
        message:
          "User expense must be a valid number greater than or equal to 0",
      });
    }

    if (isNaN(parsedFriendExpense) || parsedFriendExpense < 0) {
      return res.status(400).json({
        success: false,
        message:
          "Friend expense must be a valid number greater than or equal to 0",
      });
    }

    if (!paidBy || !["user", "friend"].includes(paidBy)) {
      return res.status(400).json({
        success: false,
        message: "PaidBy must be either 'user' or 'friend'",
      });
    }

    const friend = await Friend.findOne({
      _id: req.params.id,
      user: req.user._id,
      isActive: true,
    });

    if (!friend) {
      return res.status(404).json({
        success: false,
        message: "Friend not found",
      });
    }

    // Validate expenses sum to bill total
    if (
      Math.abs(parsedUserExpense + parsedFriendExpense - parsedBillTotal) > 0.01
    ) {
      return res.status(400).json({
        success: false,
        message: `The sum of expenses (${
          parsedUserExpense + parsedFriendExpense
        }) should equal the bill total (${parsedBillTotal})`,
      });
    }

    // Create transaction with validated data
    const transactionData = {
      user: req.user._id,
      friend: friend._id,
      type: "expense",
      description:
        description || `Bill split - ${new Date().toLocaleDateString()}`,
      billTotal: parsedBillTotal,
      userExpense: parsedUserExpense,
      friendExpense: parsedFriendExpense,
      paidBy,
    };

    console.log("Creating transaction with data:", transactionData);

    const transaction = new Transaction(transactionData);

    await transaction.save();
    console.log("Transaction saved successfully:", transaction._id);

    // Update friend balance
    await friend.calculateBalance();

    // Set balance after transaction
    transaction.balanceAfter = friend.balance;
    await transaction.save();

    // Update user balances
    await req.user.updateBalances();

    res.status(201).json({
      success: true,
      message: "Transaction added successfully",
      data: {
        transaction: transaction.toDisplayFormat(),
        friend: {
          id: friend._id,
          name: friend.name,
          balance: friend.balance,
          balanceStatus: friend.balanceStatus,
        },
      },
    });
  } catch (error) {
    console.error("Add transaction error:", error);

    // Provide more specific error messages
    let errorMessage = "Server error adding transaction";

    if (error.name === "ValidationError") {
      errorMessage = error.message;
    } else if (error.message && error.message.includes("required")) {
      errorMessage = error.message;
    } else if (error.message && error.message.includes("sum to bill total")) {
      errorMessage = error.message;
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Settle balance with friend
// @route   POST /api/friends/:id/settle
// @access  Private
const settleBalance = async (req, res) => {
  try {
    console.log(
      "Settling balance for friend:",
      req.params.id,
      "Data:",
      req.body
    );

    const { amount, settledBy = "user" } = req.body;

    const friend = await Friend.findOne({
      _id: req.params.id,
      user: req.user._id,
      isActive: true,
    });

    if (!friend) {
      return res.status(404).json({
        success: false,
        message: "Friend not found",
      });
    }

    // Update friend balance
    await friend.calculateBalance();

    if (Math.abs(friend.balance) < 0.01) {
      return res.status(400).json({
        success: false,
        message: "No outstanding balance to settle",
      });
    }

    // Use current balance as settlement amount if not provided
    const settlementAmount = amount || Math.abs(friend.balance);
    const parsedAmount = parseFloat(settlementAmount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Settlement amount must be a valid number greater than 0",
      });
    }

    if (!settledBy || !["user", "friend"].includes(settledBy)) {
      return res.status(400).json({
        success: false,
        message: "SettledBy must be either 'user' or 'friend'",
      });
    }

    // Create settlement transaction
    const transaction = new Transaction({
      user: req.user._id,
      friend: friend._id,
      type: "settlement",
      description: `Settlement payment - $${parsedAmount.toFixed(2)}`,
      amount: parsedAmount,
      settledBy,
    });

    await transaction.save();
    console.log("Settlement transaction saved:", transaction._id);

    // Update friend balance
    await friend.calculateBalance();

    // Set balance after transaction
    transaction.balanceAfter = friend.balance;
    await transaction.save();

    // Update user balances
    await req.user.updateBalances();

    res.json({
      success: true,
      message: "Balance settled successfully",
      data: {
        transaction: transaction.toDisplayFormat(),
        friend: {
          id: friend._id,
          name: friend.name,
          balance: friend.balance,
          balanceStatus: friend.balanceStatus,
        },
      },
    });
  } catch (error) {
    console.error("Settle balance error:", error);

    // Provide more specific error messages
    let errorMessage = "Server error settling balance";

    if (error.name === "ValidationError") {
      errorMessage = error.message;
    } else if (error.message && error.message.includes("required")) {
      errorMessage = error.message;
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  getFriends,
  getFriend,
  addFriend,
  updateFriend,
  deleteFriend,
  addTransaction,
  settleBalance,
};
