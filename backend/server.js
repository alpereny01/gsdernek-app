const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('crypto');

const app = express();
const port = 5000;

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// CORS - sadece kendi origin'e izin ver (local geliştirmede her yerden)
app.use(cors({
    origin: (origin, cb) => cb(null, true), // Local app, production'da kısıtlanabilir
    methods: ['GET','POST','PUT','DELETE'],
    allowedHeaders: ['Content-Type','Authorization']
}));

app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Login rate limiting - brute force koruması
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 20,
    message: { error: 'Çok fazla giriş denemesi. 15 dakika bekleyin.' },
    standardHeaders: true,
    legacyHeaders: false
});

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Multer - sadece resim, max 5MB
const ALLOWED_IMG_TYPES = ['image/jpeg','image/png','image/gif','image/webp'];
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + ext);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_IMG_TYPES.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Sadece resim dosyası yüklenebilir (JPEG/PNG/GIF/WEBP)'));
    }
});

// Token store (in-memory, production'da Redis kullanılır)
const activeSessions = new Map(); // token -> { userId, username, role, expires }

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function createSession(user) {
    const token = generateToken();
    const expires = Date.now() + (12 * 60 * 60 * 1000); // 12 saat
    activeSessions.set(token, { userId: user.id, username: user.username, role: user.role, expires });
    // Süresi dolmuş oturumları temizle
    for (const [t, s] of activeSessions.entries()) {
        if (s.expires < Date.now()) activeSessions.delete(t);
    }
    return token;
}

// Auth middleware
function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Oturum gerekli' });
    const session = activeSessions.get(token);
    if (!session || session.expires < Date.now()) {
        activeSessions.delete(token);
        return res.status(401).json({ error: 'Oturum süresi dolmuş, tekrar giriş yapın' });
    }
    req.user = session;
    next();
}

function requireAdmin(req, res, next) {
    requireAuth(req, res, () => {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Yönetici yetkisi gerekli' });
        next();
    });
}

function requireMasterAdmin(req, res, next) {
    requireAdmin(req, res, () => {
        if (req.user.username !== 'admin1905') return res.status(403).json({ error: 'Sadece master admin yapabilir' });
        next();
    });
}

