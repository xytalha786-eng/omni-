const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const generateToken = require('../utils/generateToken');
const { generateOtp, hashOtp, verifyOtp } = require('../utils/generateOtp');
const { sendOtpEmail } = require('../utils/sendEmail');
const xss = require('xss');

exports.register = async (req, res, next) => {
  try {
    let { firstName, lastName, email, phone, password } = req.body;

    firstName = xss(firstName?.trim());
    lastName = xss(lastName?.trim());
    email = email?.trim().toLowerCase();
    phone = phone?.trim().replace(/[-\s]/g, '');

    if (!firstName || !lastName || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }
    if (!/^03[0-9]{9}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Invalid phone number. Use format: 03XXXXXXXXX' });
    }
    if (password.length < 8 || !/(?=.*[A-Z])(?=.*[0-9])/.test(password)) {
      return res.status(400).json({ success: false, message: 'Password must be 8+ chars with one uppercase and one number' });
    }

    const { data: existing } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
    if (existing && existing.is_verified) {
      return res.status(400).json({ success: false, message: 'Email already registered. Please log in.' });
    }

    const otp = generateOtp();
    const hashedOtp = await hashOtp(otp);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const passwordHash = await bcrypt.hash(password, 12);

    if (existing && !existing.is_verified) {
      const { error } = await supabase
        .from('users')
        .update({
          first_name: firstName,
          last_name: lastName,
          phone,
          password_hash: passwordHash,
          otp_hash: hashedOtp,
          otp_expiry: otpExpiry,
          otp_attempts: 0,
        })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('users').insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        password_hash: passwordHash,
        role: 'user',
        is_verified: false,
        otp_hash: hashedOtp,
        otp_expiry: otpExpiry,
        otp_attempts: 0,
      });
      if (error) throw error;
    }

    await sendOtpEmail(email, firstName, otp);

    res.status(200).json({
      success: true,
      message: `Verification code sent to ${email}. Check your inbox.`,
      email,
    });
  } catch (error) {
    next(error);
  }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const { data: user, error } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).maybeSingle();
    if (error) throw error;
    if (!user) return res.status(404).json({ success: false, message: 'Account not found. Please register again.' });
    if (user.is_verified) return res.status(400).json({ success: false, message: 'Account already verified. Please log in.' });
    if (!user.otp_hash || !user.otp_expiry) return res.status(400).json({ success: false, message: 'No OTP found. Please register again.' });
    if (new Date() > new Date(user.otp_expiry)) return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    if ((user.otp_attempts || 0) >= 3) return res.status(429).json({ success: false, message: 'Too many wrong attempts. Please register again.' });

    const isMatch = await verifyOtp(otp, user.otp_hash);
    if (!isMatch) {
      const attempts = (user.otp_attempts || 0) + 1;
      await supabase.from('users').update({ otp_attempts: attempts }).eq('id', user.id);
      return res.status(400).json({ success: false, message: `Incorrect code. ${Math.max(0, 3 - attempts)} attempt(s) remaining.` });
    }

    const { error: upErr } = await supabase
      .from('users')
      .update({ is_verified: true, otp_hash: null, otp_expiry: null, otp_attempts: 0 })
      .eq('id', user.id);
    if (upErr) throw upErr;

    const token = generateToken(user.id, user.role);
    res.status(200).json({
      success: true,
      message: 'Account verified successfully! Welcome to Omni.',
      token,
      user: {
        _id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.resendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const { data: user, error } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).maybeSingle();
    if (error) throw error;
    if (!user) return res.status(404).json({ success: false, message: 'Account not found' });
    if (user.is_verified) return res.status(400).json({ success: false, message: 'Account already verified' });

    const otp = generateOtp();
    const hashedOtp = await hashOtp(otp);

    const { error: upErr } = await supabase
      .from('users')
      .update({ otp_hash: hashedOtp, otp_expiry: new Date(Date.now() + 10 * 60 * 1000).toISOString(), otp_attempts: 0 })
      .eq('id', user.id);
    if (upErr) throw upErr;

    await sendOtpEmail(email, user.first_name, otp);
    res.json({ success: true, message: 'New verification code sent to your email.' });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });

    const { data: user, error } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).maybeSingle();
    if (error) throw error;
    if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password' });
    if (!user.is_verified) {
      return res.status(401).json({ success: false, message: 'Account not verified. Please check your email for the OTP.', needsVerification: true, email: user.email });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash || '');
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const token = generateToken(user.id, user.role);
    res.json({
      success: true,
      message: `Welcome back, ${user.first_name}!`,
      token,
      user: {
        _id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

exports.updateMe = async (req, res, next) => {
  try {
    let { firstName, lastName, phone, password, newPassword } = req.body;
    firstName = firstName ? xss(firstName.trim()) : undefined;
    lastName = lastName ? xss(lastName.trim()) : undefined;
    phone = phone ? phone.trim().replace(/[-\s]/g, '') : undefined;

    const { data: user, error } = await supabase.from('users').select('*').eq('id', req.user._id).single();
    if (error) throw error;

    const updates = {};
    if (firstName) updates.first_name = firstName;
    if (lastName) updates.last_name = lastName;
    if (phone) {
      if (!/^03[0-9]{9}$/.test(phone)) return res.status(400).json({ success: false, message: 'Invalid phone number' });
      updates.phone = phone;
    }

    if (newPassword) {
      if (!password) return res.status(400).json({ success: false, message: 'Current password is required' });
      const isMatch = await bcrypt.compare(password, user.password_hash || '');
      if (!isMatch) return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
      updates.password_hash = await bcrypt.hash(newPassword, 12);
    }

    const { data: updated, error: upErr } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user._id)
      .select('*')
      .single();
    if (upErr) throw upErr;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: updated.id,
        firstName: updated.first_name,
        lastName: updated.last_name,
        email: updated.email,
        phone: updated.phone,
        role: updated.role,
      },
    });
  } catch (error) {
    next(error);
  }
};
