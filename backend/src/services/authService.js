const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { User, Company, Subscription } = require('../models');
const { jwtSecret, jwtExpiresIn, bcryptSaltRounds } = require('../config/auth');

const generateToken = (userId) => {
  return jwt.sign({ userId }, jwtSecret, { expiresIn: jwtExpiresIn });
};

const hashPassword = async (password) => {
  return bcrypt.hash(password, bcryptSaltRounds);
};

const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

const register = async (userData) => {
  const { email, password, firstName, lastName, phone } = userData;

  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    throw new Error('Email already registered');
  }

  const passwordHash = await hashPassword(password);
  const verificationToken = uuidv4();

  const user = await User.create({
    email,
    passwordHash,
    firstName,
    lastName,
    phone,
    verificationToken
  });

  const token = generateToken(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerified
    },
    token
  };
};

const login = async (email, password) => {
  const user = await User.findOne({ where: { email } });
  
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isValidPassword = await comparePassword(password, user.passwordHash);
  
  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }

  if (!user.isActive) {
    throw new Error('Account is deactivated');
  }

  await user.update({ lastLoginAt: new Date() });

  const token = generateToken(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerified
    },
    token
  };
};

const getProfile = async (userId) => {
  const user = await User.findByPk(userId, {
    attributes: { exclude: ['passwordHash', 'verificationToken', 'resetToken'] }
  });

  if (!user) {
    throw new Error('User not found');
  }

  return user;
};

const updateProfile = async (userId, updateData) => {
  const user = await User.findByPk(userId);
  
  if (!user) {
    throw new Error('User not found');
  }

  const allowedUpdates = ['firstName', 'lastName', 'phone'];
  const updates = {};
  
  allowedUpdates.forEach(field => {
    if (updateData[field] !== undefined) {
      updates[field] = updateData[field];
    }
  });

  await user.update(updates);

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone
  };
};

const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findByPk(userId);
  
  if (!user) {
    throw new Error('User not found');
  }

  const isValidPassword = await comparePassword(currentPassword, user.passwordHash);
  
  if (!isValidPassword) {
    throw new Error('Current password is incorrect');
  }

  const newPasswordHash = await hashPassword(newPassword);
  await user.update({ passwordHash: newPasswordHash });

  return { message: 'Password updated successfully' };
};

const createPasswordResetToken = async (email) => {
  const user = await User.findOne({ where: { email } });
  
  if (!user) {
    return { message: 'If an account exists, a reset email will be sent' };
  }

  const resetToken = uuidv4();
  const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await user.update({ resetToken, resetTokenExpiry });

  return { resetToken, user };
};

const resetPassword = async (token, newPassword) => {
  const user = await User.findOne({
    where: {
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }
    }
  });

  if (!user) {
    throw new Error('Invalid or expired reset token');
  }

  const newPasswordHash = await hashPassword(newPassword);
  await user.update({
    passwordHash: newPasswordHash,
    resetToken: null,
    resetTokenExpiry: null
  });

  return { message: 'Password reset successfully' };
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  createPasswordResetToken,
  resetPassword,
  generateToken,
  hashPassword
};