const db = new sqlite3.Database('./dernek.db', (err) => {
    if (err) { console.error('DB Error:', err.message); return; }
    console.log('Connected to SQLite.');
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS Users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'staff')`);
        db.get("SELECT * FROM Users WHERE username='admin1905'", [], (e, row) => {
            if (!row) {
                // Admin yoksa bcrypt ile hashlenmiş şifre oluştur
                const hashed = bcrypt.hashSync('Sampiy10G4l4t4s4r4y!', 10);
                db.run("INSERT INTO Users (username,password,role) VALUES ('admin1905',?,'admin')", [hashed]);
            } else {
                // Eski plain-text şifreleri hash'e migrate et
                if (row.password && !row.password.startsWith('$2')) {
                    const hashed = bcrypt.hashSync(row.password, 10);
                    db.run("UPDATE Users SET password=? WHERE username='admin1905'", [hashed]);
                }
            }
        });
        // Diğer kullanıcıların plain-text şifrelerini migrate et
        db.all("SELECT id,password FROM Users WHERE username!='admin1905'", [], (e, rows) => {
            if (!rows) return;
            rows.forEach(u => {
                if (u.password && !u.password.startsWith('$2')) {
                    const hashed = bcrypt.hashSync(u.password, 10);
                    db.run("UPDATE Users SET password=? WHERE id=?", [hashed, u.id]);
                }
            });
        });
        db.run(`CREATE TABLE IF NOT EXISTS Members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            Name TEXT NOT NULL, Surname TEXT NOT NULL, Email TEXT, Phone TEXT,
            Registration_Date TEXT NOT NULL, Status TEXT NOT NULL DEFAULT 'Active',
            Address TEXT, Bank_Name TEXT, IBAN TEXT,
            Member_Type TEXT DEFAULT 'Normal', Created_By TEXT DEFAULT 'admin1905'
        )`, () => {
            ['Address','Bank_Name','IBAN','Member_Type','Created_By'].forEach(col =>
                db.run(`ALTER TABLE Members ADD COLUMN ${col} TEXT`, () => {}));
        });
        db.run(`CREATE TABLE IF NOT EXISTS Financials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            Date TEXT NOT NULL, Type TEXT NOT NULL, Category TEXT NOT NULL,
            Amount REAL NOT NULL, File_Path TEXT, Created_By TEXT DEFAULT 'admin1905', Notes TEXT
        )`, () => {
            db.run(`ALTER TABLE Financials ADD COLUMN Created_By TEXT DEFAULT 'admin1905'`, () => {});
            db.run(`ALTER TABLE Financials ADD COLUMN Notes TEXT`, () => {});
        });
        db.run(`CREATE TABLE IF NOT EXISTS Sponsors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            Name TEXT NOT NULL, Surname TEXT, Company TEXT, Phone TEXT, Email TEXT,
            Amount REAL NOT NULL, Payment_Period TEXT NOT NULL DEFAULT 'monthly',
            Last_Payment_Date TEXT NOT NULL, Next_Payment_Date TEXT NOT NULL,
            Notes TEXT, Status TEXT NOT NULL DEFAULT 'Active',
            Created_By TEXT DEFAULT 'admin1905', Created_At TEXT DEFAULT (date('now'))
        )`);
        db.run(`CREATE VIEW IF NOT EXISTS Monthly_Stats AS
            SELECT strftime('%Y-%m', Date) as Month,
                SUM(CASE WHEN Type='Income' THEN Amount ELSE 0 END) as Total_Income,
                SUM(CASE WHEN Type='Expense' THEN Amount ELSE 0 END) as Total_Expense
            FROM Financials GROUP BY strftime('%Y-%m', Date) ORDER BY Month DESC`);
    });
});

// Helper: calculate monthly equivalent income from a sponsor
function calcMonthlyEquiv(amount, period) {
    const map = { monthly: 1, quarterly: 3, 'custom4': 4, 'custom5': 5, 'semi-annual': 6, annual: 12 };
    return amount / (map[period] || 1);
}

// Helper: compute sponsor monthly income for a given YYYY-MM
function getSponsorMonthlyIncome(sponsors, yearMonth) {
    let total = 0;
    sponsors.forEach(s => {
        if (s.Status !== 'Active') return;
        // Check if Next_Payment_Date falls in this month OR Last_Payment_Date falls in this month
        const lastM = s.Last_Payment_Date ? s.Last_Payment_Date.slice(0, 7) : '';
        const nextM = s.Next_Payment_Date ? s.Next_Payment_Date.slice(0, 7) : '';
        if (lastM === yearMonth || nextM === yearMonth) {
            total += parseFloat(s.Amount) || 0;
        }
    });
    return total;
}

// --- AUTH ---
app.post('/api/login', loginLimiter, (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
    // Basit injection koruması: username sadece alfanumerik+underscore
    if (!/^[a-zA-Z0-9_]{1,50}$/.test(username)) return res.status(400).json({ error: 'Geçersiz kullanıcı adı' });
    db.get("SELECT * FROM Users WHERE username=?", [username], (err, row) => {
        if (err) return res.status(500).json({ error: 'Sunucu hatası' });
        if (!row) return res.status(401).json({ success: false, message: 'Geçersiz kullanıcı adı veya şifre' });
        const match = bcrypt.compareSync(password, row.password);
        if (!match) return res.status(401).json({ success: false, message: 'Geçersiz kullanıcı adı veya şifre' });
        const token = createSession(row);
        res.json({ success: true, token, user: { id: row.id, username: row.username, role: row.role } });
    });
});

app.post('/api/logout', requireAuth, (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (token) activeSessions.delete(token);
    res.json({ success: true });
});

app.get('/api/users', requireAdmin, (req, res) => {
    // Master admin şifreleri görebilir (hashlenmiş şekilde)
    const query = req.user.username === 'admin1905'
        ? "SELECT id,username,role,password FROM Users ORDER BY id ASC"
        : "SELECT id,username,role FROM Users ORDER BY id ASC";
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/users', requireMasterAdmin, (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
    if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) return res.status(400).json({ error: 'Geçersiz kullanıcı adı (3-50 karakter, harf/rakam/altçizgi)' });
    if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
    const hashedPwd = bcrypt.hashSync(password, 10);
    db.run("INSERT INTO Users (username,password,role) VALUES (?,?,?)", [username, hashedPwd, role || 'staff'], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Bu kullanıcı adı zaten var' });
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, username, role: role || 'staff' });
    });
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Geçersiz ID' });
    db.get("SELECT username, role FROM Users WHERE id=?", [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        if (row.username === 'admin1905') return res.status(403).json({ error: 'admin1905 silinemez' });
        if (row.role === 'admin' && req.user.username !== 'admin1905')
            return res.status(403).json({ error: 'Diğer adminleri sadece admin1905 silebilir' });
        db.run("DELETE FROM Users WHERE id=?", [id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

app.put('/api/users/:id', requireMasterAdmin, (req, res) => {
    const { password } = req.body;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Geçersiz ID' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
    const hashedPwd = bcrypt.hashSync(password, 10);
    db.run("UPDATE Users SET password=? WHERE id=?", [hashedPwd, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        res.json({ success: true });
    });
});

// --- MEMBERS ---
app.get('/api/members', requireAuth, (req, res) => {
    db.all("SELECT * FROM Members ORDER BY Name,Surname", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.post('/api/members', requireAuth, (req, res) => {
    const { Name, Surname, Email, Phone, Registration_Date, Status, Address, Bank_Name, IBAN, Member_Type } = req.body;
    if (!Name || !Surname) return res.status(400).json({ error: 'Ad ve soyad zorunlu' });
    // IBAN format - boş ise OK, dolu ise başlık kontrol
    if (IBAN && !/^[A-Z0-9 ]{5,34}$/.test(IBAN.replace(/\s/g, ''))) {
        return res.status(400).json({ error: 'Geçersiz IBAN formatı' });
    }
    const validTypes = ['Normal', 'Kadın', 'Öğrenci/Emekli'];
    const memberType = validTypes.includes(Member_Type) ? Member_Type : 'Normal';
    let fee = memberType === 'Normal' ? 120 : memberType === 'Kadın' ? 70 : 50;
    const creator = req.user.username;
    const regDate = Registration_Date || new Date().toISOString().split('T')[0];
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        db.run(`INSERT INTO Members (Name,Surname,Email,Phone,Registration_Date,Status,Address,Bank_Name,IBAN,Member_Type,Created_By) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [Name.trim(), Surname.trim(), Email || '', Phone || '', regDate, Status || 'Active', Address || '', Bank_Name || '', IBAN ? IBAN.trim() : '', memberType, creator],
            function(err) {
                if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }
                const memberId = this.lastID;
                if (fee > 0) {
                    db.run(`INSERT INTO Financials (Date,Type,Category,Amount,Created_By) VALUES (?,?,?,?,?)`,
                        [regDate, 'Income', 'Üyelik Aidatı', fee, creator],
                        function(err) {
                            if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }
                            db.run("COMMIT", () => res.json({ id: memberId }));
                        });
                } else {
                    db.run("COMMIT", () => res.json({ id: memberId }));
                }
            });
    });
});
app.put('/api/members/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Geçersiz ID' });
    const { Name, Surname, Email, Phone, Registration_Date, Status, Address, Bank_Name, IBAN, Member_Type } = req.body;
    if (!Name || !Surname) return res.status(400).json({ error: 'Ad ve soyad zorunlu' });
    db.run(`UPDATE Members SET Name=?,Surname=?,Email=?,Phone=?,Registration_Date=?,Status=?,Address=?,Bank_Name=?,IBAN=?,Member_Type=? WHERE id=?`,
        [Name.trim(), Surname.trim(), Email || '', Phone || '', Registration_Date, Status || 'Active', Address || '', Bank_Name || '', IBAN ? IBAN.trim() : '', Member_Type, id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Üye bulunamadı' });
            res.json({ success: true });
        });
});
app.delete('/api/members/:id', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Geçersiz ID' });
    db.run("DELETE FROM Members WHERE id=?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Üye bulunamadı' });
        res.json({ success: true });
    });
});

