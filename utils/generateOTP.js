/**
 * Generate a random OTP (One-Time Password)
 * @param {number} length - Length of the OTP (default: 6)
 * @returns {string} - Generated OTP
 */
const generateOTP = (length = 6) => {
  const digits = "0123456789";
  let otp = "";

  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }

  return otp;
};

/**
 * Generate a secure numeric OTP
 * @param {number} length - Length of the OTP (default: 6)
 * @returns {string} - Generated OTP
 */
const generateSecureOTP = (length = 6) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
};

/**
 * Validate OTP format
 * @param {string} otp - OTP to validate
 * @param {number} expectedLength - Expected length (default: 6)
 * @returns {boolean} - True if valid format
 */
const validateOTPFormat = (otp, expectedLength = 6) => {
  const otpRegex = new RegExp(`^\\d{${expectedLength}}$`);
  return otpRegex.test(otp);
};

/**
 * Check if OTP is expired
 * @param {Date} expirationTime - OTP expiration timestamp
 * @returns {boolean} - True if expired
 */
const isOTPExpired = (expirationTime) => {
  return new Date() > new Date(expirationTime);
};

module.exports = {
  generateOTP,
  generateSecureOTP,
  validateOTPFormat,
  isOTPExpired,
};
