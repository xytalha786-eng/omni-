const bcrypt = require('bcryptjs');

// Generate a random 6-digit OTP
const generateOtp = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

// Hash OTP for secure storage
const hashOtp = async (otp) => {
  return await bcrypt.hash(otp, 10);
};

// Verify OTP against hash
const verifyOtp = async (otp, hashedOtp) => {
  return await bcrypt.compare(otp, hashedOtp);
};

module.exports = { generateOtp, hashOtp, verifyOtp };
