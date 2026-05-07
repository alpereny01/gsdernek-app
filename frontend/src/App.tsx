import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { Users, PieChart, Banknote, FolderOpen, Search, Bell, Plus, TrendingUp, TrendingDown, Vault, Camera, CheckCircle2, X, FileText, Lock, User, LogOut, Settings, UserPlus, ArrowLeft, Trash2, Star, Calendar, CreditCard, BarChart3, DollarSign, Receipt } from 'lucide-react';
import './index.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const BACKEND_URL = import.meta.env.DEV ? 'http://localhost:5000/' : '/';
const API_URL = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState('light');
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
        setCurrentUser(res.data.user);
        setLoginError('');
      }
    } catch (err: any) {
      setLoginError(err.response?.data?.message || 'Giriş başarısız.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginUsername('');
    setLoginPassword('');
  };

  const handleDailyDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDailyData({...dailyData, [e.target.name]: e.target.value});
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileName(e.target.files[0].name);
    } else {
      setFileName('');
    }
  };

  const handleNewMemberChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setNewMemberData({...newMemberData, [e.target.name]: e.target.value});
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
    if (window.confirm(`"${name}" adlı üyeyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) {
      try {
        await axios.delete(`${API_URL}/members/${id}`);
        await fetchData();
      } catch (err: any) {
        alert('Silinemedi: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  const handleNewSponsorChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setNewSponsorData({...newSponsorData, [e.target.name]: e.target.value});
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
        Next_Payment_Date: nextDate,
        Created_By: currentUser.username
      });
      await fetchData();
      setShowAddSponsor(false);
      setNewSponsorData({ Name: '', Surname: '', Company: '', Phone: '', Email: '', Amount: '', Payment_Period: 'monthly', Last_Payment_Date: '', Next_Payment_Date: '', Notes: '' });
    } catch (err: any) {
      alert('Hata: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteSponsor = async (id: number) => {
    if (window.confirm('Bu sponsoru silmek istediğinize emin misiniz?')) {
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
      alert('Hata: ' + (err.response?.data?.error || err.message));
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
    if (window.confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) {
      await axios.delete(`${API_URL}/users/${id}`);
      fetchData();
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    if (window.confirm('Bu finansal işlemi geri almak (silmek) istediğinize emin misiniz? Bu işlem kalıcıdır.')) {
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
      alert('\u00dcye ba\u015far\u0131yla eklendi ve aidat geliri otomatik olarak i\u015flendi.');
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

  const displayedMembers = showApproachingRenewal 
    ? members.filter((m: any) => {
        const { diffDays } = getAnniversaryData(m.Registration_Date);
        return diffDays >= 0 && diffDays <= 90; // Expires within next 3 months
      })
    : members;

  const pieData = {
    labels: ['Giriş', 'Mutfak', 'Büfe'],
    datasets: [{
      data: [
        dashboardStats.revenueDistribution['Giriş'] || 0,
        dashboardStats.revenueDistribution['Mutfak'] || 0,
        dashboardStats.revenueDistribution['Büfe'] || 0
      ],
      backgroundColor: ['#8A0304', '#FFB612', '#4CAF50'],
      borderColor: '#1E1E1E',
      borderWidth: 2,
    }]
  };

  const currentMonthBarData = {
    labels: ['Bu Ay'],
    datasets: [
      {
        label: 'Aylık Günlük Gelir',
        data: [dashboardStats.currentMonth.DailyIncome],
        backgroundColor: 'rgba(76, 175, 80, 0.8)',
      },
      {
        label: 'Üyelik Geliri',
        data: [dashboardStats.currentMonth.MembershipIncome],
        backgroundColor: 'rgba(255, 182, 18, 0.8)',
      },
      {
        label: 'Gider',
        data: [dashboardStats.currentMonth.Expense],
        backgroundColor: 'rgba(138, 3, 4, 0.8)',
      }
    ]
  };

  if (!currentUser) {
    return (
      <div className="login-container">
        <div className="login-box">
          <div className="login-logo">
             <img src="/logo.jpg" alt="Galatasaray Stuttgart" className="logo-gs-large-img" />
             <h2>Stuttgart Galatasaraylılar Derneği</h2>
             <p>Yönetici Paneli</p>
          </div>
          <form className="login-form" onSubmit={handleLogin}>
            {loginError && <div className="login-error">{loginError}</div>}
            <div className="form-group">
              <label>Kullanıcı Adı</label>
              <div className="input-with-icon">
                <User size={18} color="#FFB612" />
                <input type="text" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} required />
              </div>
            </div>
            <div className="form-group">
              <label>Şifre</label>
              <div className="input-with-icon">
                <Lock size={18} color="#FFB612" />
                <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
              </div>
            </div>
            <button type="submit" className="huge-save-btn" style={{marginTop: '20px'}}>Giriş Yap</button>
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
            <h2>Stuttgart<br/><span>Dernek Yönetimi</span></h2>
          </div>
        </div>
        <nav className="sidebar-nav">
          <ul>
            <li className={activeTab === 'dashboard' ? 'active' : ''}>
              <button onClick={() => {setActiveTab('dashboard'); setShowAddMember(false);}}><PieChart size={18}/> Hızlı Bakış</button>
            </li>
            <li className={activeTab === 'members' ? 'active' : ''}>
              <button onClick={() => {setActiveTab('members'); setShowAddMember(false);}}><Users size={18}/> Üye Yönetimi</button>
            </li>
            <li className={activeTab === 'sponsors' ? 'active' : ''}>
              <button onClick={() => {setActiveTab('sponsors'); setShowAddMember(false);}}><Star size={18}/> Sponsorlar</button>
            </li>
            <li className={activeTab === 'financials' ? 'active' : ''}>
              <button onClick={() => {setActiveTab('financials'); setShowAddMember(false);}}><Plus size={18}/> Gün Sonu Kapatışı</button>
            </li>
            <li className={activeTab === 'financedetail' ? 'active' : ''}>
              <button onClick={() => {setActiveTab('financedetail'); setShowAddMember(false);}}><BarChart3 size={18}/> Finansal Rapor</button>
            </li>
            <li className={activeTab === 'archive' ? 'active' : ''}>
              <button onClick={() => {setActiveTab('archive'); setShowAddMember(false);}}><FolderOpen size={18}/> Dijital Arşiv</button>
            </li>
            {currentUser.role === 'admin' && (
              <li className={activeTab === 'users' ? 'active' : ''}>
                <button onClick={() => {setActiveTab('users'); setShowAddMember(false);}}><Settings size={18}/> Kullanıcı Yönetimi</button>
              </li>
            )}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <img src={`https://ui-avatars.com/api/?name=${currentUser.username}&background=8A0304&color=fff`} alt="User" />
            <div style={{flex: 1}}>
              <p>{currentUser.username}</p>
              <span>{currentUser.role === 'admin' ? 'Master Admin' : 'Staff'}</span>
            </div>
            <button className="icon-btn" onClick={handleLogout} title="Çıkış Yap"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {activeTab !== 'financials' && !showAddMember && (
          <header className="topbar">
            <div className="search-bar">
              <Search size={18} color="var(--text-secondary)" />
              <input type="text" placeholder="Ara..." />
            </div>
            <div className="topbar-actions">
              <button className="icon-btn" onClick={toggleTheme} title="Tema Değiştir">
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
              <button className="icon-btn" onClick={handleLogout} title="Çıkış Yap"><LogOut size={18} /></button>
            </div>
          </header>
        )}

        <div className={`content-wrapper ${(activeTab === 'financials' || showAddMember) ? 'no-padding-top' : ''}`}>
          
          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && !showAddMember && (
            <>
              <div className="page-header">
                <h1>Hızlı Bakış</h1>
              </div>
              <div className="summary-cards" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'16px'}}>
                <div className="card stat-card">
                  <div className="card-info">
                    <h3 style={{fontSize:'0.8rem', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'1px'}}><Users size={13} style={{display:'inline', marginRight:'4px'}}/>Toplam Üye</h3>
                    <h2 style={{fontSize:'2.2rem', color:'var(--secondary-color)', fontWeight:'800', marginTop:'8px'}}>{summary.totalMembers}</h2>
                  </div>
                </div>
                <div className="card stat-card" style={{background:'linear-gradient(135deg,rgba(76,175,80,0.15),rgba(76,175,80,0.05))', border:'1px solid rgba(76,175,80,0.3)'}}>
                  <div className="card-info">
                    <h3 style={{fontSize:'0.8rem', color:'var(--success)', textTransform:'uppercase', letterSpacing:'1px'}}><Receipt size={13} style={{display:'inline', marginRight:'4px'}}/>Aylık Satış Geliri</h3>
                    <h2 style={{fontSize:'2.2rem', color:'var(--success)', fontWeight:'800', marginTop:'8px'}}>€ {summary.monthlyDailyIncome.toFixed(2)}</h2>
                  </div>
                </div>
                <div className="card stat-card" style={{background:'linear-gradient(135deg,rgba(255,182,18,0.15),rgba(255,182,18,0.05))', border:'1px solid rgba(255,182,18,0.3)'}}>
                  <div className="card-info">
                    <h3 style={{fontSize:'0.8rem', color:'var(--secondary-color)', textTransform:'uppercase', letterSpacing:'1px'}}><CreditCard size={13} style={{display:'inline', marginRight:'4px'}}/>Aylık Üyelik Geliri</h3>
                    <h2 style={{fontSize:'2.2rem', color:'var(--secondary-color)', fontWeight:'800', marginTop:'8px'}}>€ {summary.monthlyMembershipIncome.toFixed(2)}</h2>
                  </div>
                </div>
                <div className="card stat-card red-card">
                  <div className="card-info">
                    <h3 style={{fontSize:'0.8rem', textTransform:'uppercase', letterSpacing:'1px'}}><DollarSign size={13} style={{display:'inline', marginRight:'4px'}}/>Bu Ayın Toplam Geliri</h3>
                    <h2 style={{fontSize:'2.2rem', fontWeight:'800', marginTop:'8px'}}>€ {(summary.monthlyDailyIncome + summary.monthlyMembershipIncome).toFixed(2)}</h2>
                  </div>
                </div>
                <div className="card stat-card highlight">
                  <div className="card-info">
                    <h3 style={{fontSize:'0.8rem', textTransform:'uppercase', letterSpacing:'1px'}}><Vault size={13} style={{display:'inline', marginRight:'4px'}}/>Net Kasa</h3>
                    <h2 style={{fontSize:'2.2rem', fontWeight:'800', marginTop:'8px'}}>€ {summary.netBalance.toFixed(2)}</h2>
                  </div>
                </div>
              </div>
              
              <div className="dashboard-grid" style={{marginTop: '24px'}}>
                <div className="card chart-card">
                  <div className="card-header">
                    <h3>Aylık Finansal Dağılım</h3>
                  </div>
                  <div style={{height: '250px', display: 'flex', justifyContent: 'center'}}>
                    <Bar data={currentMonthBarData} options={{maintainAspectRatio: false, responsive: true}} />
                  </div>
                </div>
                
                <div className="card table-card">
                  <div className="card-header">
                    <h3>Son İşlemler</h3>
                  </div>
                  <div className="table-responsive">
                    <table className="transactions-table">
                      <thead>
                        <tr><th>İşlem</th><th>Tarih</th><th>Tutar</th><th>Ekleyen</th></tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx: any) => (
                          <tr key={tx.id}>
                            <td>{tx.Category}</td>
                            <td style={{color: '#A0A0A0'}}>{tx.Date}</td>
                            <td className={tx.Type === 'Income' ? 'amount positive' : 'amount negative'}>
                              {tx.Type === 'Income' ? '+' : '-'}€ {tx.Amount}
                            </td>
                            <td style={{fontSize: '0.8rem', color: 'var(--secondary-color)', display: 'flex', alignItems: 'center', gap: '8px'}}>
                              {tx.Created_By}
                              {currentUser?.role === 'admin' && (
                                <button onClick={() => handleDeleteTransaction(tx.id)} title="Geri Al (Sil)" style={{background:'none', border:'none', color:'var(--danger)', cursor:'pointer'}}>
                                  <Trash2 size={14}/>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {transactions.length === 0 && <tr><td colSpan={4}>Henüz işlem yok</td></tr>}
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
                <div className="card-header"><h3>Kullanıcı Yönetimi</h3></div>
                <div className="table-responsive">
                  <table className="transactions-table">
                    <thead><tr><th>ID</th><th>Kullanıcı Adı</th><th>Rol</th><th>İşlem</th></tr></thead>
                    <tbody>
                      {systemUsers.map((u: any) => (
                        <tr key={u.id}>
                          <td>{u.id}</td>
                          <td>{u.username}</td>
                          <td>{u.role === 'admin' ? 'Master Admin' : 'Staff'}</td>
                          <td>
                            {u.role !== 'admin' && (
                              <button onClick={() => handleDeleteUser(u.id)} style={{color:'var(--danger)', background:'none', border:'none', cursor:'pointer'}}>Sil</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="card">
                <div className="card-header"><h3>Yeni Kullanıcı Ekle</h3></div>
                <form onSubmit={handleAddUser}>
                  <div className="input-group">
                    <label>Kullanıcı Adı</label>
                    <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} required className="amount-input-wrapper-small" style={{width:'100%', color:'white', background:'var(--surface-light)'}}/>
                  </div>
                  <div className="input-group">
                    <label>Şifre</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="amount-input-wrapper-small" style={{width:'100%', color:'white', background:'var(--surface-light)'}}/>
                  </div>
                  <div className="input-group">
                    <label>Rol</label>
                    <select value={newRole} onChange={e => setNewRole(e.target.value)} className="amount-input-wrapper-small" style={{width:'100%', color:'white', background:'var(--surface-light)'}}>
                      <option value="staff">Staff (Personel)</option>
                      <option value="admin">Master Admin</option>
                    </select>
                  </div>
                  <button type="submit" className="add-btn" style={{width:'100%', justifyContent:'center', marginTop:'16px'}}>Ekle</button>
                </form>
              </div>
            </div>
          )}

          {/* MEMBERS TAB */}
          {activeTab === 'members' && !showAddMember && (
            <div className="card">
              <div className="card-header" style={{display:'flex', flexDirection:'column', gap:'12px', alignItems:'stretch'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <h3 style={{margin:0}}>Üye Yönetimi</h3>
                  <button className="add-btn" onClick={() => setShowAddMember(true)}>
                    <UserPlus size={18}/> Yeni Üye
                  </button>
                </div>
                <button 
                  className={`filter-btn ${showApproachingRenewal ? 'active' : ''}`}
                  onClick={() => setShowApproachingRenewal(!showApproachingRenewal)}
                  style={{width:'100%', justifyContent:'center'}}
                >
                  <Bell size={14} style={{display:'inline', marginRight:'4px'}}/>
                  Yenilemesi Yaklaşanlar (Son 3 Ay)
                </button>
              </div>
              <div className="table-responsive">
                <table className="transactions-table">
                  <thead><tr><th>İsim Soyisim</th><th>Üyelik Tipi</th><th>Üyelik Tarihi</th><th>Gelecek Ödeme</th><th>Durum</th><th></th></tr></thead>
                  <tbody>
                   {displayedMembers.map((m: any) => {
                      const ann = getAnniversaryData(m.Registration_Date);
                      const isExpired = ann.diffDays < 0;
                      const isWarning = ann.diffDays >= 0 && ann.diffDays <= 90;
                      return (
                        <tr key={m.id}>
                          <td style={{fontWeight: '500'}}>{m.Name} {m.Surname}</td>
                          <td>{m.Member_Type || 'Normal'}</td>
                          <td style={{color:'var(--text-secondary)', fontSize:'0.85rem'}}>{m.Registration_Date || '-'}</td>
                          <td style={{color: isExpired ? 'var(--danger)' : 'inherit'}}>
                            {ann.nextPayment}
                            {isExpired && <span className="expired-warning" style={{marginLeft: '8px'}}>Süresi Doldu</span>}
                            {isWarning && <span className="due-date-warning" style={{marginLeft: '8px'}}>Yaklaşıyor</span>}
                          </td>
                          <td><span style={{color: m.Status==='Active' ? 'var(--success)' : 'var(--danger)'}}>{m.Status === 'Active' ? 'Aktif' : 'Pasif'}</span></td>
                          <td style={{display:'flex', gap:'4px', alignItems:'center'}}>
                            <button onClick={() => { setEditingMember(m); setEditMemberData({...m}); }} title="Düzenle" style={{background:'none',border:'none',color:'var(--secondary-color)',cursor:'pointer',padding:'4px'}}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            {currentUser?.role === 'admin' && (
                              <button onClick={() => handleDeleteMember(m.id, m.Name + ' ' + m.Surname)} title="Üyeyi Sil" style={{background:'none',border:'none',color:'var(--danger)',cursor:'pointer',padding:'4px'}}>
                                <Trash2 size={15}/>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {displayedMembers.length === 0 && <tr><td colSpan={6}>Kayıt bulunamadı</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ADD MEMBER FORM (Mobile Friendly) */}
          {showAddMember && (
            <div className="mobile-entry-container">
               <div className="mobile-header" style={{display:'flex', alignItems:'center', padding:'24px 16px', gap:'16px'}}>
                 <button onClick={() => setShowAddMember(false)} style={{background:'none', border:'none', color:'var(--text-secondary)'}}><ArrowLeft size={28}/></button>
                 <h2 style={{flex:1, textAlign:'left'}}>Yeni Üye Kaydı</h2>
               </div>
               <form className="mobile-entry-form" onSubmit={handleAddMemberSubmit}>
                  <div className="daily-section">
                     <div className="input-group">
                       <label>Ad</label>
                       <input type="text" name="Name" value={newMemberData.Name} onChange={handleNewMemberChange} required className="amount-input-wrapper-small amount-input-small" style={{width:'100%', background:'var(--surface-light)'}} placeholder="Üye Adı" />
                     </div>
                     <div className="input-group">
                       <label>Soyad</label>
                       <input type="text" name="Surname" value={newMemberData.Surname} onChange={handleNewMemberChange} required className="amount-input-wrapper-small amount-input-small" style={{width:'100%', background:'var(--surface-light)'}} placeholder="Üye Soyadı" />
                     </div>
                     <div className="input-group">
                       <label>Adres</label>
                       <input type="text" name="Address" value={newMemberData.Address} onChange={handleNewMemberChange} className="amount-input-wrapper-small amount-input-small" style={{width:'100%', background:'var(--surface-light)'}} placeholder="Örn: Königstr. 1, Stuttgart" />
                     </div>
                     <div className="input-group">
                       <label>Telefon</label>
                       <input type="tel" name="Phone" value={newMemberData.Phone} onChange={handleNewMemberChange} className="amount-input-wrapper-small amount-input-small" style={{width:'100%', background:'var(--surface-light)'}} placeholder="+49..." />
                     </div>
                     <div className="input-group">
                       <label>E-Posta</label>
                       <input type="email" name="Email" value={newMemberData.Email} onChange={handleNewMemberChange} className="amount-input-wrapper-small amount-input-small" style={{width:'100%', background:'var(--surface-light)'}} placeholder="eposta@adres.com" />
                     </div>
                     <div className="input-group">
                       <label>Banka Adı</label>
                       <input type="text" name="Bank_Name" value={newMemberData.Bank_Name} onChange={handleNewMemberChange} className="amount-input-wrapper-small amount-input-small" style={{width:'100%', background:'var(--surface-light)'}} placeholder="Sparkasse vb." />
                     </div>
                     <div className="input-group">
                       <label>IBAN</label>
                       <input type="text" name="IBAN" value={newMemberData.IBAN} onChange={handleNewMemberChange} className="amount-input-wrapper-small amount-input-small" style={{width:'100%', background:'var(--surface-light)', fontFamily:'monospace'}} placeholder="DE..." />
                     </div>
                     <div className="input-group">
                       <label>Üyelik Tipi (Seçiniz)</label>
                       <select name="Member_Type" value={newMemberData.Member_Type} onChange={handleNewMemberChange} className="amount-input-wrapper-small amount-input-small" style={{width:'100%', background:'var(--surface-light)'}}>
                         <option value="Normal">Normal (€120)</option>
                         <option value="Kadın">Kadın (€70)</option>
                         <option value="Öğrenci/Emekli">Öğrenci/Emekli (€50)</option>
                       </select>
                     </div>
                     <div className="input-group">
                       <label style={{color:'#FFB612'}}><Calendar size={14} style={{display:'inline',marginRight:'4px'}}/>Üyelik Başlangıç Tarihi</label>
                       <input type="date" name="Registration_Date" value={newMemberData.Registration_Date} onChange={handleNewMemberChange} className="amount-input-wrapper-small" style={{width:'100%', background:'var(--surface-light)', color:'white', border:'1px solid var(--secondary-color)'}} />
                       <span style={{fontSize:'0.75rem', color:'var(--text-secondary)', marginTop:'4px', display:'block'}}>Boş bırakırsanız bugünün tarihi kaydedilir.</span>
                     </div>
                  </div>
                  <div style={{padding: '0 16px', color: 'var(--text-secondary)', fontSize: '0.85rem'}}>
                    * Kayıt yapıldığında seçilen üyelik tipi ücreti "Üyelik Aidatı" olarak Gelirler tablosuna otomatik yansıyacaktır.
                  </div>
                  <div className="sticky-bottom-action">
                    <button type="submit" className="huge-save-btn" disabled={isSubmitting}>
                      {isSubmitting ? 'Kaydediliyor...' : 'Üyeyi Kaydet'}
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
                  <h2>Gün Sonu Kaydedildi!</h2>
                </div>
              ) : (
                <>
                  <div className="mobile-header">
                    <h2>Gün Sonu Kapanışı</h2>
                  </div>
                  <form className="mobile-entry-form" onSubmit={handleDailySubmit}>
                    <div className="daily-section">
                      <div className="input-group" style={{marginBottom: '20px'}}>
                        <label style={{color: '#FFB612'}}>Kapanış Tarihi (Geçmişe dönük kayıt için)</label>
                        <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="amount-input-wrapper-small" style={{width:'100%', background:'var(--surface-light)', color:'white', border:'1px solid var(--secondary-color)'}} />
                        <span style={{fontSize:'0.75rem', color:'var(--text-secondary)', marginTop:'4px', display:'block'}}>Boş bırakırsanız bugünün tarihi kaydedilir.</span>
                      </div>
                      <h3 className="section-title income-title"><TrendingUp size={20}/> Kasa Gelirleri (Aidatlar Hariç)</h3>
                      <div className="input-group">
                        <label>Giriş Hasılatı</label>
                        <div className="amount-input-wrapper-small"><span className="currency-symbol-small">€</span><input type="number" step="0.01" name="incomeEntry" value={dailyData.incomeEntry} onChange={handleDailyDataChange} className="amount-input-small" placeholder="0.00" /></div>
                      </div>
                      <div className="input-group">
                        <label>Mutfak Hasılatı</label>
                        <div className="amount-input-wrapper-small"><span className="currency-symbol-small">€</span><input type="number" step="0.01" name="incomeKitchen" value={dailyData.incomeKitchen} onChange={handleDailyDataChange} className="amount-input-small" placeholder="0.00" /></div>
                      </div>
                      <div className="input-group">
                        <label>Büfe Hasılatı</label>
                        <div className="amount-input-wrapper-small"><span className="currency-symbol-small">€</span><input type="number" step="0.01" name="incomeBuffet" value={dailyData.incomeBuffet} onChange={handleDailyDataChange} className="amount-input-small" placeholder="0.00" /></div>
                      </div>
                    </div>
                    <div className="daily-section">
                      <h3 className="section-title expense-title"><TrendingDown size={20}/> Giderler</h3>
                      <div className="input-group">
                        <label>Kira (Aylık/Günlük)</label>
                        <div className="amount-input-wrapper-small"><span className="currency-symbol-small">€</span><input type="number" step="0.01" name="expenseRent" value={dailyData.expenseRent} onChange={handleDailyDataChange} className="amount-input-small" placeholder="0.00" /></div>
                      </div>
                      <div className="input-group">
                        <label>Malzeme Gideri</label>
                        <div className="amount-input-wrapper-small"><span className="currency-symbol-small">€</span><input type="number" step="0.01" name="expenseSupplies" value={dailyData.expenseSupplies} onChange={handleDailyDataChange} className="amount-input-small" placeholder="0.00" /></div>
                      </div>
                    </div>
                    <div className="daily-profit-card">
                       <h4>Net Kasa Durumu</h4>
                       <h1 className={dailyProfit >= 0 ? 'positive' : 'negative'}>{dailyProfit >= 0 ? '+' : ''}€ {dailyProfit.toFixed(2)}</h1>
                    </div>
                    <div className="camera-section">
                      <input type="file" id="receipt-upload" name="receipt" accept="image/*" capture="environment" className="hidden-file-input" ref={fileInputRef} onChange={handleFileChange} />
                      <label htmlFor="receipt-upload" className={`camera-btn ${fileName ? 'has-file' : ''}`}>
                        <Camera size={48} className="camera-icon" />
                        <div className="camera-text">
                          <span className="main-text">{fileName ? 'Fotoğraf Seçildi' : 'Fiş / Fatura / Çentik Çek'}</span>
                          <span className="sub-text">{fileName ? fileName : 'Çentikleri taramak için dokunun'}</span>
                        </div>
                      </label>
                    </div>
                    <div className="sticky-bottom-action">
                      <button type="submit" className="huge-save-btn" disabled={isSubmitting}>
                        {isSubmitting ? 'Kaydediliyor...' : 'Günü Kapat & Kaydet'}
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
              <div className="page-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h1>Sponsorlar</h1>
                <button className="add-btn" onClick={() => setShowAddSponsor(true)}><Plus size={16}/> Yeni Sponsor</button>
              </div>
              <div className="card" style={{marginBottom:'20px'}}>
                <div className="card-header"><h3><Star size={16} style={{display:'inline',marginRight:'6px',color:'var(--secondary-color)'}}/>Sponsor Listesi</h3></div>
                <div className="table-responsive">
                  <table className="transactions-table">
                    <thead><tr><th>Ad Soyad / Şirket</th><th>Ücret</th><th>Ödeme Dönemi</th><th>Son Ödeme</th><th>Sonraki Ödeme</th><th>Durum</th><th></th></tr></thead>
                    <tbody>
                      {sponsors.map((s: any) => {
                        const nextD = new Date(s.Next_Payment_Date);
                        const today = new Date();
                        const diffDays = Math.ceil((nextD.getTime() - today.getTime()) / 86400000);
                        const isOverdue = diffDays < 0;
                        const isSoon = diffDays >= 0 && diffDays <= 30;
                        const periodLabel: Record<string,string> = { monthly:'Aylık', quarterly:'3 Aylık', 'semi-annual':'6 Aylık', annual:'Yıllık', custom4:'4 Aylık', custom5:'5 Aylık' };
                        return (
                          <tr key={s.id}>
                            <td style={{fontWeight:'600'}}>{s.Name} {s.Surname}{s.Company ? <span style={{display:'block',fontSize:'0.78rem',color:'var(--text-secondary)'}}>{s.Company}</span> : null}</td>
                            <td style={{color:'var(--secondary-color)',fontWeight:'700'}}>€ {parseFloat(s.Amount).toFixed(2)}</td>
                            <td><span style={{background:'rgba(255,182,18,0.12)',color:'var(--secondary-color)',padding:'3px 10px',borderRadius:'20px',fontSize:'0.8rem'}}>{periodLabel[s.Payment_Period] || s.Payment_Period}</span></td>
                            <td style={{color:'var(--text-secondary)',fontSize:'0.85rem'}}>{s.Last_Payment_Date}</td>
                            <td style={{color: isOverdue ? 'var(--danger)' : isSoon ? 'var(--secondary-color)' : 'inherit', fontWeight: isOverdue || isSoon ? '700' : 'normal'}}>
                              {s.Next_Payment_Date}
                              {isOverdue && <span className="expired-warning" style={{marginLeft:'6px'}}>Gecikti</span>}
                              {isSoon && !isOverdue && <span className="due-date-warning" style={{marginLeft:'6px'}}>Yakın</span>}
                            </td>
                            <td><span style={{color: s.Status === 'Active' ? 'var(--success)' : 'var(--danger)'}}>{s.Status === 'Active' ? 'Aktif' : 'Pasif'}</span></td>
                            <td style={{display:'flex',gap:'4px',alignItems:'center'}}>
                              <button onClick={() => { setEditingSponsor(s); setEditSponsorData({...s}); }} title="Düzenle" style={{background:'none',border:'none',color:'var(--secondary-color)',cursor:'pointer',padding:'4px'}}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              {currentUser?.role === 'admin' && <button onClick={() => handleDeleteSponsor(s.id)} style={{background:'none',border:'none',color:'var(--danger)',cursor:'pointer',padding:'4px'}}><Trash2 size={15}/></button>}
                            </td>
                          </tr>
                        );
                      })}
                      {sponsors.length === 0 && <tr><td colSpan={7} style={{textAlign:'center',color:'var(--text-secondary)'}}>Henüz sponsor eklenmemiş</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* FINANCE DETAIL TAB */}
          {activeTab === 'financedetail' && !showAddMember && (
            <>
              <div className="page-header"><h1>Finansal Rapor</h1><p style={{color:'var(--text-secondary)',marginTop:'4px'}}>Detaylı gelir-gider analizi ve kayıtlar</p></div>

              {/* TOP KPI CARDS */}
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))', gap:'14px', marginBottom:'24px'}}>
                {[
                  { label:'Bu Ay Satış', value: financeStats.monthly.salesIncome, color:'#4CAF50', icon:'🛒' },
                  { label:'Bu Ay Üyelik', value: financeStats.monthly.membershipIncome, color:'#FFB612', icon:'👥' },
                  { label:'Bu Ay Sponsor', value: financeStats.monthly.sponsorIncome, color:'#9C27B0', icon:'⭐' },
                  { label:'Bu Ay Toplam', value: financeStats.monthly.totalIncome, color:'#2196F3', icon:'📈' },
                  { label:'Bu Ay Gider', value: financeStats.monthly.expense, color:'#F44336', icon:'📉' },
                  { label:'Bu Ay Net', value: financeStats.monthly.net, color: financeStats.monthly.net>=0 ? '#4CAF50':'#F44336', icon:'💰' },
                ].map((item, i) => (
                  <div key={i} className="card" style={{borderTop:`3px solid ${item.color}`, padding:'16px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                      <span style={{fontSize:'1.4rem'}}>{item.icon}</span>
                      <span style={{fontSize:'0.7rem',color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'0.5px',textAlign:'right'}}>{item.label}</span>
                    </div>
                    <p style={{fontSize:'1.6rem',fontWeight:'800',color:item.color,marginTop:'8px'}}>€ {item.value.toFixed(2)}</p>
                  </div>
                ))}
              </div>

              {/* INCOME BREAKDOWN BAR */}
              <div className="card" style={{marginBottom:'20px',padding:'20px'}}>
                <h3 style={{marginBottom:'16px',fontSize:'0.9rem',color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'1px'}}>Bu Ay Gelir Dağılımı</h3>
                {(() => {
                  const total = financeStats.monthly.totalIncome || 1;
                  const items = [
                    { label:'Satış Gelirleri', value: financeStats.monthly.salesIncome, color:'#4CAF50' },
                    { label:'Üyelik Aidatları', value: financeStats.monthly.membershipIncome, color:'#FFB612' },
                    { label:'Sponsor Gelirleri', value: financeStats.monthly.sponsorIncome, color:'#9C27B0' },
                  ];
                  return (
                    <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                      {items.map((it,i) => (
                        <div key={i}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                            <span style={{fontSize:'0.85rem',color:'var(--text-secondary)'}}>{it.label}</span>
                            <span style={{fontSize:'0.85rem',fontWeight:'700',color:it.color}}>€ {it.value.toFixed(2)} ({((it.value/total)*100).toFixed(1)}%)</span>
                          </div>
                          <div style={{background:'var(--surface-light)',borderRadius:'8px',height:'8px',overflow:'hidden'}}>
                            <div style={{width:`${(it.value/total)*100}%`,height:'100%',background:it.color,borderRadius:'8px',transition:'width 0.6s ease'}}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* SPONSOR BOX */}
              <div className="card" style={{marginBottom:'20px', background:'linear-gradient(135deg,rgba(156,39,176,0.1),rgba(103,58,183,0.05))', border:'1px solid rgba(156,39,176,0.3)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'12px'}}>
                  <div>
                    <h3 style={{color:'#CE93D8',fontSize:'0.8rem',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'4px'}}>⭐ Aktif Sponsor Durumu</h3>
                    <p style={{fontSize:'2rem',fontWeight:'800',color:'#9C27B0'}}>{financeStats.activeSponsorCount} Sponsor</p>
                    <p style={{fontSize:'0.85rem',color:'var(--text-secondary)'}}>Aylık eşdeğer: <strong style={{color:'#CE93D8'}}>€ {(financeStats.totalActiveSponsorMonthly||0).toFixed(2)}</strong></p>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <p style={{fontSize:'0.8rem',color:'var(--text-secondary)'}}>Bu Ay Sponsor Geliri</p>
                    <p style={{fontSize:'1.8rem',fontWeight:'800',color:'#9C27B0'}}>€ {financeStats.monthly.sponsorIncome.toFixed(2)}</p>
                    <p style={{fontSize:'0.8rem',color:'var(--text-secondary)'}}>Bu Yıl Sponsor Geliri</p>
                    <p style={{fontSize:'1.3rem',fontWeight:'700',color:'#BA68C8'}}>€ {financeStats.yearly.sponsorIncome.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* YEARLY + ALL TIME */}
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'20px'}}>
                <div className="card">
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'16px'}}>
                    <span style={{fontSize:'1.2rem'}}>📅</span>
                    <h3 style={{fontSize:'0.85rem',color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'1px'}}>Bu Yıl ({new Date().getFullYear()})</h3>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                    {[
                      {l:'Satış Geliri', v:financeStats.yearly.salesIncome, c:'#4CAF50'},
                      {l:'Üyelik Geliri', v:financeStats.yearly.membershipIncome, c:'#FFB612'},
                      {l:'Sponsor Geliri', v:financeStats.yearly.sponsorIncome, c:'#9C27B0'},
                    ].map((r,i) => <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{color:'var(--text-secondary)',fontSize:'0.85rem'}}>{r.l}</span><strong style={{color:r.c}}>€ {r.v.toFixed(2)}</strong></div>)}
                    <div style={{height:'1px',background:'var(--border-color)',margin:'4px 0'}}/>
                    <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--text-secondary)',fontSize:'0.85rem'}}>Toplam Gelir</span><strong style={{color:'#2196F3'}}>€ {financeStats.yearly.totalIncome.toFixed(2)}</strong></div>
                    <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--text-secondary)',fontSize:'0.85rem'}}>Toplam Gider</span><strong style={{color:'#F44336'}}>€ {financeStats.yearly.expense.toFixed(2)}</strong></div>
                    <div style={{height:'1px',background:'var(--border-color)',margin:'4px 0'}}/>
                    <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontWeight:'600'}}>Net Bakiye</span><strong style={{color:financeStats.yearly.net>=0?'#4CAF50':'#F44336',fontSize:'1.1rem'}}>€ {financeStats.yearly.net.toFixed(2)}</strong></div>
                  </div>
                </div>
                <div className="card">
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'16px'}}>
                    <span style={{fontSize:'1.2rem'}}>🏛️</span>
                    <h3 style={{fontSize:'0.85rem',color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'1px'}}>Tüm Zamanlar</h3>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                    <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--text-secondary)',fontSize:'0.85rem'}}>Toplam Gelir (Kasa)</span><strong style={{color:'#4CAF50'}}>€ {financeStats.allTime.totalIncome.toFixed(2)}</strong></div>
                    <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--text-secondary)',fontSize:'0.85rem'}}>Sponsor Gelirleri</span><strong style={{color:'#9C27B0'}}>€ {financeStats.allTime.totalSponsorIncome.toFixed(2)}</strong></div>
                    <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--text-secondary)',fontSize:'0.85rem'}}>Toplam Gider</span><strong style={{color:'#F44336'}}>€ {financeStats.allTime.totalExpense.toFixed(2)}</strong></div>
                    <div style={{height:'1px',background:'var(--border-color)',margin:'4px 0'}}/>
                    <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontWeight:'600'}}>Net Kasa Bakiyesi</span><strong style={{color:financeStats.allTime.netBalance>=0?'#4CAF50':'#F44336',fontSize:'1.2rem'}}>€ {financeStats.allTime.netBalance.toFixed(2)}</strong></div>
                  </div>
                </div>
              </div>

              {/* MONTHLY HISTORY CHART */}
              {financeStats.monthlyHistory.length > 0 && (
                <div className="card" style={{marginBottom:'20px'}}>
                  <div className="card-header"><h3>Son 6 Ay Karşılaştırma</h3></div>
                  <div style={{height:'280px'}}>
                    <Bar options={{
                      maintainAspectRatio:false, responsive:true,
                      plugins:{legend:{position:'top',labels:{color:'var(--text-secondary)',boxWidth:12}}},
                      scales:{x:{ticks:{color:'var(--text-secondary)'},grid:{color:'rgba(255,255,255,0.05)'}},y:{ticks:{color:'var(--text-secondary)',callback:(v:any)=>`€${v}`},grid:{color:'rgba(255,255,255,0.05)'}}}
                    }} data={{
                      labels: financeStats.monthlyHistory.map((m:any) => m.month),
                      datasets: [
                        {label:'Satış',data:financeStats.monthlyHistory.map((m:any)=>m.sales),backgroundColor:'rgba(76,175,80,0.75)',borderRadius:4},
                        {label:'Üyelik',data:financeStats.monthlyHistory.map((m:any)=>m.membership),backgroundColor:'rgba(255,182,18,0.75)',borderRadius:4},
                        {label:'Sponsor',data:financeStats.monthlyHistory.map((m:any)=>m.sponsor),backgroundColor:'rgba(156,39,176,0.75)',borderRadius:4},
                        {label:'Gider',data:financeStats.monthlyHistory.map((m:any)=>m.expense),backgroundColor:'rgba(244,67,54,0.75)',borderRadius:4},
                      ]
                    }}/>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ARCHIVE TAB */}
          {activeTab === 'archive' && !showAddMember && (
            <div className="card">
              <div className="card-header"><h3>Dijital Arşiv (Çentikler)</h3></div>
              <div className="archive-list">
                {archiveData.map((archive: any, index) => (
                  <div key={index} className="archive-item" onClick={() => setSelectedArchive(archive)}>
                    <div>
                      <div className="archive-date"><FileText size={16} style={{display:'inline', marginRight:'8px'}}/> {archive.Date} Kapanışı</div>
                      <div className="archive-summary">
                        Gelir: <span className="positive">€{archive.Daily_Income}</span> | 
                        Gider: <span className="negative">€{archive.Daily_Expense}</span>
                        <div style={{marginTop: '4px', fontSize: '0.8rem', color: 'var(--secondary-color)'}}>Ekleyen: {archive.Created_By}</div>
                      </div>
                    </div>
                    {archive.File_Path && <Camera size={20} color="#FFB612"/>}
                  </div>
                ))}
                {archiveData.length === 0 && <p style={{color:'var(--text-secondary)'}}>Henüz arşivlenmiş gün sonu kapanışı bulunmuyor.</p>}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Mobile Nav */}
      <nav className="mobile-nav">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => {setActiveTab('dashboard'); setShowAddMember(false);}}><PieChart size={22}/><span>Ana Sayfa</span></button>
        <button className={activeTab === 'members' ? 'active' : ''} onClick={() => {setActiveTab('members'); setShowAddMember(false);}}><Users size={22}/><span>Üyeler</span></button>
        <button onClick={() => {setActiveTab('financials'); setShowAddMember(false);}}>
          <div className="add-circle-nav">
            <Plus size={28}/>
          </div>
        </button>
        <button className={activeTab === 'sponsors' ? 'active' : ''} onClick={() => {setActiveTab('sponsors'); setShowAddMember(false);}}><Star size={22}/><span>Sponsor</span></button>
        <button className={activeTab === 'financedetail' ? 'active' : ''} onClick={() => {setActiveTab('financedetail'); setShowAddMember(false);}}><BarChart3 size={22}/><span>Rapor</span></button>
      </nav>

      {/* ADD SPONSOR MODAL */}
      {showAddSponsor && (
        <div className="modal-overlay" onClick={() => setShowAddSponsor(false)}>
          <div className="modal-content" style={{maxWidth:'520px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Star size={18} style={{display:'inline',marginRight:'8px',color:'var(--secondary-color)'}}/>Yeni Sponsor Ekle</h3>
              <button className="modal-close" onClick={() => setShowAddSponsor(false)}><X size={24}/></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAddSponsorSubmit} style={{display:'flex',flexDirection:'column',gap:'14px'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                  <div className="input-group" style={{margin:0}}>
                    <label>Ad *</label>
                    <input type="text" name="Name" value={newSponsorData.Name} onChange={handleNewSponsorChange} required className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}} placeholder="Ad"/>
                  </div>
                  <div className="input-group" style={{margin:0}}>
                    <label>Soyad</label>
                    <input type="text" name="Surname" value={newSponsorData.Surname} onChange={handleNewSponsorChange} className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}} placeholder="Soyad"/>
                  </div>
                </div>
                <div className="input-group" style={{margin:0}}>
                  <label>Şirket / Kurum</label>
                  <input type="text" name="Company" value={newSponsorData.Company} onChange={handleNewSponsorChange} className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}} placeholder="Şirket adı"/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                  <div className="input-group" style={{margin:0}}>
                    <label>Telefon</label>
                    <input type="tel" name="Phone" value={newSponsorData.Phone} onChange={handleNewSponsorChange} className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}} placeholder="+49..."/>
                  </div>
                  <div className="input-group" style={{margin:0}}>
                    <label>E-Posta</label>
                    <input type="email" name="Email" value={newSponsorData.Email} onChange={handleNewSponsorChange} className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}} placeholder="eposta@..."/>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                  <div className="input-group" style={{margin:0}}>
                    <label style={{color:'var(--secondary-color)'}}>Ücret (€) *</label>
                    <input type="number" step="0.01" name="Amount" value={newSponsorData.Amount} onChange={handleNewSponsorChange} required className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}} placeholder="0.00"/>
                  </div>
                  <div className="input-group" style={{margin:0}}>
                    <label style={{color:'var(--secondary-color)'}}>Ödeme Dönemi *</label>
                    <select name="Payment_Period" value={newSponsorData.Payment_Period} onChange={handleNewSponsorChange} className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}}>
                      <option value="monthly">Aylık</option>
                      <option value="quarterly">3 Aylık</option>
                      <option value="custom4">4 Aylık</option>
                      <option value="custom5">5 Aylık</option>
                      <option value="semi-annual">6 Aylık</option>
                      <option value="annual">Yıllık</option>
                    </select>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                  <div className="input-group" style={{margin:0}}>
                    <label>Son Ödeme Tarihi *</label>
                    <input type="date" name="Last_Payment_Date" value={newSponsorData.Last_Payment_Date} onChange={handleNewSponsorChange} required className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)',border:'1px solid var(--secondary-color)'}}/>
                  </div>
                  <div className="input-group" style={{margin:0}}>
                    <label>Sonraki Ödeme <span style={{fontSize:'0.7rem',color:'var(--text-secondary)'}}>(boş=otomatik)</span></label>
                    <input type="date" name="Next_Payment_Date" value={newSponsorData.Next_Payment_Date} onChange={handleNewSponsorChange} className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)',border:'1px solid var(--border-color)'}}/>
                  </div>
                </div>
                <div className="input-group" style={{margin:0}}>
                  <label>Notlar</label>
                  <textarea name="Notes" value={newSponsorData.Notes} onChange={handleNewSponsorChange} rows={2} style={{width:'100%',background:'var(--surface-light)',color:'white',border:'1px solid var(--border-color)',borderRadius:'12px',padding:'10px 14px',resize:'none',fontFamily:'Inter,sans-serif'}} placeholder="Sponsor hakkında notlar..."/>
                </div>
                <button type="submit" className="huge-save-btn" style={{marginTop:'8px',position:'static'}}>Sponsoru Kaydet</button>
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
              <h3>{selectedArchive.Date} Detayları</h3>
              <button className="modal-close" onClick={() => setSelectedArchive(null)}><X size={24}/></button>
            </div>
            <div className="modal-body">
              <div style={{marginBottom: '16px', color: 'var(--secondary-color)', fontWeight: 'bold'}}>Ekleyen: {selectedArchive.Created_By}</div>
              <table className="transactions-table" style={{marginBottom: '20px'}}>
                <thead><tr><th>Kategori</th><th>Tür</th><th>Tutar</th><th></th></tr></thead>
                <tbody>
                  {selectedArchive.Details.map((det: any, i: number) => (
                    <tr key={i}>
                      <td>{det.Category}</td>
                      <td>{det.Type === 'Income' ? 'Gelir' : 'Gider'}</td>
                      <td className={det.Type === 'Income' ? 'amount positive' : 'amount negative'}>€{det.Amount}</td>
                      <td style={{display:'flex',gap:'4px'}}>
                        {(currentUser?.role === 'admin' || currentUser?.username === selectedArchive.Created_By) && (
                          <button onClick={() => { setEditingTransaction(det); setEditTransactionData({Date: selectedArchive.Date, Type: det.Type, Category: det.Category, Amount: det.Amount, Notes: det.Notes || ''}); }} title="Düzenle" style={{background:'none',border:'none',color:'var(--secondary-color)',cursor:'pointer'}}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                        )}
                        {(currentUser?.role === 'admin' || currentUser?.username === selectedArchive.Created_By) && (
                          <button onClick={() => handleDeleteTransaction(det.id)} title="Geri Al (Sil)" style={{background:'none', border:'none', color:'var(--danger)', cursor:'pointer'}}>
                             <Trash2 size={14}/>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedArchive.File_Path && (
                <div>
                  <h4 style={{marginBottom: '8px', color: 'var(--text-secondary)'}}>Yüklenen Çentik:</h4>
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
          <div className="modal-content" style={{maxWidth:'520px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Üye Düzenle: {editingMember.Name} {editingMember.Surname}</h3>
              <button className="modal-close" onClick={() => { setEditingMember(null); setEditMemberData(null); }}><X size={24}/></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleEditMemberSave} style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                  <div className="input-group" style={{margin:0}}><label>Ad *</label><input type="text" value={editMemberData.Name} onChange={e => setEditMemberData({...editMemberData, Name: e.target.value})} required className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}}/></div>
                  <div className="input-group" style={{margin:0}}><label>Soyad *</label><input type="text" value={editMemberData.Surname} onChange={e => setEditMemberData({...editMemberData, Surname: e.target.value})} required className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}}/></div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                  <div className="input-group" style={{margin:0}}><label>Telefon</label><input type="tel" value={editMemberData.Phone||''} onChange={e => setEditMemberData({...editMemberData, Phone: e.target.value})} className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}}/></div>
                  <div className="input-group" style={{margin:0}}><label>E-Posta</label><input type="email" value={editMemberData.Email||''} onChange={e => setEditMemberData({...editMemberData, Email: e.target.value})} className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}}/></div>
                </div>
                <div className="input-group" style={{margin:0}}><label>Adres</label><input type="text" value={editMemberData.Address||''} onChange={e => setEditMemberData({...editMemberData, Address: e.target.value})} className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}}/></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                  <div className="input-group" style={{margin:0}}><label>Banka Adı</label><input type="text" value={editMemberData.Bank_Name||''} onChange={e => setEditMemberData({...editMemberData, Bank_Name: e.target.value})} className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}}/></div>
                  <div className="input-group" style={{margin:0}}><label>IBAN</label><input type="text" value={editMemberData.IBAN||''} onChange={e => setEditMemberData({...editMemberData, IBAN: e.target.value})} className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)',fontFamily:'monospace'}}/></div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                  <div className="input-group" style={{margin:0}}>
                    <label style={{color:'var(--secondary-color)'}}>Üyelik Tipi</label>
                    <select value={editMemberData.Member_Type} onChange={e => setEditMemberData({...editMemberData, Member_Type: e.target.value})} className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}}>
                      <option value="Normal">Normal (€120)</option>
                      <option value="Kadın">Kadın (€70)</option>
                      <option value="Öğrenci/Emekli">Öğrenci/Emekli (€50)</option>
                    </select>
                  </div>
                  <div className="input-group" style={{margin:0}}>
                    <label style={{color:'var(--secondary-color)'}}>Üyelik Başlangıç</label>
                    <input type="date" value={editMemberData.Registration_Date||''} onChange={e => setEditMemberData({...editMemberData, Registration_Date: e.target.value})} className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)',border:'1px solid var(--secondary-color)'}}/>
                  </div>
                </div>
                <div className="input-group" style={{margin:0}}>
                  <label>Durum</label>
                  <select value={editMemberData.Status} onChange={e => setEditMemberData({...editMemberData, Status: e.target.value})} className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}}>
                    <option value="Active">Aktif</option>
                    <option value="Passive">Pasif</option>
                  </select>
                </div>
                <div style={{display:'flex',gap:'12px',marginTop:'8px'}}>
                  <button type="button" onClick={() => { setEditingMember(null); setEditMemberData(null); }} style={{flex:1,padding:'12px',background:'var(--surface-light)',border:'1px solid var(--border-color)',borderRadius:'12px',color:'var(--text-secondary)',cursor:'pointer'}}>Vazgeç</button>
                  <button type="submit" className="add-btn" style={{flex:2,justifyContent:'center',padding:'12px'}}>Kaydet</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SPONSOR MODAL */}
      {editingSponsor && editSponsorData && (
        <div className="modal-overlay" onClick={() => { setEditingSponsor(null); setEditSponsorData(null); }}>
          <div className="modal-content" style={{maxWidth:'520px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Star size={18} style={{display:'inline',marginRight:'8px',color:'var(--secondary-color)'}}/> Sponsor Düzenle</h3>
              <button className="modal-close" onClick={() => { setEditingSponsor(null); setEditSponsorData(null); }}><X size={24}/></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleEditSponsorSave} style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                  <div className="input-group" style={{margin:0}}><label>Ad *</label><input type="text" value={editSponsorData.Name} onChange={e => setEditSponsorData({...editSponsorData, Name: e.target.value})} required className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}}/></div>
                  <div className="input-group" style={{margin:0}}><label>Soyad</label><input type="text" value={editSponsorData.Surname||''} onChange={e => setEditSponsorData({...editSponsorData, Surname: e.target.value})} className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}}/></div>
                </div>
                <div className="input-group" style={{margin:0}}><label>Şirket / Kurum</label><input type="text" value={editSponsorData.Company||''} onChange={e => setEditSponsorData({...editSponsorData, Company: e.target.value})} className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}}/></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                  <div className="input-group" style={{margin:0}}>
                    <label style={{color:'var(--secondary-color)'}}>Miktar (€) *</label>
                    <input type="number" step="0.01" value={editSponsorData.Amount} onChange={e => setEditSponsorData({...editSponsorData, Amount: e.target.value})} required className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}}/>
                  </div>
                  <div className="input-group" style={{margin:0}}>
                    <label style={{color:'var(--secondary-color)'}}>Dönem</label>
                    <select value={editSponsorData.Payment_Period} onChange={e => setEditSponsorData({...editSponsorData, Payment_Period: e.target.value})} className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}}>
                      <option value="monthly">Aylık</option>
                      <option value="quarterly">3 Aylık</option>
                      <option value="custom4">4 Aylık</option>
                      <option value="custom5">5 Aylık</option>
                      <option value="semi-annual">6 Aylık</option>
                      <option value="annual">Yıllık</option>
                    </select>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                  <div className="input-group" style={{margin:0}}><label>Son Ödeme *</label><input type="date" value={editSponsorData.Last_Payment_Date} onChange={e => setEditSponsorData({...editSponsorData, Last_Payment_Date: e.target.value})} required className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)',border:'1px solid var(--secondary-color)'}}/></div>
                  <div className="input-group" style={{margin:0}}><label>Sonraki Ödeme</label><input type="date" value={editSponsorData.Next_Payment_Date} onChange={e => setEditSponsorData({...editSponsorData, Next_Payment_Date: e.target.value})} className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}}/></div>
                </div>
                <div className="input-group" style={{margin:0}}>
                  <label>Durum</label>
                  <select value={editSponsorData.Status} onChange={e => setEditSponsorData({...editSponsorData, Status: e.target.value})} className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}}>
                    <option value="Active">Aktif</option>
                    <option value="Passive">Pasif</option>
                  </select>
                </div>
                <div className="input-group" style={{margin:0}}><label>Notlar</label><textarea value={editSponsorData.Notes||''} onChange={e => setEditSponsorData({...editSponsorData, Notes: e.target.value})} rows={2} style={{width:'100%',background:'var(--surface-light)',color:'white',border:'1px solid var(--border-color)',borderRadius:'12px',padding:'10px 14px',resize:'none',fontFamily:'Inter,sans-serif'}}/></div>
                <div style={{display:'flex',gap:'12px',marginTop:'8px'}}>
                  <button type="button" onClick={() => { setEditingSponsor(null); setEditSponsorData(null); }} style={{flex:1,padding:'12px',background:'var(--surface-light)',border:'1px solid var(--border-color)',borderRadius:'12px',color:'var(--text-secondary)',cursor:'pointer'}}>Vazgeç</button>
                  <button type="submit" className="add-btn" style={{flex:2,justifyContent:'center',padding:'12px'}}>Kaydet</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TRANSACTION MODAL */}
      {editingTransaction && editTransactionData && (
        <div className="modal-overlay" onClick={() => { setEditingTransaction(null); setEditTransactionData(null); }}>
          <div className="modal-content" style={{maxWidth:'420px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ İşlem Düzenle</h3>
              <button className="modal-close" onClick={() => { setEditingTransaction(null); setEditTransactionData(null); }}><X size={24}/></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleEditTransactionSave} style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                <div className="input-group" style={{margin:0}}>
                  <label>Tarih</label>
                  <input type="date" value={editTransactionData.Date} onChange={e => setEditTransactionData({...editTransactionData, Date: e.target.value})} required className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)',border:'1px solid var(--secondary-color)'}}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                  <div className="input-group" style={{margin:0}}>
                    <label>Tür</label>
                    <select value={editTransactionData.Type} onChange={e => setEditTransactionData({...editTransactionData, Type: e.target.value})} className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}}>
                      <option value="Income">Gelir</option>
                      <option value="Expense">Gider</option>
                    </select>
                  </div>
                  <div className="input-group" style={{margin:0}}>
                    <label>Kategori</label>
                    <input type="text" value={editTransactionData.Category} onChange={e => setEditTransactionData({...editTransactionData, Category: e.target.value})} required className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}}/>
                  </div>
                </div>
                <div className="input-group" style={{margin:0}}>
                  <label style={{color:'var(--secondary-color)'}}>Tutar (€)</label>
                  <input type="number" step="0.01" value={editTransactionData.Amount} onChange={e => setEditTransactionData({...editTransactionData, Amount: e.target.value})} required className="amount-input-wrapper-small" style={{width:'100%',color:'white',background:'var(--surface-light)'}}/>
                </div>
                <div className="input-group" style={{margin:0}}>
                  <label>Notlar</label>
                  <textarea value={editTransactionData.Notes||''} onChange={e => setEditTransactionData({...editTransactionData, Notes: e.target.value})} rows={2} style={{width:'100%',background:'var(--surface-light)',color:'white',border:'1px solid var(--border-color)',borderRadius:'12px',padding:'10px 14px',resize:'none',fontFamily:'Inter,sans-serif'}}/>
                </div>
                <div style={{display:'flex',gap:'12px',marginTop:'8px'}}>
                  <button type="button" onClick={() => { setEditingTransaction(null); setEditTransactionData(null); }} style={{flex:1,padding:'12px',background:'var(--surface-light)',border:'1px solid var(--border-color)',borderRadius:'12px',color:'var(--text-secondary)',cursor:'pointer'}}>Vazgeç</button>
                  <button type="submit" className="add-btn" style={{flex:2,justifyContent:'center',padding:'12px'}}>Kaydet</button>
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
