import { useState, useEffect } from 'react';
import { Plus, Filter, Edit2, Trash2, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { transactionApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

interface Transaction {
  id: string;
  date: string;
  type: 'OPENING_BALANCE' | 'REVENUE' | 'EXPENSE';
  category: string;
  amount: number;
  description: string;
  source: string;
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState({ type: '' });
  const [error, setError] = useState('');
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);

  const [formData, setFormData] = useState({
    date: '',
    type: 'EXPENSE',
    category: '',
    amount: '',
    description: '',
  });

  useEffect(() => {
    if (!selectedCompanyId) return;
    loadTransactions();
  }, [filter, selectedCompanyId]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filter.type) params.type = filter.type;

      const response = await transactionApi.getAll(params);
      setTransactions(response.data.data.transactions);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingTransaction) {
        await transactionApi.update(editingTransaction.id, {
          amount: parseFloat(formData.amount),
          description: formData.description,
        });
      } else {
        await transactionApi.create({
          date: formData.date,
          type: formData.type as 'OPENING_BALANCE' | 'REVENUE' | 'EXPENSE',
          category: formData.type === 'OPENING_BALANCE' ? 'Opening Balance' : formData.category,
          amount: parseFloat(formData.amount),
          description: formData.description,
        });
      }

      setShowModal(false);
      setEditingTransaction(null);
      setFormData({
        date: '',
        type: 'EXPENSE',
        category: '',
        amount: '',
        description: '',
      });

      loadTransactions();
    } catch (error: any) {
      console.error('Failed to save transaction:', error);
      setError(error.response?.data?.error || 'Failed to save transaction. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
      await transactionApi.delete(id);
      loadTransactions();
    } catch (error) {
      console.error('Failed to delete transaction:', error);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      date: transaction.date,
      type: transaction.type,
      category: transaction.category,
      amount: transaction.amount.toString(),
      description: transaction.description || '',
    });
    setShowModal(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getAmountColor = (type: string) => {
    if (type === 'REVENUE' || type === 'OPENING_BALANCE') {
      return 'text-green-600';
    }
    return 'text-red-600';
  };

  const getAmountPrefix = (type: string) => {
    if (type === 'REVENUE' || type === 'OPENING_BALANCE') {
      return '+';
    }
    return '-';
  };

  const revenueTotal = transactions
    .filter(t => t.type === 'REVENUE')
    .reduce((sum, t) => sum + t.amount, 0);
  const expenseTotal = transactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + t.amount, 0);
  const openingTotal = transactions
    .filter(t => t.type === 'OPENING_BALANCE')
    .reduce((sum, t) => sum + t.amount, 0);

  const getMonthKey = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const monthTotals = transactions.reduce(
    (acc, t) => {
      const key = getMonthKey(t.date);
      if (!acc[key]) acc[key] = { revenue: 0, expense: 0 };
      if (t.type === 'REVENUE') acc[key].revenue += t.amount;
      if (t.type === 'EXPENSE') acc[key].expense += t.amount;
      return acc;
    },
    {} as Record<string, { revenue: number; expense: number }>
  );

  const sortedMonths = Object.keys(monthTotals).sort();
  const latestMonthKey = sortedMonths[sortedMonths.length - 1];
  const prevMonthKey = sortedMonths.length > 1 ? sortedMonths[sortedMonths.length - 2] : null;
  const latestRevenue = latestMonthKey ? monthTotals[latestMonthKey].revenue : 0;
  const latestExpense = latestMonthKey ? monthTotals[latestMonthKey].expense : 0;
  const prevRevenue = prevMonthKey ? monthTotals[prevMonthKey].revenue : 0;
  const prevExpense = prevMonthKey ? monthTotals[prevMonthKey].expense : 0;

  const revenueUp = latestRevenue >= prevRevenue;
  const expenseDown = latestExpense <= prevExpense;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600">Manage your financial transactions</p>
        </div>

        <button
          onClick={() => {
            setEditingTransaction(null);
            setFormData({
              date: '',
              type: 'EXPENSE',
              category: '',
              amount: '',
              description: '',
            });
            setShowModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Transaction
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="card border-transparent bg-gradient-to-br from-white to-blue-50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Cash / Bank Balance</p>
              <p className="text-2xl font-bold">{formatCurrency(openingTotal)}</p>
            </div>
          </div>
        </div>
        <div className="card border-transparent bg-gradient-to-br from-white to-emerald-50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Latest Month Revenue</p>
              <p className="text-2xl font-bold">{formatCurrency(latestRevenue)}</p>
            </div>
          </div>
          <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${revenueUp ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {revenueUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {revenueUp ? 'Up vs last month' : 'Down vs last month'}
          </div>
        </div>
        <div className="card border-transparent bg-gradient-to-br from-white to-rose-50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Latest Month Expenses</p>
              <p className="text-2xl font-bold">{formatCurrency(latestExpense)}</p>
            </div>
          </div>
          <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${expenseDown ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {expenseDown ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
            {expenseDown ? 'Down vs last month' : 'Up vs last month'}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-200">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={filter.type}
            onChange={(e) => setFilter({ ...filter, type: e.target.value })}
            className="border-none bg-transparent focus:ring-0"
          >
            <option value="">All Types</option>
            <option value="OPENING_BALANCE">Current Cash / Bank Balance</option>
            <option value="REVENUE">Revenue</option>
            <option value="EXPENSE">Expense</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Type</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Category</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Description</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Amount</th>
              <th className="text-center py-3 px-4 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>

          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  No transactions found.
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    {new Date(transaction.date).toLocaleDateString('en-IN')}
                  </td>

                  <td className="py-3 px-4">
                    <span className="px-2 py-1 rounded text-sm font-medium bg-gray-100 text-gray-700">
                      {transaction.type.replace('_', ' ')}
                    </span>
                  </td>

                  <td className="py-3 px-4">{transaction.category}</td>
                  <td className="py-3 px-4">{transaction.description || '-'}</td>

                  <td className={`py-3 px-4 text-right font-medium ${getAmountColor(transaction.type)}`}>
                    {getAmountPrefix(transaction.type)}
                    {formatCurrency(transaction.amount)}
                  </td>

                  <td className="py-3 px-4 text-center">
                    {transaction.source === 'MANUAL' && (
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(transaction)}>
                          <Edit2 className="w-4 h-4 text-gray-400 hover:text-blue-600" />
                        </button>
                        <button onClick={() => handleDelete(transaction.id)}>
                          <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-600" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">
              {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
            </h2>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              {!editingTransaction && (
                <>
                  <div>
                    <label className="label">Date</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="input"
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => {
                        const nextType = e.target.value;
                        setFormData({
                          ...formData,
                          type: nextType,
                          category: nextType === 'OPENING_BALANCE' ? 'Opening Balance' : formData.category,
                        });
                      }}
                      className="input"
                      required
                    >
                      <option value="OPENING_BALANCE">Current Cash / Bank Balance</option>
                      <option value="REVENUE">Revenue</option>
                      <option value="EXPENSE">Expense</option>
                    </select>
                  </div>

                  {formData.type !== 'OPENING_BALANCE' && (
                    <div>
                      <label className="label">Category</label>
                      <input
                        type="text"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="input"
                        required
                      />
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="label">Amount</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  {editingTransaction ? 'Update' : 'Add'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
