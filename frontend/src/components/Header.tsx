import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Building2, Download } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { companyApi } from '../services/api';

interface Company {
  id: string;
  name: string;
  subscription?: {
    planType: string;
  };
}

export default function Header() {
  const { user, logout, selectedCompanyId, setSelectedCompany } = useAuthStore();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const response = await companyApi.getAll();
      setCompanies(response.data.data);
      if (response.data.data.length > 0 && !selectedCompanyId) {
        setSelectedCompany(response.data.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  const handleLogout = () => {
    logout();
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="relative">
          {companies.length > 0 && (
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
            >
              <Building2 className="w-5 h-5" />
              <span className="font-medium">{selectedCompany?.name || 'Select Company'}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
          
          {showDropdown && companies.length > 1 && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
              {companies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => {
                    setSelectedCompany(company.id);
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                >
                  <div className="font-medium">{company.name}</div>
                  <div className="text-sm text-gray-500">{company.subscription?.planType} Plan</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <a 
            href={`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/download/connector`}
            className="hidden md:flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            download
          >
            <Download className="w-4 h-4" />
            Download Connector
          </a>
          
          <button className="relative p-2 text-gray-600 hover:text-gray-900">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-medium text-gray-900">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-sm text-gray-500">{user?.email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-600 hover:text-red-600 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
