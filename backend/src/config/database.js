const { Sequelize } = require('sequelize');
require('dotenv').config();

// Validate DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ CRITICAL: DATABASE_URL environment variable is not set');
  console.error('Please set DATABASE_URL in your Railway service variables');
  console.error('Example: DATABASE_URL=postgres://user:pass@host:port/db');
  process.exit(1);
}

// Log masked DATABASE_URL for debugging (never log full URL)
const maskedUrl = process.env.DATABASE_URL.replace(/:\/\/[^@]+@/, '://****:****@');
console.log('✅ DATABASE_URL configured:', maskedUrl);

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions:
    process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true'
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},
});

module.exports = { sequelize };
