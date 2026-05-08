import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Users, PieChart, FolderOpen, Search, Bell, Plus, TrendingUp, TrendingDown, Vault, Camera, CheckCircle2, X, FileText, Lock, User, LogOut, Settings, UserPlus, ArrowLeft, Trash2, Star, Calendar, CreditCard, BarChart3, DollarSign, Receipt } from 'lucide-react';
import './index.css';
import * as XLSX from 'xlsx';
import { translations, type Lang } from './translations';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const BACKEND_URL = import.meta.env.DEV ? 'http://localhost:5000/' : '/';
const API_URL = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

// Axios varsayılan auth header ayarı
function setAxiosToken(token: string | null) {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('gsdernek_token', token);
  } else {
    delete axios.defaults.headers.common['Authorization'];
    localStorage.removeItem('gsdernek_token');
    localStorage.removeItem('gsdernek_user');
  }
}

// Sayfa yüklenince kaydedilmiş oturumu geri yükle
const savedToken = localStorage.getItem('gsdernek_token');
const savedUser = localStorage.getItem('gsdernek_user');
if (savedToken) setAxiosToken(savedToken);

function App() {
  const [currentUser, setCurrentUser] = useState<any>(
    savedUser ? JSON.parse(savedUser) : null
  );
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState('light');
  const [lang, setLang] = useState<Lang>('tr');
  const t = translations[lang];
  const [summary, setSummary] = useState({ totalMembers: 0, monthlyDailyIncome: 0, monthlyMembershipIncome: 0, monthlySponsorIncome: 0, monthlyExpense: 0, totalIncome: 0, netBalance: 0 });
  const [dashboardStats, setDashboardStats] = useState({
    revenueDistribution: { 'Giriş': 0, 'Mutfak': 0, 'Büfe': 0 },
    currentMonth: { DailyIncome: 0, MembershipIncome: 0, Expense: 0, SponsorIncome: 0 }
  });
  const [financeStats, setFinanceStats] = useState<any>({
    monthly: { membershipIncome: 0, salesIncome: 0, sponsorIncome: 0, totalIncome: 0, expense: 0, net: 0 },
    yearly: { membershipIncome: 0, salesIncome: 0, sponsorIncome: 0, totalIncome: 0, expense: 0, net: 0 },
    allTime: { totalIncome: 0, totalExpense: 0, netBalance: 0, totalSponsorIncome: 0 },
    monthlyHistory: [],
    activeSponsorCount: 0,
    totalActiveSponsorMonthly: 0
  });
  const [archiveData, setArchiveData] = useState([]);
  const [members, setMembers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [showApproachingRenewal, setShowApproachingRenewal] = useState(false);
  const [selectedArchive, setSelectedArchive] = useState<any>(null);
  const [showAddSponsor, setShowAddSponsor] = useState(false);
  const [newSponsorData, setNewSponsorData] = useState({
    Name: '', Surname: '', Company: '', Phone: '', Email: '',
    Amount: '', Payment_Period: 'monthly', Last_Payment_Date: '', Next_Payment_Date: '', Notes: ''
  });

  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberData, setNewMemberData] = useState({
    Name: '', Surname: '', Email: '', Phone: '', Address: '', Bank_Name: '', IBAN: '', Member_Type: 'Normal', Registration_Date: ''
  });
  const [editingMember, setEditingMember] = useState<any>(null);
  const [editMemberData, setEditMemberData] = useState<any>(null);
  const [editingSponsor, setEditingSponsor] = useState<any>(null);
  const [editSponsorData, setEditSponsorData] = useState<any>(null);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [editTransactionData, setEditTransactionData] = useState<any>(null);

  // Form State for "Daily Closing"
  const [customDate, setCustomDate] = useState('');
  const [dailyData, setDailyData] = useState({
    incomeEntry: '',
    incomeKitchen: '',
    incomeBuffet: '',
    expenseRent: '',
    expenseSupplies: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');

  // Add User State
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('staff');
  const [editingUserPass, setEditingUserPass] = useState<any>(null);
  const [newUserPass, setNewUserPass] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  const parseAmount = (val: any) => {
    if (!val) return 0;
    return parseFloat(String(val).replace(',', '.')) || 0;
  };

  const totalIncome = parseAmount(dailyData.incomeEntry) + parseAmount(dailyData.incomeKitchen) + parseAmount(dailyData.incomeBuffet);
  const totalExpense = parseAmount(dailyData.expenseRent) + parseAmount(dailyData.expenseSupplies);
  const dailyProfit = totalIncome - totalExpense;

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

  useEffect(() => {
    document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/login`, { username: loginUsername, password: loginPassword });
      if (res.data.success) {
        setAxiosToken(res.data.token);
        localStorage.setItem('gsdernek_user', JSON.stringify(res.data.user));
        setCurrentUser(res.data.user);
        setLoginError('');
      }
    } catch (err: any) {
      setLoginError(err.response?.data?.message || t.login_error_default);
    }
  };

  const handleLogout = async () => {
    try { await axios.post(`${API_URL}/logout`); } catch {}
    setAxiosToken(null);
    setCurrentUser(null);
    setLoginUsername('');
    setLoginPassword('');
  };

  const handleDailyDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDailyData({ ...dailyData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileName(e.target.files[0].name);
    } else {
      setFileName('');
    }
  };

  const handleNewMemberChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setNewMemberData({ ...newMemberData, [e.target.name]: e.target.value });
  };

  const fetchData = async () => {
    try {
      const summaryRes = await axios.get(`${API_URL}/stats/summary`);
      setSummary(summaryRes.data);

      const dashRes = await axios.get(`${API_URL}/stats/dashboard`);
      setDashboardStats(dashRes.data);

      const finRes = await axios.get(`${API_URL}/stats/finance`);
      setFinanceStats(finRes.data);

      const archRes = await axios.get(`${API_URL}/archive`);
      setArchiveData(archRes.data);

      const membersRes = await axios.get(`${API_URL}/members`);
      setMembers(membersRes.data);

      const txRes = await axios.get(`${API_URL}/financials`);
      setTransactions(txRes.data.slice(0, 5));

      const sponsorsRes = await axios.get(`${API_URL}/sponsors`);
      setSponsors(sponsorsRes.data);

      if (currentUser?.role === 'admin') {
        const usersRes = await axios.get(`${API_URL}/users`);
        setSystemUsers(usersRes.data);
      }
    } catch (error) {
      console.error("Error fetching data", error);
    }
  };

  const handleDeleteMember = async (id: number, name: string) => {
    if (window.confirm(t.confirm_delete_member(name))) {
      try {
        await axios.delete(`${API_URL}/members/${id}`);
        await fetchData();
      } catch (err: any) {
        alert(t.err_delete(err.response?.data?.error || err.message));
      }
    }
  };

  const handleNewSponsorChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setNewSponsorData({ ...newSponsorData, [e.target.name]: e.target.value });
  };

  const calcNextPayment = (lastDate: string, period: string): string => {
    if (!lastDate) return '';
    const d = new Date(lastDate);
    if (period === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (period === 'quarterly') d.setMonth(d.getMonth() + 3);
    else if (period === 'semi-annual') d.setMonth(d.getMonth() + 6);
    else if (period === 'annual') d.setFullYear(d.getFullYear() + 1);
    else if (period === 'custom4') d.setMonth(d.getMonth() + 4);
    else if (period === 'custom5') d.setMonth(d.getMonth() + 5);
    return d.toISOString().split('T')[0];
  };

  const handleAddSponsorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const nextDate = newSponsorData.Next_Payment_Date || calcNextPayment(newSponsorData.Last_Payment_Date, newSponsorData.Payment_Period);
      await axios.post(`${API_URL}/sponsors`, {
        ...newSponsorData,
        Next_Payment_Date: nextDate
      });
      await fetchData();
      setShowAddSponsor(false);
      setNewSponsorData({ Name: '', Surname: '', Company: '', Phone: '', Email: '', Amount: '', Payment_Period: 'monthly', Last_Payment_Date: '', Next_Payment_Date: '', Notes: '' });
    } catch (err: any) {
      alert(t.err_generic(err.response?.data?.error || err.message));
    }
  };

  const handleDeleteSponsor = async (id: number) => {
    if (window.confirm(t.confirm_delete_sponsor)) {
      await axios.delete(`${API_URL}/sponsors/${id}`);
      fetchData();
    }
  };

  const handleEditMemberSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/members/${editingMember.id}`, editMemberData);
      await fetchData();
      setEditingMember(null);
      setEditMemberData(null);
    } catch (err: any) {
      alert(t.err_generic(err.response?.data?.error || err.message));
    }
  };

  const handleEditSponsorSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const nextDate = editSponsorData.Next_Payment_Date || calcNextPayment(editSponsorData.Last_Payment_Date, editSponsorData.Payment_Period);
      await axios.put(`${API_URL}/sponsors/${editingSponsor.id}`, { ...editSponsorData, Next_Payment_Date: nextDate });
      await fetchData();
      setEditingSponsor(null);
      setEditSponsorData(null);
    } catch (err: any) {
      alert('Hata: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleEditTransactionSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/financials/${editingTransaction.id}`, editTransactionData);
      await fetchData();
      setEditingTransaction(null);
      setEditTransactionData(null);
      setSelectedArchive(null);
    } catch (err: any) {
      alert('Hata: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/users`, { username: newUsername, password: newPassword, role: newRole });
      setNewUsername('');
      setNewPassword('');
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || "Hata");
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (window.confirm(t.confirm_delete_user)) {
      try {
        await axios.delete(`${API_URL}/users/${id}`);
        fetchData();
      } catch (err: any) {
        alert(t.err_generic(err.response?.data?.error || err.message));
      }
    }
  };

  const handleUpdateUserPassword = async (id: number, newPassword: string) => {
    if (!newPassword.trim()) {
      alert(t.pass_empty_err);
      return;
    }
    try {
      await axios.put(`${API_URL}/users/${id}`, { password: newPassword });
      alert(t.pass_updated);
      fetchData();
      setEditingUserPass(null);
      setNewUserPass('');
    } catch (err: any) {
      alert('Hata: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    if (window.confirm(t.confirm_delete_tx)) {
      try {
        await axios.delete(`${API_URL}/financials/${id}`);
        fetchData();
        // If the archive modal is open, we should ideally close it or refresh it. We'll close it to be safe.
        setSelectedArchive(null);
      } catch (err: any) {
        alert('Silinemedi: ' + err.message);
      }
    }
  };

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...newMemberData,
        Registration_Date: newMemberData.Registration_Date || new Date().toISOString().split('T')[0],
        Status: 'Active',
        Created_By: currentUser.username
      };
      await axios.post(`${API_URL}/members`, payload);
      await fetchData();
      setShowAddMember(false);
      setNewMemberData({ Name: '', Surname: '', Email: '', Phone: '', Address: '', Bank_Name: '', IBAN: '', Member_Type: 'Normal', Registration_Date: '' });
      alert(t.msg_member_added);
    } catch (err: any) {
      alert('Hata: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDailySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const incomes = [
      { category: 'Giriş', amount: parseAmount(dailyData.incomeEntry) },
      { category: 'Mutfak', amount: parseAmount(dailyData.incomeKitchen) },
      { category: 'Büfe', amount: parseAmount(dailyData.incomeBuffet) },
    ];
    const expenses = [
      { category: 'Kira', amount: parseAmount(dailyData.expenseRent) },
      { category: 'Malzeme', amount: parseAmount(dailyData.expenseSupplies) },
    ];

    const formData = new FormData();
    const finalDate = customDate || new Date().toISOString().split('T')[0];
    formData.append('Date', finalDate);
    formData.append('incomes', JSON.stringify(incomes));
    formData.append('expenses', JSON.stringify(expenses));
    formData.append('Created_By', currentUser.username);

    if (fileInputRef.current?.files?.[0]) {
      formData.append('receipt', fileInputRef.current.files[0]);
    }

    try {
      await axios.post(`${API_URL}/financials/daily`, formData);
      await fetchData();

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setActiveTab('dashboard');
        setFileName('');
        setCustomDate('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        setDailyData({ incomeEntry: '', incomeKitchen: '', incomeBuffet: '', expenseRent: '', expenseSupplies: '' });
      }, 1500);
    } catch (error) {
      console.error("Submit Error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAnniversaryData = (dateStr: string) => {
    if (!dateStr) return { diffDays: 999, nextPayment: '-' };
    const regDate = new Date(dateStr);
    const nextDate = new Date(regDate);
    nextDate.setFullYear(regDate.getFullYear() + 1); // Valid for 1 year

    const today = new Date();
    const diffTime = nextDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return { diffDays, nextPayment: nextDate.toISOString().split('T')[0] };
  };

  const filteredBySearch = (list: any[]) =>
    list.filter((m: any) => {
      const q = memberSearch.toLowerCase();
      return (
        (m.Name || '').toLowerCase().includes(q) ||
        (m.Surname || '').toLowerCase().includes(q) ||
        (m.Email || '').toLowerCase().includes(q) ||
        (m.Phone || '').toLowerCase().includes(q) ||
        (m.Member_Type || '').toLowerCase().includes(q)
      );
    });

  const displayedMembers = filteredBySearch(
    showApproachingRenewal
      ? members.filter((m: any) => {
          const { diffDays } = getAnniversaryData(m.Registration_Date);
          return diffDays >= 0 && diffDays <= 90;
        })
      : members
  );

  const exportMembersToExcel = () => {
    const exportList = memberSearch || showApproachingRenewal ? displayedMembers : members;
    const wsData = [
      [lang === 'tr' ? 'ID' : 'ID', lang === 'tr' ? 'Ad' : 'Vorname', lang === 'tr' ? 'Soyad' : 'Nachname',
       lang === 'tr' ? 'E-Posta' : 'E-Mail', lang === 'tr' ? 'Telefon' : 'Telefon',
       lang === 'tr' ? 'Adres' : 'Adresse', lang === 'tr' ? 'Banka' : 'Bank', 'IBAN',
       lang === 'tr' ? 'Üyelik Tipi' : 'Mitgliedschaftstyp',
       lang === 'tr' ? 'Kayıt Tarihi' : 'Beitrittsdatum',
       lang === 'tr' ? 'Durum' : 'Status'],
      ...exportList.map((m: any) => [
        m.id, m.Name, m.Surname, m.Email || '', m.Phone || '',
        m.Address || '', m.Bank_Name || '', m.IBAN || '',
        m.Member_Type || 'Normal', m.Registration_Date || '', m.Status || ''
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [8,16,16,28,18,32,18,28,16,16,10].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, lang === 'tr' ? 'Üyeler' : 'Mitglieder');
    XLSX.writeFile(wb, `${lang === 'tr' ? 'uyeler' : 'mitglieder'}_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const currentMonthBarData = {
    labels: [t.fin_monthly],
    datasets: [
      {
        label: t.fin_sales_income,
        data: [dashboardStats.currentMonth.DailyIncome],
        backgroundColor: 'rgba(76, 175, 80, 0.8)',
      },
      {
        label: t.fin_membership_income,
        data: [dashboardStats.currentMonth.MembershipIncome],
        backgroundColor: 'rgba(255, 182, 18, 0.8)',
      },
      {
        label: t.fin_expense,
        data: [dashboardStats.currentMonth.Expense],
        backgroundColor: 'rgba(138, 3, 4, 0.8)',
      }
    ]
  };

  if (!currentUser) {
    return (
      <div className="login-container">
        <div className="login-box">
          {/* Language Toggle on Login */}
          <div style={{ textAlign: 'right', marginBottom: '8px' }}>
            <button
              onClick={() => setLang(lang === 'tr' ? 'de' : 'tr')}
              style={{
                background: 'var(--surface-light)', border: '1px solid var(--border-color)',
                borderRadius: '20px', padding: '4px 14px', cursor: 'pointer',
                color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 600
              }}
            >
              {lang === 'tr' ? '🇩🇪 DE' : '🇹🇷 TR'}
            </button>
          </div>
          <div className="login-logo">
            <img src="/logo.jpg" alt="Galatasaray Stuttgart" className="logo-gs-large-img" />
            <h2>{t.login_title}</h2>
            <p>{t.login_subtitle}</p>
          </div>
          <form className="login-form" onSubmit={handleLogin}>
            {loginError && <div className="login-error">{loginError}</div>}
            <div className="form-group">
              <label>{t.login_username}</label>
              <div className="input-with-icon">
                <User size={18} color="#FFB612" />
                <input type="text" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} required />
              </div>
            </div>
            <div className="form-group">
              <label>{t.login_password}</label>
              <div className="input-with-icon">
                <Lock size={18} color="#FFB612" />
                <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
              </div>
            </div>
            <button type="submit" className="huge-save-btn" style={{ marginTop: '20px' }}>{t.login_btn}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <img src="/logo.jpg" alt="GS" className="logo-gs-img" />
            <h2>Stuttgart<br /><span>{lang === 'tr' ? 'Dernek Yönetimi' : 'Vereinsverwaltung'}</span></h2>
          </div>
        </div>
        <nav className="sidebar-nav">
          <ul>
            <li className={activeTab === 'dashboard' ? 'active' : ''}>
              <button onClick={() => { setActiveTab('dashboard'); setShowAddMember(false); }}><PieChart size={18} /> {t.nav_dashboard}</button>
            </li>
            <li className={activeTab === 'members' ? 'active' : ''}>
              <button onClick={() => { setActiveTab('members'); setShowAddMember(false); }}><Users size={18} /> {t.nav_members}</button>
            </li>
            <li className={activeTab === 'sponsors' ? 'active' : ''}>
              <button onClick={() => { setActiveTab('sponsors'); setShowAddMember(false); }}><Star size={18} /> {t.nav_sponsors}</button>
            </li>
            <li className={activeTab === 'financials' ? 'active' : ''}>
              <button onClick={() => { setActiveTab('financials'); setShowAddMember(false); }}><Plus size={18} /> {t.nav_daily}</button>
            </li>
            <li className={activeTab === 'financedetail' ? 'active' : ''}>
              <button onClick={() => { setActiveTab('financedetail'); setShowAddMember(false); }}><BarChart3 size={18} /> {t.nav_finance}</button>
            </li>
            <li className={activeTab === 'archive' ? 'active' : ''}>
              <button onClick={() => { setActiveTab('archive'); setShowAddMember(false); }}><FolderOpen size={18} /> {t.nav_archive}</button>
            </li>
            {currentUser.role === 'admin' && (
              <li className={activeTab === 'users' ? 'active' : ''}>
                <button onClick={() => { setActiveTab('users'); setShowAddMember(false); }}><Settings size={18} /> {t.nav_users}</button>
              </li>
            )}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <img src={`https://ui-avatars.com/api/?name=${currentUser.username}&background=8A0304&color=fff`} alt="User" />
            <div style={{ flex: 1 }}>
              <p>{currentUser.username}</p>
              <span>{currentUser.username === 'admin1905' ? t.role_master_admin : currentUser.role === 'admin' ? t.role_admin : t.role_staff}</span>
            </div>
            <button className="icon-btn" onClick={handleLogout} title={t.btn_logout}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {activeTab !== 'financials' && !showAddMember && (
          <header className="topbar">
            <div className="search-bar">
              <Search size={18} color="var(--text-secondary)" />
              <input type="text" placeholder={t.search_placeholder} />
            </div>
            <div className="topbar-actions">
              {/* Language Toggle */}
              <button
                onClick={() => setLang(lang === 'tr' ? 'de' : 'tr')}
                title={lang === 'tr' ? 'Auf Deutsch wechseln' : 'Türkçeye geç'}
                style={{
                  background: lang === 'de' ? 'rgba(0,0,0,0.15)' : 'rgba(255,182,18,0.12)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '20px', padding: '6px 14px',
                  cursor: 'pointer', color: 'var(--text-primary)',
                  fontSize: '0.82rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: '5px'
                }}
              >
                {lang === 'tr' ? <>🇩🇪&nbsp;DE</> : <>🇹🇷&nbsp;TR</>}
              </button>
              <button className="icon-btn" onClick={toggleTheme} title={t.btn_theme}>
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
              <button className="icon-btn" onClick={handleLogout} title={t.btn_logout}><LogOut size={18} /></button>
            </div>
          </header>
        )}

        <div className={`content-wrapper ${(activeTab === 'financials' || showAddMember) ? 'no-padding-top' : ''}`}>

          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && !showAddMember && (
            <>
              <div className="page-header">
                <h1>{t.dash_title}</h1>
              </div>
              <div className="summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                <div className="card stat-card">
                  <div className="card-info">
                    <h3 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}><Users size={13} style={{ display: 'inline', marginRight: '4px' }} />{t.stat_total_members}</h3>
                    <h2 style={{ fontSize: '2.2rem', color: 'var(--secondary-color)', fontWeight: '800', marginTop: '8px' }}>{summary.totalMembers}</h2>
                  </div>
                </div>
                <div className="card stat-card" style={{ background: 'linear-gradient(135deg,rgba(76,175,80,0.15),rgba(76,175,80,0.05))', border: '1px solid rgba(76,175,80,0.3)' }}>
                  <div className="card-info">
                    <h3 style={{ fontSize: '0.8rem', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '1px' }}><Receipt size={13} style={{ display: 'inline', marginRight: '4px' }} />{t.stat_monthly_sales}</h3>
                    <h2 style={{ fontSize: '2.2rem', color: 'var(--success)', fontWeight: '800', marginTop: '8px' }}>€ {summary.monthlyDailyIncome.toFixed(2)}</h2>
                  </div>
                </div>
                <div className="card stat-card" style={{ background: 'linear-gradient(135deg,rgba(255,182,18,0.15),rgba(255,182,18,0.05))', border: '1px solid rgba(255,182,18,0.3)' }}>
                  <div className="card-info">
                    <h3 style={{ fontSize: '0.8rem', color: 'var(--secondary-color)', textTransform: 'uppercase', letterSpacing: '1px' }}><CreditCard size={13} style={{ display: 'inline', marginRight: '4px' }} />{t.stat_monthly_membership}</h3>
                    <h2 style={{ fontSize: '2.2rem', color: 'var(--secondary-color)', fontWeight: '800', marginTop: '8px' }}>€ {summary.monthlyMembershipIncome.toFixed(2)}</h2>
                  </div>
                </div>
                <div className="card stat-card red-card">
                  <div className="card-info">
                    <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}><DollarSign size={13} style={{ display: 'inline', marginRight: '4px' }} />{t.stat_monthly_total}</h3>
                    <h2 style={{ fontSize: '2.2rem', fontWeight: '800', marginTop: '8px' }}>€ {(summary.monthlyDailyIncome + summary.monthlyMembershipIncome).toFixed(2)}</h2>
                  </div>
                </div>
                <div className="card stat-card highlight">
                  <div className="card-info">
                    <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}><Vault size={13} style={{ display: 'inline', marginRight: '4px' }} />{t.stat_net_cash}</h3>
                    <h2 style={{ fontSize: '2.2rem', fontWeight: '800', marginTop: '8px' }}>€ {summary.netBalance.toFixed(2)}</h2>
                  </div>
                </div>
              </div>

              <div className="dashboard-grid" style={{ marginTop: '24px' }}>
                <div className="card chart-card">
                  <div className="card-header">
                    <h3>{t.chart_monthly_dist}</h3>
                  </div>
                  <div style={{ height: '250px', display: 'flex', justifyContent: 'center' }}>
                    <Bar data={currentMonthBarData} options={{ maintainAspectRatio: false, responsive: true }} />
                  </div>
                </div>

                <div className="card table-card">
                  <div className="card-header">
                    <h3>{t.chart_last_tx}</h3>
                  </div>
                  <div className="table-responsive">
                    <table className="transactions-table">
                      <thead>
                        <tr><th>{t.tx_col_tx}</th><th>{t.tx_col_date}</th><th>{t.tx_col_amount}</th><th>{t.tx_col_by}</th></tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx: any) => (
                          <tr key={tx.id}>
                            <td>{tx.Category}</td>
                            <td style={{ color: '#A0A0A0' }}>{tx.Date}</td>
                            <td className={tx.Type === 'Income' ? 'amount positive' : 'amount negative'}>
                              {tx.Type === 'Income' ? '+' : '-'}€ {tx.Amount}
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--secondary-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {tx.Created_By}
                              {currentUser?.role === 'admin' && (
                                <button onClick={() => handleDeleteTransaction(tx.id)} title={t.btn_cancel} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {transactions.length === 0 && <tr><td colSpan={4}>{t.tx_empty}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* USERS TAB */}
          {activeTab === 'users' && currentUser.role === 'admin' && !showAddMember && (
            <div className="dashboard-grid">
              <div className="card table-card">
                <div className="card-header"><h3>{t.users_title}</h3></div>
                <div className="table-responsive">
                  <table className="transactions-table">
                    <thead><tr><th>{t.col_id}</th><th>{t.col_username}</th><th>{t.col_role}</th><th>{t.col_action}</th></tr></thead>
                    <tbody>
                      {systemUsers.map((u: any) => (
                        <tr key={u.id}>
                          <td>{u.id}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span>{u.username}</span>
                              {currentUser.username === 'admin1905' && u.password && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  {t.col_current_pass} {u.password}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            {u.username === 'admin1905'
                              ? <span style={{ color: 'var(--secondary-color)', fontWeight: 700 }}>{t.role_master_admin}</span>
                              : u.role === 'admin'
                                ? <span style={{ color: '#4FC3F7' }}>{t.role_admin}</span>
                                : <span style={{ color: 'var(--text-secondary)' }}>{t.role_staff}</span>}
                          </td>
                          <td style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {currentUser.username === 'admin1905' && (
                               <button 
                                 onClick={() => { setEditingUserPass(u); setNewUserPass(u.password || ''); }} 
                                 title={t.btn_password} 
                                 style={{ background: 'none', border: 'none', color: 'var(--secondary-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
                               >
                                 <Lock size={15} /> {t.btn_password}
                               </button>
                            )}
                            {u.username !== 'admin1905' && (currentUser.username === 'admin1905' || u.role !== 'admin') && (
                              <button onClick={() => handleDeleteUser(u.id)} title={t.btn_delete} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                                <Trash2 size={15} /> {t.btn_delete}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PASSWORD CHANGE MODAL */}
              {editingUserPass && (
                <div className="modal-overlay" onClick={() => setEditingUserPass(null)}>
                  <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', border: '1px solid var(--secondary-color)', boxShadow: '0 10px 40px rgba(255,182,18,0.1)' }}>
                    <div className="modal-header">
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--secondary-color)' }}>
                        <Lock size={20} /> {t.pass_modal_title(editingUserPass.username)}
                      </h3>
                      <button className="modal-close" onClick={() => setEditingUserPass(null)}><X size={20} /></button>
                    </div>
                    <div className="modal-body" style={{ padding: '24px' }}>
                      <div className="input-group">
                        <label>{t.new_password_label}</label>
                        <div className="input-with-icon" style={{ marginBottom: '8px' }}>
                          <Lock size={18} color="var(--text-secondary)" />
                          <input 
                            type="text" 
                            value={newUserPass} 
                            onChange={e => setNewUserPass(e.target.value)} 
                            style={{ background: 'transparent', color: 'var(--text-primary)', border: 'none', outline: 'none', width: '100%' }} 
                            placeholder={t.new_password_placeholder} 
                            autoFocus
                          />
                        </div>
                      </div>
                      <button 
                        className="huge-save-btn" 
                        style={{ marginTop: '24px', padding: '14px', fontSize: '1rem' }} 
                        onClick={() => handleUpdateUserPassword(editingUserPass.id, newUserPass)}
                      >
                        {t.btn_update_password}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="card">
                <div className="card-header"><h3>{t.add_user_title}</h3></div>
                <form onSubmit={handleAddUser}>
                  <div className="input-group">
                    <label>{t.field_username}</label>
                    <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} required className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }} />
                  </div>
                  <div className="input-group">
                    <label>{t.field_password}</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }} />
                  </div>
                  <div className="input-group">
                    <label>{t.field_role}</label>
                    <select value={newRole} onChange={e => setNewRole(e.target.value)} className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }}>
                      <option value="staff">{t.role_staff_opt}</option>
                      <option value="admin">{t.role_admin_opt}</option>
                    </select>
                  </div>
                  <button type="submit" className="add-btn" style={{ width: '100%', justifyContent: 'center', marginTop: '16px' }}>{t.btn_add}</button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'members' && !showAddMember && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'stretch' }}>
                {/* Row 1: Title + Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <h3 style={{ margin: 0 }}>{t.members_title} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>({displayedMembers.length} {lang === 'tr' ? 'üye' : 'Mitglieder'})</span></h3>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={exportMembersToExcel}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'linear-gradient(135deg, #1D6F42, #2E8B57)',
                        color: 'white', border: 'none', padding: '10px 18px',
                        borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
                        boxShadow: '0 4px 12px rgba(29,111,66,0.3)'
                      }}
                    >
                      <FileText size={16} /> {t.btn_export_excel}
                    </button>
                    <button className="add-btn" onClick={() => setShowAddMember(true)}>
                      <UserPlus size={18} /> {t.btn_new_member}
                    </button>
                  </div>
                </div>

                {/* Row 2: Search Bar */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: 'var(--surface-light)', border: '1px solid var(--border-color)',
                  borderRadius: '12px', padding: '10px 16px'
                }}>
                  <Search size={18} color="var(--secondary-color)" style={{ flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder={t.search_members}
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    style={{
                      background: 'transparent', border: 'none', outline: 'none',
                      color: 'var(--text-primary)', fontSize: '0.95rem', width: '100%'
                    }}
                  />
                  {memberSearch && (
                    <button onClick={() => setMemberSearch('')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0' }}>
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* Row 3: Filter Button */}
                <button
                  className={`filter-btn ${showApproachingRenewal ? 'active' : ''}`}
                  onClick={() => setShowApproachingRenewal(!showApproachingRenewal)}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Bell size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  {t.filter_renewal}
                </button>
              </div>
              {/* Member Cards Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '14px',
                marginTop: '4px'
              }}>
                {displayedMembers.length === 0 && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                    <Users size={48} style={{ opacity: 0.3, marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                    <p>{t.no_records}</p>
                  </div>
                )}
                {displayedMembers.map((m: any) => {
                  const ann = getAnniversaryData(m.Registration_Date);
                  const isExpired = ann.diffDays < 0;
                  const isWarning = ann.diffDays >= 0 && ann.diffDays <= 90;
                  const statusColor = isExpired ? 'var(--danger)' : isWarning ? 'var(--secondary-color)' : 'var(--success)';
                  const typeColor = m.Member_Type === 'Normal' ? '#4FC3F7' : m.Member_Type === 'Kadın' ? '#F48FB1' : '#A5D6A7';
                  return (
                    <div key={m.id} style={{
                      background: 'var(--surface-color)',
                      border: `1px solid ${isExpired ? 'rgba(244,67,54,0.3)' : isWarning ? 'rgba(255,182,18,0.3)' : 'var(--border-color)'}`,
                      borderRadius: '16px',
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                      cursor: 'default'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)', e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'none', e.currentTarget.style.boxShadow = 'none')}
                    >
                      {/* Card Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '44px', height: '44px', borderRadius: '50%',
                            background: `linear-gradient(135deg, var(--primary-color), #5A0001)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--secondary-color)', fontWeight: 800, fontSize: '1rem', flexShrink: 0
                          }}>
                            {(m.Name?.[0] || '?').toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                              {m.Name} {m.Surname}
                            </div>
                            <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                              <span style={{
                                background: `${typeColor}22`, color: typeColor,
                                padding: '2px 8px', borderRadius: '20px', fontWeight: 600
                              }}>{m.Member_Type || 'Normal'}</span>
                            </div>
                          </div>
                        </div>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px',
                          borderRadius: '20px', background: `${statusColor}22`, color: statusColor
                        }}>
                          {m.Status === 'Active' ? t.status_active : t.status_passive}
                        </span>
                      </div>

                      {/* Card Info */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {m.Phone && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.9rem' }}>📞</span> {m.Phone}
                        </div>}
                        {m.Email && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.9rem' }}>✉️</span> {m.Email}
                        </div>}
                        {m.Address && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.9rem' }}>📍</span> {m.Address}
                        </div>}
                      </div>

                      {/* Payment Row */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: 'var(--surface-light)', borderRadius: '10px', padding: '10px 14px',
                        fontSize: '0.8rem'
                      }}>
                        <div>
                          <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>{t.label_reg}</div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.Registration_Date || '-'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>{t.label_renewal}</div>
                          <div style={{ fontWeight: 700, color: statusColor }}>
                            {ann.nextPayment}
                            {isExpired && <span style={{ marginLeft: '4px' }}>⚠️</span>}
                            {isWarning && !isExpired && <span style={{ marginLeft: '4px' }}>⏰</span>}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => { setEditingMember(m); setEditMemberData({ ...m }); }}
                          style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            background: 'rgba(255,182,18,0.1)', color: 'var(--secondary-color)',
                            border: '1px solid rgba(255,182,18,0.2)', borderRadius: '10px',
                            padding: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem'
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          {t.btn_edit}
                        </button>
                        {currentUser?.role === 'admin' && (
                          <button
                            onClick={() => handleDeleteMember(m.id, m.Name + ' ' + m.Surname)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                              background: 'rgba(244,67,54,0.1)', color: 'var(--danger)',
                              border: '1px solid rgba(244,67,54,0.2)', borderRadius: '10px',
                              padding: '8px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ADD MEMBER FORM (Mobile Friendly) */}
          {showAddMember && (
            <div className="mobile-entry-container">
              <div className="mobile-header" style={{ display: 'flex', alignItems: 'center', padding: '24px 16px', gap: '16px' }}>
                <button onClick={() => setShowAddMember(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)' }}><ArrowLeft size={28} /></button>
                <h2 style={{ flex: 1, textAlign: 'left' }}>{t.add_member_title}</h2>
              </div>
              <form className="mobile-entry-form" onSubmit={handleAddMemberSubmit}>
                <div className="daily-section">
                  <div className="input-group">
                    <label>{t.field_name}</label>
                    <input type="text" name="Name" value={newMemberData.Name} onChange={handleNewMemberChange} required className="amount-input-wrapper-small amount-input-small" style={{ width: '100%', background: 'var(--surface-light)' }} />
                  </div>
                  <div className="input-group">
                    <label>{t.field_surname}</label>
                    <input type="text" name="Surname" value={newMemberData.Surname} onChange={handleNewMemberChange} required className="amount-input-wrapper-small amount-input-small" style={{ width: '100%', background: 'var(--surface-light)' }} />
                  </div>
                  <div className="input-group">
                    <label>{t.field_address}</label>
                    <input type="text" name="Address" value={newMemberData.Address} onChange={handleNewMemberChange} className="amount-input-wrapper-small amount-input-small" style={{ width: '100%', background: 'var(--surface-light)' }} />
                  </div>
                  <div className="input-group">
                    <label>{t.field_phone}</label>
                    <input type="tel" name="Phone" value={newMemberData.Phone} onChange={handleNewMemberChange} className="amount-input-wrapper-small amount-input-small" style={{ width: '100%', background: 'var(--surface-light)' }} placeholder="+49..." />
                  </div>
                  <div className="input-group">
                    <label>{t.field_email}</label>
                    <input type="email" name="Email" value={newMemberData.Email} onChange={handleNewMemberChange} className="amount-input-wrapper-small amount-input-small" style={{ width: '100%', background: 'var(--surface-light)' }} />
                  </div>
                  <div className="input-group">
                    <label>{t.field_bank}</label>
                    <input type="text" name="Bank_Name" value={newMemberData.Bank_Name} onChange={handleNewMemberChange} className="amount-input-wrapper-small amount-input-small" style={{ width: '100%', background: 'var(--surface-light)' }} placeholder="Sparkasse vb." />
                  </div>
                  <div className="input-group">
                    <label>{t.field_iban}</label>
                    <input type="text" name="IBAN" value={newMemberData.IBAN} onChange={handleNewMemberChange} className="amount-input-wrapper-small amount-input-small" style={{ width: '100%', background: 'var(--surface-light)', fontFamily: 'monospace' }} placeholder="DE..." />
                  </div>
                  <div className="input-group">
                    <label>{t.field_member_type}</label>
                    <select name="Member_Type" value={newMemberData.Member_Type} onChange={handleNewMemberChange} className="amount-input-wrapper-small amount-input-small" style={{ width: '100%', background: 'var(--surface-light)' }}>
                      <option value="Normal">{t.member_type_normal}</option>
                      <option value="Kadın">{t.member_type_kadin}</option>
                      <option value="Öğrenci/Emekli">{t.member_type_ogrenci}</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label style={{ color: '#FFB612' }}><Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />{t.field_reg_date}</label>
                    <input type="date" name="Registration_Date" value={newMemberData.Registration_Date} onChange={handleNewMemberChange} className="amount-input-wrapper-small" style={{ width: '100%', background: 'var(--surface-light)', color: 'white', border: '1px solid var(--secondary-color)' }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>{t.field_reg_date_hint}</span>
                  </div>
                </div>
                <div style={{ padding: '0 16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {t.add_member_note}
                </div>
                <div className="sticky-bottom-action">
                  <button type="submit" className="huge-save-btn" disabled={isSubmitting}>
                    {isSubmitting ? t.btn_saving : t.btn_save_member}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* DAILY CLOSING TAB */}
          {activeTab === 'financials' && !showAddMember && (
            <div className="mobile-entry-container">
              {showSuccess ? (
                <div className="success-overlay">
                  <CheckCircle2 size={80} color="#FFB612" />
                  <h2>{t.daily_success}</h2>
                </div>
              ) : (
                <>
                  <div className="mobile-header">
                    <h2>{t.daily_title}</h2>
                  </div>
                  <form className="mobile-entry-form" onSubmit={handleDailySubmit}>
                    <div className="daily-section">
                      <div className="input-group" style={{ marginBottom: '20px' }}>
                        <label style={{ color: '#FFB612' }}>{t.daily_date_label}</label>
                        <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="amount-input-wrapper-small" style={{ width: '100%', background: 'var(--surface-light)', color: 'white', border: '1px solid var(--secondary-color)' }} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>{t.daily_date_hint}</span>
                      </div>
                      <h3 className="section-title income-title"><TrendingUp size={20} /> {t.daily_income_title}</h3>
                      <div className="input-group">
                        <label>{t.income_entry}</label>
                        <div className="amount-input-wrapper-small"><span className="currency-symbol-small">€</span><input type="number" step="0.01" name="incomeEntry" value={dailyData.incomeEntry} onChange={handleDailyDataChange} className="amount-input-small" placeholder="0.00" /></div>
                      </div>
                      <div className="input-group">
                        <label>{t.income_kitchen}</label>
                        <div className="amount-input-wrapper-small"><span className="currency-symbol-small">€</span><input type="number" step="0.01" name="incomeKitchen" value={dailyData.incomeKitchen} onChange={handleDailyDataChange} className="amount-input-small" placeholder="0.00" /></div>
                      </div>
                      <div className="input-group">
                        <label>{t.income_buffet}</label>
                        <div className="amount-input-wrapper-small"><span className="currency-symbol-small">€</span><input type="number" step="0.01" name="incomeBuffet" value={dailyData.incomeBuffet} onChange={handleDailyDataChange} className="amount-input-small" placeholder="0.00" /></div>
                      </div>
                    </div>
                    <div className="daily-section">
                      <h3 className="section-title expense-title"><TrendingDown size={20} /> {t.daily_expense_title}</h3>
                      <div className="input-group">
                        <label>{t.expense_rent}</label>
                        <div className="amount-input-wrapper-small"><span className="currency-symbol-small">€</span><input type="number" step="0.01" name="expenseRent" value={dailyData.expenseRent} onChange={handleDailyDataChange} className="amount-input-small" placeholder="0.00" /></div>
                      </div>
                      <div className="input-group">
                        <label>{t.expense_supplies}</label>
                        <div className="amount-input-wrapper-small"><span className="currency-symbol-small">€</span><input type="number" step="0.01" name="expenseSupplies" value={dailyData.expenseSupplies} onChange={handleDailyDataChange} className="amount-input-small" placeholder="0.00" /></div>
                      </div>
                    </div>
                    <div className="daily-profit-card">
                      <h4>{t.net_status}</h4>
                      <h1 className={dailyProfit >= 0 ? 'positive' : 'negative'}>{dailyProfit >= 0 ? '+' : ''}€ {dailyProfit.toFixed(2)}</h1>
                    </div>
                    <div className="camera-section">
                      <input type="file" id="receipt-upload" name="receipt" accept="image/*" capture="environment" className="hidden-file-input" ref={fileInputRef} onChange={handleFileChange} />
                      <label htmlFor="receipt-upload" className={`camera-btn ${fileName ? 'has-file' : ''}`}>
                        <Camera size={48} className="camera-icon" />
                        <div className="camera-text">
                          <span className="main-text">{fileName ? t.upload_receipt : t.upload_receipt}</span>
                          <span className="sub-text">{fileName ? fileName : t.upload_receipt_sub}</span>
                        </div>
                      </label>
                    </div>
                    <div className="sticky-bottom-action">
                      <button type="submit" className="huge-save-btn" disabled={isSubmitting}>
                        {isSubmitting ? t.btn_saving : t.btn_save_day}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          )}

          {/* SPONSORS TAB */}
          {activeTab === 'sponsors' && !showAddMember && (
            <div>
              <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>{t.sponsors_title}</h1>
                <button className="add-btn" onClick={() => setShowAddSponsor(true)}><Plus size={16} /> {t.btn_new_sponsor}</button>
              </div>
              <div className="card" style={{ marginBottom: '20px' }}>
                <div className="card-header"><h3><Star size={16} style={{ display: 'inline', marginRight: '6px', color: 'var(--secondary-color)' }} />{t.sponsors_title}</h3></div>
                <div className="table-responsive">
                  <table className="transactions-table">
                    <thead><tr><th>{t.col_name}</th><th>{t.col_amount}</th><th>{t.col_period}</th><th>{t.col_last_payment}</th><th>{t.col_next_payment}</th><th>{t.col_status}</th><th></th></tr></thead>
                    <tbody>
                      {sponsors.map((s: any) => {
                        const nextD = new Date(s.Next_Payment_Date);
                        const today = new Date();
                        const diffDays = Math.ceil((nextD.getTime() - today.getTime()) / 86400000);
                        const isOverdue = diffDays < 0;
                        const isSoon = diffDays >= 0 && diffDays <= 30;
                        const periodLabel: Record<string, string> = { monthly: t.period_monthly, quarterly: t.period_quarterly, 'semi-annual': t.period_semi, annual: t.period_annual, custom4: t.period_custom4, custom5: t.period_custom5 };
                        return (
                          <tr key={s.id}>
                            <td style={{ fontWeight: '600' }}>{s.Name} {s.Surname}{s.Company ? <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{s.Company}</span> : null}</td>
                            <td style={{ color: 'var(--secondary-color)', fontWeight: '700' }}>€ {parseFloat(s.Amount).toFixed(2)}</td>
                            <td><span style={{ background: 'rgba(255,182,18,0.12)', color: 'var(--secondary-color)', padding: '3px 10px', borderRadius: '20px', fontSize: '0.8rem' }}>{periodLabel[s.Payment_Period] || s.Payment_Period}</span></td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{s.Last_Payment_Date}</td>
                            <td style={{ color: isOverdue ? 'var(--danger)' : isSoon ? 'var(--secondary-color)' : 'inherit', fontWeight: isOverdue || isSoon ? '700' : 'normal' }}>
                              {s.Next_Payment_Date}
                              {isOverdue && <span className="expired-warning" style={{ marginLeft: '6px' }}>{t.label_expired}</span>}
                              {isSoon && !isOverdue && <span className="due-date-warning" style={{ marginLeft: '6px' }}>{t.label_approaching}</span>}
                            </td>
                            <td><span style={{ color: s.Status === 'Active' ? 'var(--success)' : 'var(--danger)' }}>{s.Status === 'Active' ? t.status_active : t.status_passive}</span></td>
                            <td style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <button onClick={() => { setEditingSponsor(s); setEditSponsorData({ ...s }); }} title={t.btn_edit} style={{ background: 'none', border: 'none', color: 'var(--secondary-color)', cursor: 'pointer', padding: '4px' }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                              </button>
                              {currentUser?.role === 'admin' && <button onClick={() => handleDeleteSponsor(s.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}><Trash2 size={15} /></button>}
                            </td>
                          </tr>
                        );
                      })}
                      {sponsors.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{t.no_sponsors}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* FINANCE DETAIL TAB */}
          {activeTab === 'financedetail' && !showAddMember && (
            <>
              <div className="page-header"><h1>{t.finance_title}</h1></div>

              {/* TOP KPI CARDS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                {[
                  { label: t.fin_sales_income, value: financeStats.monthly.salesIncome, color: '#4CAF50', icon: '🛒' },
                  { label: t.fin_membership_income, value: financeStats.monthly.membershipIncome, color: '#FFB612', icon: '👥' },
                  { label: t.fin_sponsor_income, value: financeStats.monthly.sponsorIncome, color: '#9C27B0', icon: '⭐' },
                  { label: t.fin_total_income, value: financeStats.monthly.totalIncome, color: '#2196F3', icon: '📈' },
                  { label: t.fin_expense, value: financeStats.monthly.expense, color: '#F44336', icon: '📉' },
                  { label: t.fin_net, value: financeStats.monthly.net, color: financeStats.monthly.net >= 0 ? '#4CAF50' : '#F44336', icon: '💰' },
                ].map((item, i) => (
                  <div key={i} className="card" style={{ borderTop: `3px solid ${item.color}`, padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '1.4rem' }}>{item.icon}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>{item.label}</span>
                    </div>
                    <p style={{ fontSize: '1.6rem', fontWeight: '800', color: item.color, marginTop: '8px' }}>€ {item.value.toFixed(2)}</p>
                  </div>
                ))}
              </div>

              {/* INCOME BREAKDOWN BAR */}
              <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
                <h3 style={{ marginBottom: '16px', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Bu Ay Gelir Dağılımı</h3>
                {(() => {
                  const total = financeStats.monthly.totalIncome || 1;
                  const items = [
                    { label: t.fin_sales_income, value: financeStats.monthly.salesIncome, color: '#4CAF50' },
                    { label: t.fin_membership_income, value: financeStats.monthly.membershipIncome, color: '#FFB612' },
                    { label: t.fin_sponsor_income, value: financeStats.monthly.sponsorIncome, color: '#9C27B0' },
                  ];
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {items.map((it, i) => (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{it.label}</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: it.color }}>€ {it.value.toFixed(2)} ({((it.value / total) * 100).toFixed(1)}%)</span>
                          </div>
                          <div style={{ background: 'var(--surface-light)', borderRadius: '8px', height: '8px', overflow: 'hidden' }}>
                            <div style={{ width: `${(it.value / total) * 100}%`, height: '100%', background: it.color, borderRadius: '8px', transition: 'width 0.6s ease' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* SPONSOR BOX */}
              <div className="card" style={{ marginBottom: '20px', background: 'linear-gradient(135deg,rgba(156,39,176,0.1),rgba(103,58,183,0.05))', border: '1px solid rgba(156,39,176,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ color: '#CE93D8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>⭐ {t.fin_active_sponsors}</h3>
                    <p style={{ fontSize: '2rem', fontWeight: '800', color: '#9C27B0' }}>{financeStats.activeSponsorCount} {lang === 'tr' ? 'Sponsor' : 'Sponsoren'}</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t.fin_monthly_sponsor}: <strong style={{ color: '#CE93D8' }}>€ {(financeStats.totalActiveSponsorMonthly || 0).toFixed(2)}</strong></p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t.fin_monthly_sponsor}</p>
                    <p style={{ fontSize: '1.8rem', fontWeight: '800', color: '#9C27B0' }}>€ {financeStats.monthly.sponsorIncome.toFixed(2)}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t.fin_yearly} {t.fin_sponsor_income}</p>
                    <p style={{ fontSize: '1.3rem', fontWeight: '700', color: '#BA68C8' }}>€ {financeStats.yearly.sponsorIncome.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* YEARLY + ALL TIME */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '1.2rem' }}>📅</span>
                    <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Bu Yıl ({new Date().getFullYear()})</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { l: t.fin_sales_income, v: financeStats.yearly.salesIncome, c: '#4CAF50' },
                      { l: t.fin_membership_income, v: financeStats.yearly.membershipIncome, c: '#FFB612' },
                      { l: t.fin_sponsor_income, v: financeStats.yearly.sponsorIncome, c: '#9C27B0' },
                    ].map((r, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{r.l}</span><strong style={{ color: r.c }}>€ {r.v.toFixed(2)}</strong></div>)}
                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t.fin_total_income}</span><strong style={{ color: '#2196F3' }}>€ {financeStats.yearly.totalIncome.toFixed(2)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t.fin_expense}</span><strong style={{ color: '#F44336' }}>€ {financeStats.yearly.expense.toFixed(2)}</strong></div>
                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: '600' }}>{t.fin_net}</span><strong style={{ color: financeStats.yearly.net >= 0 ? '#4CAF50' : '#F44336', fontSize: '1.1rem' }}>€ {financeStats.yearly.net.toFixed(2)}</strong></div>
                  </div>
                </div>
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🏛️</span>
                    <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>{t.fin_alltime}</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t.fin_total_income}</span><strong style={{ color: '#4CAF50' }}>€ {financeStats.allTime.totalIncome.toFixed(2)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t.fin_sponsor_income}</span><strong style={{ color: '#9C27B0' }}>€ {financeStats.allTime.totalSponsorIncome.toFixed(2)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t.fin_expense}</span><strong style={{ color: '#F44336' }}>€ {financeStats.allTime.totalExpense.toFixed(2)}</strong></div>
                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: '600' }}>{t.stat_net_cash}</span><strong style={{ color: financeStats.allTime.netBalance >= 0 ? '#4CAF50' : '#F44336', fontSize: '1.2rem' }}>€ {financeStats.allTime.netBalance.toFixed(2)}</strong></div>
                  </div>
                </div>
              </div>

              {/* MONTHLY HISTORY CHART */}
              {financeStats.monthlyHistory.length > 0 && (
                <div className="card" style={{ marginBottom: '20px' }}>
                  <div className="card-header"><h3>{t.fin_history_title}</h3></div>
                  <div style={{ height: '280px' }}>
                    <Bar options={{
                      maintainAspectRatio: false, responsive: true,
                      plugins: { legend: { position: 'top', labels: { color: 'var(--text-secondary)', boxWidth: 12 } } },
                      scales: { x: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { ticks: { color: 'var(--text-secondary)', callback: (v: any) => `€${v}` }, grid: { color: 'rgba(255,255,255,0.05)' } } }
                    }} data={{
                      labels: financeStats.monthlyHistory.map((m: any) => m.month),
                      datasets: [
                        { label: t.fin_sales_income, data: financeStats.monthlyHistory.map((m: any) => m.sales), backgroundColor: 'rgba(76,175,80,0.75)', borderRadius: 4 },
                        { label: t.fin_membership_income, data: financeStats.monthlyHistory.map((m: any) => m.membership), backgroundColor: 'rgba(255,182,18,0.75)', borderRadius: 4 },
                        { label: t.fin_sponsor_income, data: financeStats.monthlyHistory.map((m: any) => m.sponsor), backgroundColor: 'rgba(156,39,176,0.75)', borderRadius: 4 },
                        { label: t.fin_expense, data: financeStats.monthlyHistory.map((m: any) => m.expense), backgroundColor: 'rgba(244,67,54,0.75)', borderRadius: 4 },
                      ]
                    }} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ARCHIVE TAB */}
          {activeTab === 'archive' && !showAddMember && (
            <div className="card">
              <div className="card-header"><h3>{t.archive_title}</h3></div>
              <div className="archive-list">
                {archiveData.map((archive: any, index) => (
                  <div key={index} className="archive-item" onClick={() => setSelectedArchive(archive)}>
                    <div>
                      <div className="archive-date"><FileText size={16} style={{ display: 'inline', marginRight: '8px' }} /> {archive.Date} {t.archive_detail_title}</div>
                      <div className="archive-summary">
                        {t.archive_daily_income}: <span className="positive">€{archive.Daily_Income}</span> |
                        {t.archive_daily_expense}: <span className="negative">€{archive.Daily_Expense}</span>
                        <div style={{ marginTop: '4px', fontSize: '0.8rem', color: 'var(--secondary-color)' }}>{t.archive_by}: {archive.Created_By}</div>
                      </div>
                    </div>
                    {archive.File_Path && <Camera size={20} color="#FFB612" />}
                  </div>
                ))}
                {archiveData.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>{t.archive_empty}</p>}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Mobile Nav */}
      <nav className="mobile-nav">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => { setActiveTab('dashboard'); setShowAddMember(false); }}><PieChart size={20} /><span>{t.mnav_home}</span></button>
        <button className={activeTab === 'members' ? 'active' : ''} onClick={() => { setActiveTab('members'); setShowAddMember(false); }}><Users size={20} /><span>{t.mnav_members}</span></button>
        <button onClick={() => { setActiveTab('financials'); setShowAddMember(false); }}>
          <div className="add-circle-nav"><Plus size={26} /></div>
        </button>
        <button className={activeTab === 'archive' ? 'active' : ''} onClick={() => { setActiveTab('archive'); setShowAddMember(false); }}><FolderOpen size={20} /><span>{t.mnav_archive}</span></button>
        <button className={activeTab === 'financedetail' ? 'active' : ''} onClick={() => { setActiveTab('financedetail'); setShowAddMember(false); }}><BarChart3 size={20} /><span>{t.mnav_report}</span></button>
      </nav>

      {/* ADD SPONSOR MODAL */}
      {showAddSponsor && (
        <div className="modal-overlay" onClick={() => setShowAddSponsor(false)}>
          <div className="modal-content" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Star size={18} style={{ display: 'inline', marginRight: '8px', color: 'var(--secondary-color)' }} />{t.add_sponsor_title}</h3>
              <button className="modal-close" onClick={() => setShowAddSponsor(false)}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAddSponsorSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label>{t.field_name_req}</label>
                    <input type="text" name="Name" value={newSponsorData.Name} onChange={handleNewSponsorChange} required className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }} />
                  </div>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label>{t.field_surname}</label>
                    <input type="text" name="Surname" value={newSponsorData.Surname} onChange={handleNewSponsorChange} className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }} />
                  </div>
                </div>
                <div className="input-group" style={{ margin: 0 }}>
                  <label>{t.field_company}</label>
                  <input type="text" name="Company" value={newSponsorData.Company} onChange={handleNewSponsorChange} className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label>{t.field_phone}</label>
                    <input type="tel" name="Phone" value={newSponsorData.Phone} onChange={handleNewSponsorChange} className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }} placeholder="+49..." />
                  </div>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label>{t.field_email}</label>
                    <input type="email" name="Email" value={newSponsorData.Email} onChange={handleNewSponsorChange} className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label style={{ color: 'var(--secondary-color)' }}>{t.field_amount}</label>
                    <input type="number" step="0.01" name="Amount" value={newSponsorData.Amount} onChange={handleNewSponsorChange} required className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }} placeholder="0.00" />
                  </div>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label style={{ color: 'var(--secondary-color)' }}>{t.field_period}</label>
                    <select name="Payment_Period" value={newSponsorData.Payment_Period} onChange={handleNewSponsorChange} className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }}>
                      <option value="monthly">{t.period_monthly}</option>
                      <option value="quarterly">{t.period_quarterly}</option>
                      <option value="custom4">{t.period_custom4}</option>
                      <option value="custom5">{t.period_custom5}</option>
                      <option value="semi-annual">{t.period_semi}</option>
                      <option value="annual">{t.period_annual}</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label>{t.field_last_date}</label>
                    <input type="date" name="Last_Payment_Date" value={newSponsorData.Last_Payment_Date} onChange={handleNewSponsorChange} required className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)', border: '1px solid var(--secondary-color)' }} />
                  </div>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label>{t.field_next_date} <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>({lang === 'tr' ? 'boş=otomatik' : 'leer=auto'})</span></label>
                    <input type="date" name="Next_Payment_Date" value={newSponsorData.Next_Payment_Date} onChange={handleNewSponsorChange} className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)', border: '1px solid var(--border-color)' }} />
                  </div>
                </div>
                <div className="input-group" style={{ margin: 0 }}>
                  <label>{t.field_notes}</label>
                  <textarea name="Notes" value={newSponsorData.Notes} onChange={handleNewSponsorChange} rows={2} style={{ width: '100%', background: 'var(--surface-light)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px 14px', resize: 'none', fontFamily: 'Inter,sans-serif' }} />
                </div>
                <button type="submit" className="huge-save-btn" style={{ marginTop: '8px', position: 'static' }}>{t.btn_save_sponsor}</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ARCHIVE MODAL */}
      {selectedArchive && (
        <div className="modal-overlay" onClick={() => setSelectedArchive(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedArchive.Date} {t.archive_detail_title}</h3>
              <button className="modal-close" onClick={() => setSelectedArchive(null)}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '16px', color: 'var(--secondary-color)', fontWeight: 'bold' }}>{t.archive_by}: {selectedArchive.Created_By}</div>
              <table className="transactions-table" style={{ marginBottom: '20px' }}>
                <thead><tr><th>{t.field_category}</th><th>{t.field_type}</th><th>{t.col_amount}</th><th></th></tr></thead>
                <tbody>
                  {selectedArchive.Details.map((det: any, i: number) => (
                    <tr key={i}>
                      <td>{det.Category}</td>
                      <td>{det.Type === 'Income' ? t.type_income : t.type_expense}</td>
                      <td className={det.Type === 'Income' ? 'amount positive' : 'amount negative'}>€{det.Amount}</td>
                      <td style={{ display: 'flex', gap: '4px' }}>
                        {(currentUser?.role === 'admin' || currentUser?.username === selectedArchive.Created_By) && (
                          <button onClick={() => { setEditingTransaction(det); setEditTransactionData({ Date: selectedArchive.Date, Type: det.Type, Category: det.Category, Amount: det.Amount, Notes: det.Notes || '' }); }} title={t.btn_edit} style={{ background: 'none', border: 'none', color: 'var(--secondary-color)', cursor: 'pointer' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          </button>
                        )}
                        {(currentUser?.role === 'admin' || currentUser?.username === selectedArchive.Created_By) && (
                          <button onClick={() => handleDeleteTransaction(det.id)} title="Geri Al (Sil)" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedArchive.File_Path && (
                <div>
                  <h4 style={{ marginBottom: '8px', color: 'var(--text-secondary)' }}>{t.archive_receipt}:</h4>
                  <img
                    src={`${BACKEND_URL}${selectedArchive.File_Path.replace(/\\/g, '/')}`}
                    alt="Çentik"
                    className="receipt-image"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT MEMBER MODAL */}
      {editingMember && editMemberData && (
        <div className="modal-overlay" onClick={() => { setEditingMember(null); setEditMemberData(null); }}>
          <div className="modal-content" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t.edit_member_title(editingMember.Name + ' ' + editingMember.Surname)}</h3>
              <button className="modal-close" onClick={() => { setEditingMember(null); setEditMemberData(null); }}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleEditMemberSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="input-group" style={{ margin: 0 }}><label>{t.field_name_req}</label><input type="text" value={editMemberData.Name} onChange={e => setEditMemberData({ ...editMemberData, Name: e.target.value })} required className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }} /></div>
                  <div className="input-group" style={{ margin: 0 }}><label>{t.field_surname_req}</label><input type="text" value={editMemberData.Surname} onChange={e => setEditMemberData({ ...editMemberData, Surname: e.target.value })} required className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="input-group" style={{ margin: 0 }}><label>{t.field_phone}</label><input type="tel" value={editMemberData.Phone || ''} onChange={e => setEditMemberData({ ...editMemberData, Phone: e.target.value })} className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }} /></div>
                  <div className="input-group" style={{ margin: 0 }}><label>{t.field_email}</label><input type="email" value={editMemberData.Email || ''} onChange={e => setEditMemberData({ ...editMemberData, Email: e.target.value })} className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }} /></div>
                </div>
                <div className="input-group" style={{ margin: 0 }}><label>{t.field_address}</label><input type="text" value={editMemberData.Address || ''} onChange={e => setEditMemberData({ ...editMemberData, Address: e.target.value })} className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="input-group" style={{ margin: 0 }}><label>{t.field_bank}</label><input type="text" value={editMemberData.Bank_Name || ''} onChange={e => setEditMemberData({ ...editMemberData, Bank_Name: e.target.value })} className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }} /></div>
                  <div className="input-group" style={{ margin: 0 }}><label>IBAN</label><input type="text" value={editMemberData.IBAN || ''} onChange={e => setEditMemberData({ ...editMemberData, IBAN: e.target.value })} className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)', fontFamily: 'monospace' }} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label style={{ color: 'var(--secondary-color)' }}>{t.field_member_type_label}</label>
                    <select value={editMemberData.Member_Type} onChange={e => setEditMemberData({ ...editMemberData, Member_Type: e.target.value })} className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }}>
                      <option value="Normal">{t.member_type_normal}</option>
                      <option value="Kadın">{t.member_type_kadin}</option>
                      <option value="Öğrenci/Emekli">{t.member_type_ogrenci}</option>
                    </select>
                  </div>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label style={{ color: 'var(--secondary-color)' }}>{t.field_reg_date_label}</label>
                    <input type="date" value={editMemberData.Registration_Date || ''} onChange={e => setEditMemberData({ ...editMemberData, Registration_Date: e.target.value })} className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)', border: '1px solid var(--secondary-color)' }} />
                  </div>
                </div>
                <div className="input-group" style={{ margin: 0 }}>
                  <label>{t.field_status}</label>
                  <select value={editMemberData.Status} onChange={e => setEditMemberData({ ...editMemberData, Status: e.target.value })} className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }}>
                    <option value="Active">{t.status_active}</option>
                    <option value="Passive">{t.status_passive}</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button type="button" onClick={() => { setEditingMember(null); setEditMemberData(null); }} style={{ flex: 1, padding: '12px', background: 'var(--surface-light)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>{t.btn_cancel}</button>
                  <button type="submit" className="add-btn" style={{ flex: 2, justifyContent: 'center', padding: '12px' }}>{t.btn_save}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SPONSOR MODAL */}
      {editingSponsor && editSponsorData && (
        <div className="modal-overlay" onClick={() => { setEditingSponsor(null); setEditSponsorData(null); }}>
          <div className="modal-content" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Star size={18} style={{ display: 'inline', marginRight: '8px', color: 'var(--secondary-color)' }} /> {t.edit_sponsor_title}</h3>
              <button className="modal-close" onClick={() => { setEditingSponsor(null); setEditSponsorData(null); }}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleEditSponsorSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="input-group" style={{ margin: 0 }}><label>{t.field_name_req}</label><input type="text" value={editSponsorData.Name} onChange={e => setEditSponsorData({ ...editSponsorData, Name: e.target.value })} required className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }} /></div>
                  <div className="input-group" style={{ margin: 0 }}><label>{t.field_surname}</label><input type="text" value={editSponsorData.Surname || ''} onChange={e => setEditSponsorData({ ...editSponsorData, Surname: e.target.value })} className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }} /></div>
                </div>
                <div className="input-group" style={{ margin: 0 }}><label>{t.field_company}</label><input type="text" value={editSponsorData.Company || ''} onChange={e => setEditSponsorData({ ...editSponsorData, Company: e.target.value })} className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label style={{ color: 'var(--secondary-color)' }}>{t.field_amount}</label>
                    <input type="number" step="0.01" value={editSponsorData.Amount} onChange={e => setEditSponsorData({ ...editSponsorData, Amount: e.target.value })} required className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }} />
                  </div>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label style={{ color: 'var(--secondary-color)' }}>{t.field_period}</label>
                    <select value={editSponsorData.Payment_Period} onChange={e => setEditSponsorData({ ...editSponsorData, Payment_Period: e.target.value })} className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }}>
                      <option value="monthly">{t.period_monthly}</option>
                      <option value="quarterly">{t.period_quarterly}</option>
                      <option value="custom4">{t.period_custom4}</option>
                      <option value="custom5">{t.period_custom5}</option>
                      <option value="semi-annual">{t.period_semi}</option>
                      <option value="annual">{t.period_annual}</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="input-group" style={{ margin: 0 }}><label>{t.field_last_date}</label><input type="date" value={editSponsorData.Last_Payment_Date} onChange={e => setEditSponsorData({ ...editSponsorData, Last_Payment_Date: e.target.value })} required className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)', border: '1px solid var(--secondary-color)' }} /></div>
                  <div className="input-group" style={{ margin: 0 }}><label>{t.field_next_date}</label><input type="date" value={editSponsorData.Next_Payment_Date} onChange={e => setEditSponsorData({ ...editSponsorData, Next_Payment_Date: e.target.value })} className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }} /></div>
                </div>
                <div className="input-group" style={{ margin: 0 }}>
                  <label>{t.field_status}</label>
                  <select value={editSponsorData.Status} onChange={e => setEditSponsorData({ ...editSponsorData, Status: e.target.value })} className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }}>
                    <option value="Active">{t.status_active}</option>
                    <option value="Passive">{t.status_passive}</option>
                  </select>
                </div>
                <div className="input-group" style={{ margin: 0 }}><label>{t.field_notes}</label><textarea value={editSponsorData.Notes || ''} onChange={e => setEditSponsorData({ ...editSponsorData, Notes: e.target.value })} rows={2} style={{ width: '100%', background: 'var(--surface-light)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px 14px', resize: 'none', fontFamily: 'Inter,sans-serif' }} /></div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button type="button" onClick={() => { setEditingSponsor(null); setEditSponsorData(null); }} style={{ flex: 1, padding: '12px', background: 'var(--surface-light)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>{t.btn_cancel}</button>
                  <button type="submit" className="add-btn" style={{ flex: 2, justifyContent: 'center', padding: '12px' }}>{t.btn_save}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TRANSACTION MODAL */}
      {editingTransaction && editTransactionData && (
        <div className="modal-overlay" onClick={() => { setEditingTransaction(null); setEditTransactionData(null); }}>
          <div className="modal-content" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ {t.edit_tx_title}</h3>
              <button className="modal-close" onClick={() => { setEditingTransaction(null); setEditTransactionData(null); }}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleEditTransactionSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="input-group" style={{ margin: 0 }}>
                  <label>{t.field_date}</label>
                  <input type="date" value={editTransactionData.Date} onChange={e => setEditTransactionData({ ...editTransactionData, Date: e.target.value })} required className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)', border: '1px solid var(--secondary-color)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label>{t.field_type}</label>
                    <select value={editTransactionData.Type} onChange={e => setEditTransactionData({ ...editTransactionData, Type: e.target.value })} className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }}>
                      <option value="Income">{t.type_income}</option>
                      <option value="Expense">{t.type_expense}</option>
                    </select>
                  </div>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label>{t.field_category}</label>
                    <input type="text" value={editTransactionData.Category} onChange={e => setEditTransactionData({ ...editTransactionData, Category: e.target.value })} required className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }} />
                  </div>
                </div>
                <div className="input-group" style={{ margin: 0 }}>
                  <label style={{ color: 'var(--secondary-color)' }}>{t.field_amount_eur}</label>
                  <input type="number" step="0.01" value={editTransactionData.Amount} onChange={e => setEditTransactionData({ ...editTransactionData, Amount: e.target.value })} required className="amount-input-wrapper-small" style={{ width: '100%', color: 'white', background: 'var(--surface-light)' }} />
                </div>
                <div className="input-group" style={{ margin: 0 }}>
                  <label>{t.field_notes}</label>
                  <textarea value={editTransactionData.Notes || ''} onChange={e => setEditTransactionData({ ...editTransactionData, Notes: e.target.value })} rows={2} style={{ width: '100%', background: 'var(--surface-light)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px 14px', resize: 'none', fontFamily: 'Inter,sans-serif' }} />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button type="button" onClick={() => { setEditingTransaction(null); setEditTransactionData(null); }} style={{ flex: 1, padding: '12px', background: 'var(--surface-light)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>{t.btn_cancel}</button>
                  <button type="submit" className="add-btn" style={{ flex: 2, justifyContent: 'center', padding: '12px' }}>{t.btn_save}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
