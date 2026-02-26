'use strict';

const { loadEnv } = require('./env');

const env = loadEnv();

module.exports = {
  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN,
  bcryptSaltRounds: 12,
};
