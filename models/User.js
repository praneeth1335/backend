const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name"],
      trim: true,
      maxlength: [50, "Name cannot be more than 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    avatar: {
      type: String,
      default: function () {
        return `https://i.pravatar.cc/150?u=${this.email}`;
      },
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Friend",
      },
    ],
    // Balance tracking fields
    totalOwedToYou: {
      type: Number,
      default: 0,
    },
    totalYouOwe: {
      type: Number,
      default: 0,
    },
    netBalance: {
      type: Number,
      default: 0,
    },
    // Password reset fields
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    // OTP fields
    otp: String,
    otpExpire: Date,
    isVerified: {
      type: Boolean,
      default: false,
    },
    // Account status
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ isActive: 1 });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error("Password comparison failed");
  }
};

// Update user balances based on friend balances
userSchema.methods.updateBalances = async function () {
  try {
    console.log("Updating balances for user:", this._id);

    // Get all active friends for this user
    const Friend = mongoose.model("Friend");
    const friends = await Friend.find({
      user: this._id,
      isActive: true,
    });

    console.log("Found friends for balance calculation:", friends.length);

    // Initialize balances
    let totalOwedToYou = 0;
    let totalYouOwe = 0;

    // If no friends, set all balances to zero
    if (friends.length === 0) {
      this.totalOwedToYou = 0;
      this.totalYouOwe = 0;
      this.netBalance = 0;
      await this.save();
      console.log("No friends found, balances set to zero");
      return;
    }

    // Calculate balances from all friends
    for (const friend of friends) {
      // Ensure friend balance is calculated
      await friend.calculateBalance();

      const balance = friend.balance || 0;

      if (balance > 0) {
        // Friend owes you money
        totalOwedToYou += balance;
      } else if (balance < 0) {
        // You owe friend money
        totalYouOwe += Math.abs(balance);
      }
    }

    // Update user balance fields
    this.totalOwedToYou = Math.round(totalOwedToYou * 100) / 100; // Round to 2 decimal places
    this.totalYouOwe = Math.round(totalYouOwe * 100) / 100;
    this.netBalance = Math.round((totalOwedToYou - totalYouOwe) * 100) / 100;

    await this.save();

    console.log("Updated user balances:", {
      totalOwedToYou: this.totalOwedToYou,
      totalYouOwe: this.totalYouOwe,
      netBalance: this.netBalance,
    });
  } catch (error) {
    console.error("Error updating user balances:", error);
    // Set balances to zero on error to prevent undefined values
    this.totalOwedToYou = 0;
    this.totalYouOwe = 0;
    this.netBalance = 0;
    await this.save();
  }
};

// Get user profile with calculated balances
userSchema.methods.getProfile = async function () {
  // Update balances before returning profile
  await this.updateBalances();

  return {
    id: this._id,
    name: this.name,
    email: this.email,
    avatar: this.avatar,
    totalOwedToYou: this.totalOwedToYou || 0,
    totalYouOwe: this.totalYouOwe || 0,
    netBalance: this.netBalance || 0,
    friendsCount: this.friends.length,
    isVerified: this.isVerified,
    createdAt: this.createdAt,
  };
};

// Generate password reset token
userSchema.methods.generateResetToken = function () {
  const crypto = require("crypto");
  const resetToken = crypto.randomBytes(20).toString("hex");

  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

// Generate OTP
userSchema.methods.generateOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = otp;
  this.otpExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  return otp;
};

// Verify OTP
userSchema.methods.verifyOTP = function (candidateOTP) {
  if (!this.otp || !this.otpExpire) {
    return false;
  }

  if (Date.now() > this.otpExpire) {
    return false;
  }

  return this.otp === candidateOTP;
};

// Clear OTP
userSchema.methods.clearOTP = function () {
  this.otp = undefined;
  this.otpExpire = undefined;
};

// JSON transform to exclude sensitive data
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpire;
  delete user.otp;
  delete user.otpExpire;
  return user;
};

module.exports = mongoose.model("User", userSchema);