// --- SPONSORS ---
app.get('/api/sponsors', requireAuth, (req, res) => {
    db.all("SELECT * FROM Sponsors ORDER BY Name ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.post('/api/sponsors', requireAuth, (req, res) => {
    const { Name, Surname, Company, Phone, Email, Amount, Payment_Period, Last_Payment_Date, Next_Payment_Date, Notes } = req.body;
    if (!Name) return res.status(400).json({ error: 'Sponsor adı zorunlu' });
    const amt = parseFloat(Amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Geçerli bir tutar girin' });
    const validPeriods = ['monthly','quarterly','custom4','custom5','semi-annual','annual'];
    if (!validPeriods.includes(Payment_Period)) return res.status(400).json({ error: 'Geçersiz ödeme dönemi' });
    db.run(`INSERT INTO Sponsors (Name,Surname,Company,Phone,Email,Amount,Payment_Period,Last_Payment_Date,Next_Payment_Date,Notes,Created_By) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [Name.trim(), Surname || '', Company || '', Phone || '', Email || '', amt, Payment_Period, Last_Payment_Date, Next_Payment_Date, Notes || '', req.user.username],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        });
});
app.put('/api/sponsors/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Geçersiz ID' });
    const { Name, Surname, Company, Phone, Email, Amount, Payment_Period, Last_Payment_Date, Next_Payment_Date, Notes, Status } = req.body;
    const amt = parseFloat(Amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Geçerli bir tutar girin' });
    db.run(`UPDATE Sponsors SET Name=?,Surname=?,Company=?,Phone=?,Email=?,Amount=?,Payment_Period=?,Last_Payment_Date=?,Next_Payment_Date=?,Notes=?,Status=? WHERE id=?`,
        [Name.trim(), Surname || '', Company || '', Phone || '', Email || '', amt, Payment_Period, Last_Payment_Date, Next_Payment_Date, Notes || '', Status || 'Active', id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});
app.delete('/api/sponsors/:id', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Geçersiz ID' });
    db.run("DELETE FROM Sponsors WHERE id=?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- FINANCIALS ---
app.get('/api/financials', requireAuth, (req, res) => {
    db.all("SELECT * FROM Financials ORDER BY Date DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.put('/api/financials/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Geçersiz ID' });
    const { Date: fDate, Type, Category, Amount, Notes } = req.body;
    const validTypes = ['Income', 'Expense'];
    if (!validTypes.includes(Type)) return res.status(400).json({ error: 'Geçersiz işlem tipi' });
    const amt = parseFloat(Amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Geçerli tutar girin' });
    db.run(`UPDATE Financials SET Date=?,Type=?,Category=?,Amount=?,Notes=? WHERE id=?`,
        [fDate, Type, Category, amt, Notes || '', id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Kayıt bulunamadı' });
            res.json({ success: true });
        });
});
app.post('/api/financials', requireAuth, upload.single('receipt'), (req, res) => {
    const { Date: fDate, Type, Category, Amount } = req.body;
    const File_Path = req.file ? req.file.path.replace(/\\/g, '/') : null;
    const amt = parseFloat(Amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Geçerli tutar girin' });
    db.run(`INSERT INTO Financials (Date,Type,Category,Amount,File_Path,Created_By) VALUES (?,?,?,?,?,?)`,
        [fDate, Type, Category, amt, File_Path, req.user.username],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, File_Path });
        });
});
app.post('/api/financials/daily', requireAuth, upload.single('receipt'), (req, res) => {
    const { Date: fDate, incomes, expenses } = req.body;
    const File_Path = req.file ? req.file.path.replace(/\\/g, '/') : null;
    const creator = req.user.username;
    let parsedIncomes = [], parsedExpenses = [];
    try {
        if (incomes) parsedIncomes = JSON.parse(incomes);
        if (expenses) parsedExpenses = JSON.parse(expenses);
    } catch (e) { return res.status(400).json({ error: 'Geçersiz veri formatı' }); }
    // Tutar doğrulaması
    if (!parsedIncomes.every(i => !isNaN(parseFloat(i.amount)))) return res.status(400).json({ error: 'Geçersiz gelir tutarı' });
    if (!parsedExpenses.every(i => !isNaN(parseFloat(i.amount)))) return res.status(400).json({ error: 'Geçersiz gider tutarı' });
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        parsedIncomes.forEach(inc => {
            if (parseFloat(inc.amount) > 0) db.run(`INSERT INTO Financials (Date,Type,Category,Amount,File_Path,Created_By) VALUES (?,?,?,?,?,?)`,
                [fDate, 'Income', inc.category, parseFloat(inc.amount), File_Path, creator]);
        });
        parsedExpenses.forEach(exp => {
            if (parseFloat(exp.amount) > 0) db.run(`INSERT INTO Financials (Date,Type,Category,Amount,File_Path,Created_By) VALUES (?,?,?,?,?,?)`,
                [fDate, 'Expense', exp.category, parseFloat(exp.amount), File_Path, creator]);
        });
        db.run("COMMIT", (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, File_Path });
        });
    });
});
app.delete('/api/financials/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Geçersiz ID' });
    db.run("DELETE FROM Financials WHERE id=?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- STATS ---
app.get('/api/stats/dashboard', requireAuth, (req, res) => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    let responseData = {
        revenueDistribution: { Giriş: 0, Mutfak: 0, Büfe: 0 },
        currentMonth: { DailyIncome: 0, MembershipIncome: 0, Expense: 0, SponsorIncome: 0 }
    };
    db.serialize(() => {
        db.all("SELECT Category,SUM(Amount) as total FROM Financials WHERE Type='Income' AND Category!='Üyelik Aidatı' GROUP BY Category", [], (err, rows) => {
            if (rows) rows.forEach(r => { if (responseData.revenueDistribution[r.Category] !== undefined) responseData.revenueDistribution[r.Category] = r.total; });
            db.get(`SELECT SUM(CASE WHEN Type='Income' AND Category!='Üyelik Aidatı' THEN Amount ELSE 0 END) as mDaily,
                SUM(CASE WHEN Type='Income' AND Category='Üyelik Aidatı' THEN Amount ELSE 0 END) as mMembership,
                SUM(CASE WHEN Type='Expense' THEN Amount ELSE 0 END) as mExpense
                FROM Financials WHERE strftime('%Y-%m',Date)=?`, [currentMonth], (err, row) => {
                if (row) {
                    responseData.currentMonth.DailyIncome = row.mDaily || 0;
                    responseData.currentMonth.MembershipIncome = row.mMembership || 0;
                    responseData.currentMonth.Expense = row.mExpense || 0;
                }
                db.all("SELECT * FROM Sponsors WHERE Status='Active'", [], (err, sponsors) => {
                    responseData.currentMonth.SponsorIncome = getSponsorMonthlyIncome(sponsors || [], currentMonth);
                    res.json(responseData);
                });
            });
        });
    });
});

app.get('/api/stats/summary', requireAuth, (req, res) => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const summary = { totalMembers: 0, monthlyDailyIncome: 0, monthlyMembershipIncome: 0, monthlySponsorIncome: 0, monthlyExpense: 0, totalIncome: 0, netBalance: 0 };
    db.serialize(() => {
        db.get("SELECT COUNT(*) as count FROM Members", [], (err, row) => {
            if (row) summary.totalMembers = row.count;
            db.get(`SELECT SUM(CASE WHEN Type='Income' AND Category!='Üyelik Aidatı' THEN Amount ELSE 0 END) as mDaily,
                SUM(CASE WHEN Type='Income' AND Category='Üyelik Aidatı' THEN Amount ELSE 0 END) as mMembership,
                SUM(CASE WHEN Type='Expense' THEN Amount ELSE 0 END) as mExpense
                FROM Financials WHERE strftime('%Y-%m',Date)=?`, [currentMonth], (err, statRow) => {
                if (statRow) {
                    summary.monthlyDailyIncome = statRow.mDaily || 0;
                    summary.monthlyMembershipIncome = statRow.mMembership || 0;
                    summary.monthlyExpense = statRow.mExpense || 0;
                }
                db.get(`SELECT SUM(CASE WHEN Type='Income' THEN Amount ELSE 0 END) as tIncome,
                    SUM(CASE WHEN Type='Income' THEN Amount ELSE 0 END)-SUM(CASE WHEN Type='Expense' THEN Amount ELSE 0 END) as net
                    FROM Financials`, [], (err, netRow) => {
                    if (netRow) { summary.totalIncome = netRow.tIncome || 0; summary.netBalance = netRow.net || 0; }
                    db.all("SELECT * FROM Sponsors WHERE Status='Active'", [], (err, sponsors) => {
                        summary.monthlySponsorIncome = getSponsorMonthlyIncome(sponsors || [], currentMonth);
                        res.json(summary);
                    });
                });
            });
        });
    });
});

// Detailed Finance Stats
app.get('/api/stats/finance', requireAuth, (req, res) => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentYear = new Date().getFullYear().toString();
    const result = {
        monthly: { membershipIncome: 0, salesIncome: 0, sponsorIncome: 0, totalIncome: 0, expense: 0, net: 0 },
        yearly: { membershipIncome: 0, salesIncome: 0, sponsorIncome: 0, totalIncome: 0, expense: 0, net: 0 },
        allTime: { totalIncome: 0, totalExpense: 0, netBalance: 0, totalSponsorIncome: 0 },
        monthlyHistory: [],
        activeSponsorCount: 0,
        totalActiveSponsorMonthly: 0
    };
    db.serialize(() => {
        db.get(`SELECT SUM(CASE WHEN Type='Income' AND Category='Üyelik Aidatı' THEN Amount ELSE 0 END) as membership,
            SUM(CASE WHEN Type='Income' AND Category!='Üyelik Aidatı' THEN Amount ELSE 0 END) as sales,
            SUM(CASE WHEN Type='Income' THEN Amount ELSE 0 END) as total_income,
            SUM(CASE WHEN Type='Expense' THEN Amount ELSE 0 END) as total_expense
            FROM Financials WHERE strftime('%Y-%m',Date)=?`, [currentMonth], (err, row) => {
            if (row) {
                result.monthly.membershipIncome = row.membership || 0;
                result.monthly.salesIncome = row.sales || 0;
                result.monthly.totalIncome = row.total_income || 0;
                result.monthly.expense = row.total_expense || 0;
            }
            db.get(`SELECT SUM(CASE WHEN Type='Income' AND Category='Üyelik Aidatı' THEN Amount ELSE 0 END) as membership,
                SUM(CASE WHEN Type='Income' AND Category!='Üyelik Aidatı' THEN Amount ELSE 0 END) as sales,
                SUM(CASE WHEN Type='Income' THEN Amount ELSE 0 END) as total_income,
                SUM(CASE WHEN Type='Expense' THEN Amount ELSE 0 END) as total_expense
                FROM Financials WHERE strftime('%Y',Date)=?`, [currentYear], (err, row) => {
                if (row) {
                    result.yearly.membershipIncome = row.membership || 0;
                    result.yearly.salesIncome = row.sales || 0;
                    result.yearly.totalIncome = row.total_income || 0;
                    result.yearly.expense = row.total_expense || 0;
                }
                db.get(`SELECT SUM(CASE WHEN Type='Income' THEN Amount ELSE 0 END) as total_income,
                    SUM(CASE WHEN Type='Expense' THEN Amount ELSE 0 END) as total_expense
                    FROM Financials`, [], (err, row) => {
                    if (row) {
                        result.allTime.totalIncome = row.total_income || 0;
                        result.allTime.totalExpense = row.total_expense || 0;
                        result.allTime.netBalance = (row.total_income || 0) - (row.total_expense || 0);
                    }
                    db.all(`SELECT strftime('%Y-%m',Date) as month,
                        SUM(CASE WHEN Type='Income' AND Category='Üyelik Aidatı' THEN Amount ELSE 0 END) as membership,
                        SUM(CASE WHEN Type='Income' AND Category!='Üyelik Aidatı' THEN Amount ELSE 0 END) as sales,
                        SUM(CASE WHEN Type='Income' THEN Amount ELSE 0 END) as total_income,
                        SUM(CASE WHEN Type='Expense' THEN Amount ELSE 0 END) as total_expense
                        FROM Financials GROUP BY strftime('%Y-%m',Date) ORDER BY month DESC LIMIT 6`, [], (err, rows) => {
                        // Get sponsors
                        db.all("SELECT * FROM Sponsors", [], (err, sponsors) => {
                            const activeSponsors = (sponsors || []).filter(s => s.Status === 'Active');
                            // Monthly sponsor income
                            result.monthly.sponsorIncome = getSponsorMonthlyIncome(activeSponsors, currentMonth);
                            result.monthly.totalIncome += result.monthly.sponsorIncome;
                            result.monthly.net = result.monthly.totalIncome - result.monthly.expense;
                            // Yearly sponsor income: sum across each month of current year
                            let yearSponsorTotal = 0;
                            for (let m = 1; m <= 12; m++) {
                                const ym = `${currentYear}-${String(m).padStart(2,'0')}`;
                                yearSponsorTotal += getSponsorMonthlyIncome(activeSponsors, ym);
                            }
                            result.yearly.sponsorIncome = yearSponsorTotal;
                            result.yearly.totalIncome += yearSponsorTotal;
                            result.yearly.net = result.yearly.totalIncome - result.yearly.expense;
                            // Total sponsor income (all time, naive: sum of Amount for all sponsors)
                            result.allTime.totalSponsorIncome = (sponsors || []).reduce((acc, s) => acc + (parseFloat(s.Amount) || 0), 0);
                            result.allTime.netBalance += result.allTime.totalSponsorIncome;
                            // Active sponsor stats
                            result.activeSponsorCount = activeSponsors.length;
                            result.totalActiveSponsorMonthly = activeSponsors.reduce((acc, s) => acc + calcMonthlyEquiv(parseFloat(s.Amount) || 0, s.Payment_Period), 0);
                            // Monthly history with sponsor
                            if (rows) {
                                result.monthlyHistory = rows.reverse().map(r => {
                                    const sm = getSponsorMonthlyIncome(activeSponsors, r.month);
                                    return {
                                        month: r.month,
                                        membership: r.membership || 0,
                                        sales: r.sales || 0,
                                        sponsor: sm,
                                        totalIncome: (r.total_income || 0) + sm,
                                        expense: r.total_expense || 0
                                    };
                                });
                            }
                            res.json(result);
                        });
                    });
                });
            });
        });
    });
});

app.get('/api/archive', requireAuth, (req, res) => {
    db.all(`SELECT Date, File_Path, MAX(Created_By) as Created_By,
            SUM(CASE WHEN Type='Income' THEN Amount ELSE 0 END) as Daily_Income,
            SUM(CASE WHEN Type='Expense' THEN Amount ELSE 0 END) as Daily_Expense,
            json_group_array(json_object('id',id,'Category',Category,'Amount',Amount,'Type',Type,'Notes',Notes)) as Details
            FROM Financials GROUP BY Date,File_Path ORDER BY Date DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => ({ ...r, Details: JSON.parse(r.Details) })));
    });
});

// --- PRODUCTION SETUP: Serve Frontend ---
const frontendPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendPath)) {
    console.log('Production mode: Serving frontend from', frontendPath);
    app.use(express.static(frontendPath));
    
    // Catch-all route to serve React's index.html
    // Using app.use() instead of app.get('*') to be compatible with Express 5
    app.use((req, res) => {
        res.sendFile(path.join(frontendPath, 'index.html'));
    });
}

app.listen(process.env.PORT || port, () => console.log(`Backend running on http://localhost:${process.env.PORT || port}`));
