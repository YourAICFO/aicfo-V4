const { sequelize } = require('../src/models');

const runMigrations = async () => {
  try {
    console.log('Running database migrations...');

    // Sync all models
    await sequelize.sync({ alter: true });

    console.log('Migrations completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

runMigrations();
