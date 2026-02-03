const { User, Company, Subscription, FinancialTransaction, CashBalance } = require('../src/models');
const bcrypt = require('bcryptjs');

const seedDatabase = async () => {
  try {
    console.log('Seeding database...');

    // Create demo user
    const passwordHash = await bcrypt.hash('demo123456', 12);
    const user = await User.create({
      email: 'demo@aicfo.com',
      passwordHash,
      firstName: 'Demo',
      lastName: 'User',
      emailVerified: true
    });

    console.log('Created demo user:', user.email);

    // Create demo company
    const company = await Company.create({
      name: 'Demo Tech Solutions Pvt Ltd',
      industry: 'Technology',
      currency: 'INR',
      ownerId: user.id,
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India'
    });

    console.log('Created demo company:', company.name);

    // Create subscription (FREE plan)
    await Subscription.create({
      companyId: company.id,
      planType: 'FREE',
      status: 'ACTIVE',
      maxTransactions: 100,
      maxIntegrations: 0,
      features: {
        manualEntry: true,
        aiInsights: false,
        aiChat: false,
        tally: false,
        zoho: false,
        quickbooks: false,
        alerts: false,
        exports: false
      }
    });

    console.log('Created subscription for company');

    // Create sample cash balance
    await CashBalance.create({
      companyId: company.id,
      date: new Date(),
      amount: 500000,
      source: 'MANUAL',
      bankName: 'HDFC Bank',
      isPrimary: true
    });

    console.log('Created sample cash balance');

    // Create sample transactions
    const categories = {
      REVENUE: ['Product Sales', 'Service Revenue', 'Consulting'],
      EXPENSE: ['Salaries', 'Rent', 'Marketing', 'Software', 'Utilities']
    };

    for (let i = 0; i < 20; i++) {
      const isRevenue = Math.random() > 0.4;
      const type = isRevenue ? 'REVENUE' : 'EXPENSE';
      const categoryList = categories[type];
      const category = categoryList[Math.floor(Math.random() * categoryList.length)];
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 90));

      await FinancialTransaction.create({
        companyId: company.id,
        date: date.toISOString().split('T')[0],
        type,
        category,
        amount: isRevenue
          ? Math.round(Math.random() * 100000 + 10000)
          : Math.round(Math.random() * 50000 + 5000),
        description: `${category} - ${date.toLocaleDateString()}`,
        source: 'MANUAL'
      });
    }

    console.log('Created sample transactions');
    console.log('\nDemo credentials:');
    console.log('Email: demo@aicfo.com');
    console.log('Password: demo123456');
    console.log('\nSeeding completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();
