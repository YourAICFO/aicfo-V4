import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Building2, Lock, Bell } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authApi, billingApi, companyApi, settingsApi } from '../services/api';

interface Company {
  id: string;
  name: string;
  industry: string;
  currency: string;
  address: string;
  city: string;
  state: string;
  country: string;
  gstNumber: string;
  panNumber: string;
}

interface BillingStatus {
  plan: { code: string; name: string; price_amount: number; currency: string; interval: string } | null;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  user_trial?: {
    has_used_trial: boolean;
    trial_started_at: string | null;
    trial_ends_at: string | null;
    is_active: boolean;
    trial_days_left?: number;
  };
}

interface InvoiceRow {
  id: string;
  invoiceNo: string;
  total: number;
  status: string;
  issuedAt: string;
}

interface NotificationSettings {
  enabled_weekly: boolean;
  weekly_day_of_week: number | null;
  weekly_time_hhmm: string;
  enabled_monthly: boolean;
  monthly_day_of_month: number | null;
  monthly_time_hhmm: string;
  timezone: string;
}

export default function Settings() {
  const navigate = useNavigate();
  const { user, selectedCompanyId, setSelectedCompany } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [billingInvoices, setBillingInvoices] = useState<InvoiceRow[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    enabled_weekly: false,
    weekly_day_of_week: 1,
    weekly_time_hhmm: '09:00',
    enabled_monthly: false,
    monthly_day_of_month: 1,
    monthly_time_hhmm: '09:00',
    timezone: 'Asia/Kolkata',
  });
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadCompanies();
    loadBilling();
    loadNotificationSettings();
  }, []);

  const loadCompanies = async () => {
    try {
      const response = await companyApi.getAll();
      setCompanies(response.data.data);
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const updateProfile = async () => {
    try {
      await authApi.updateProfile({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
      });
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile' });
    }
  };

  const loadBilling = async () => {
    try {
      setBillingLoading(true);
      const [statusRes, invoicesRes] = await Promise.all([
        billingApi.getStatus(),
        billingApi.getInvoices(),
      ]);
      setBillingStatus(statusRes?.data?.data || null);
      setBillingInvoices(invoicesRes?.data?.data || []);
    } catch (error) {
      console.error('Failed to load billing:', error);
    } finally {
      setBillingLoading(false);
    }
  };

  const loadNotificationSettings = async () => {
    try {
      const response = await settingsApi.getNotificationSettings();
      if (response?.data?.data) {
        setNotificationSettings(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  };

  const saveNotificationSettings = async () => {
    try {
      await settingsApi.updateNotificationSettings(notificationSettings);
      setMessage({ type: 'success', text: 'Notification schedule updated.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.response?.data?.error || 'Failed to update notification settings' });
    }
  };

  const handleSubscribe = async () => {
    try {
      setBillingLoading(true);
      await billingApi.subscribe('starter_5000');
      await loadBilling();
      setMessage({ type: 'success', text: 'Subscription initiated successfully.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.response?.data?.error || 'Failed to subscribe' });
    } finally {
      setBillingLoading(false);
    }
  };

  const changePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (passwordData.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }
    try {
      await authApi.changePassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage({ type: 'success', text: 'Password changed successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to change password' });
    }
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteConfirmText('');
  };

  const handleDeleteCompany = async () => {
    if (!deleteTarget) return;

    const normalized = deleteConfirmText.trim().toLowerCase();
    const companyNameMatch = deleteConfirmText.trim() === deleteTarget.name;
    const deleteKeywordMatch = normalized === 'delete';
    if (!companyNameMatch && !deleteKeywordMatch) {
      setMessage({
        type: 'error',
        text: `Type "${deleteTarget.name}" or "DELETE" to confirm.`,
      });
      return;
    }

    setDeletingCompanyId(deleteTarget.id);
    try {
      await companyApi.delete(deleteTarget.id);
      const response = await companyApi.getAll();
      const remainingCompanies: Company[] = response.data?.data || [];
      setCompanies(remainingCompanies);
      closeDeleteModal();
      setMessage({
        type: 'success',
        text: 'Company archived. Data and invoices are preserved.',
      });

      if (selectedCompanyId === deleteTarget.id) {
        if (remainingCompanies.length > 0) {
          setSelectedCompany(remainingCompanies[0].id);
        } else {
          navigate('/create-company', {
            state: { message: 'Your company was archived. Create a new company to continue.' },
          });
        }
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.response?.data?.error || 'Failed to archive company',
      });
    } finally {
      setDeletingCompanyId(null);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'company', label: 'Company', icon: Building2 },
    { id: 'billing', label: 'Billing', icon: Building2 },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account and preferences</p>
      </div>

      {message.text && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-6">Profile Settings</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">First Name</label>
                    <input
                      type="text"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Last Name</label>
                    <input
                      type="text"
                      value={profileData.lastName}
                      onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    value={profileData.email}
                    disabled
                    className="input bg-gray-50"
                  />
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>
                <button onClick={updateProfile} className="btn-primary">
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {activeTab === 'company' && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-6">Company Information</h2>
              {companies.length === 0 ? (
                <p className="text-gray-500">No companies found.</p>
              ) : (
                <div className="space-y-6">
                  {companies.map((company) => (
                    <div key={company.id} className="border-b border-gray-200 pb-6 last:border-0">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="font-medium">{company.name}</h3>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(company)}
                          className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          Delete Company
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Industry:</span>{' '}
                          {company.industry || '-'}
                        </div>
                        <div>
                          <span className="text-gray-500">Currency:</span> {company.currency}
                        </div>
                        <div>
                          <span className="text-gray-500">GST:</span> {company.gstNumber || '-'}
                        </div>
                        <div>
                          <span className="text-gray-500">PAN:</span> {company.panNumber || '-'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-6">Change Password</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Current Password</label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">New Password</label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="input"
                  />
                </div>
                <button onClick={changePassword} className="btn-primary">
                  Change Password
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-6">Notification Preferences</h2>
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={notificationSettings.enabled_weekly}
                      onChange={(e) => setNotificationSettings((prev) => ({ ...prev, enabled_weekly: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <span className="font-medium">Weekly Email Digest</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={notificationSettings.weekly_day_of_week || 1}
                      onChange={(e) => setNotificationSettings((prev) => ({ ...prev, weekly_day_of_week: Number(e.target.value) }))}
                      className="input"
                      disabled={!notificationSettings.enabled_weekly}
                    >
                      <option value={1}>Monday</option>
                      <option value={2}>Tuesday</option>
                      <option value={3}>Wednesday</option>
                      <option value={4}>Thursday</option>
                      <option value={5}>Friday</option>
                      <option value={6}>Saturday</option>
                      <option value={7}>Sunday</option>
                    </select>
                    <input
                      type="time"
                      value={notificationSettings.weekly_time_hhmm}
                      onChange={(e) => setNotificationSettings((prev) => ({ ...prev, weekly_time_hhmm: e.target.value }))}
                      className="input"
                      disabled={!notificationSettings.enabled_weekly}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={notificationSettings.enabled_monthly}
                      onChange={(e) => setNotificationSettings((prev) => ({ ...prev, enabled_monthly: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <span className="font-medium">Monthly Email Digest</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={notificationSettings.monthly_day_of_month || 1}
                      onChange={(e) => setNotificationSettings((prev) => ({ ...prev, monthly_day_of_month: Number(e.target.value) }))}
                      className="input"
                      disabled={!notificationSettings.enabled_monthly}
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                        <option key={day} value={day}>
                          Day {day}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={notificationSettings.monthly_time_hhmm}
                      onChange={(e) => setNotificationSettings((prev) => ({ ...prev, monthly_time_hhmm: e.target.value }))}
                      className="input"
                      disabled={!notificationSettings.enabled_monthly}
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Timezone</label>
                  <input
                    type="text"
                    value={notificationSettings.timezone}
                    onChange={(e) => setNotificationSettings((prev) => ({ ...prev, timezone: e.target.value }))}
                    className="input"
                  />
                </div>

                <button onClick={saveNotificationSettings} className="btn-primary">
                  Save Preferences
                </button>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-6">Billing</h2>
              {billingLoading ? (
                <p className="text-sm text-gray-500">Loading billing details...</p>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Current Plan</p>
                    <p className="text-lg font-semibold">{billingStatus?.plan?.name || 'Starter ₹5,000/month'}</p>
                    <p className="text-sm text-gray-600 mt-1">Status: {billingStatus?.status || 'trialing'}</p>
                    <p className="text-sm text-gray-600">
                      Period Ends:{' '}
                      {billingStatus?.current_period_end
                        ? new Date(billingStatus.current_period_end).toLocaleDateString()
                        : 'Not available yet'}
                    </p>
                    <p className="text-sm text-gray-600">
                      Trial:{' '}
                      {billingStatus?.user_trial?.is_active
                        ? `Ends on ${new Date(billingStatus.user_trial.trial_ends_at || '').toLocaleDateString()} (${billingStatus.user_trial.trial_days_left ?? 0} days left)`
                        : billingStatus?.user_trial?.has_used_trial
                          ? 'Trial used'
                          : 'Not started'}
                    </p>
                    <button onClick={handleSubscribe} className="btn-primary mt-4">
                      Subscribe ₹5,000/month
                    </button>
                  </div>

                  <div>
                    <h3 className="font-medium mb-3">Invoices</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2">Invoice</th>
                            <th className="text-left py-2">Issued</th>
                            <th className="text-left py-2">Status</th>
                            <th className="text-right py-2">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {billingInvoices.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-4 text-gray-500">No invoices yet.</td>
                            </tr>
                          ) : (
                            billingInvoices.map((invoice) => (
                              <tr key={invoice.id} className="border-b border-gray-100">
                                <td className="py-2">{invoice.invoiceNo}</td>
                                <td className="py-2">{new Date(invoice.issuedAt).toLocaleDateString()}</td>
                                <td className="py-2 capitalize">{invoice.status}</td>
                                <td className="py-2 text-right">
                                  {(Number(invoice.total || 0) / 100).toLocaleString('en-IN', {
                                    style: 'currency',
                                    currency: 'INR',
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Archive Company</h3>
            <p className="mt-2 text-sm text-gray-600">
              This will archive <span className="font-medium">{deleteTarget.name}</span>. Data and invoices are preserved.
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Type the company name or <span className="font-semibold">DELETE</span> to confirm.
            </p>

            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="input mt-4"
              placeholder={`Type "${deleteTarget.name}" or DELETE`}
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCompany}
                disabled={deletingCompanyId === deleteTarget.id}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletingCompanyId === deleteTarget.id ? 'Archiving...' : 'Archive Company'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
