const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

const db = new sqlite3.Database('./dernek.db', (err) => {
    if (err) { console.error('DB Error:', err.message); return; }
    console.log('Connected to SQLite.');
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS Users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'staff')`);
        db.get("SELECT * FROM Users WHERE username='admin1905'", [], (e, row) => {
            if (!row) db.run("INSERT INTO Users (username,password,role) VALUES ('admin1905','Sampiy10G4l4t4s4r4y!','admin')");
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
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM Users WHERE username=? AND password=?", [username, password], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) res.json({ success: true, user: { id: row.id, username: row.username, role: row.role } });
        else res.status(401).json({ success: false, message: 'Geçersiz kullanıcı adı veya şifre' });
    });
});

app.get('/api/users', (req, res) => {
    db.all("SELECT id,username,role FROM Users ORDER BY id ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.post('/api/users', (req, res) => {
    const { username, password, role } = req.body;
    db.run("INSERT INTO Users (username,password,role) VALUES (?,?,?)", [username, password, role || 'staff'], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Bu kullanıcı adı zaten var' });
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, username, role: role || 'staff' });
    });
});
app.delete('/api/users/:id', (req, res) => {
    db.run("DELETE FROM Users WHERE id=?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- MEMBERS ---
app.get('/api/members', (req, res) => {
    db.all("SELECT * FROM Members ORDER BY Name,Surname", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.post('/api/members', (req, res) => {
    const { Name, Surname, Email, Phone, Registration_Date, Status, Address, Bank_Name, IBAN, Member_Type, Created_By } = req.body;
    let fee = 0;
    if (Member_Type === 'Normal') fee = 120;
    else if (Member_Type === 'Kadın') fee = 70;
    else if (Member_Type === 'Öğrenci/Emekli') fee = 50;
    const creator = Created_By || 'Unknown';
    const regDate = Registration_Date || new Date().toISOString().split('T')[0];
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        db.run(`INSERT INTO Members (Name,Surname,Email,Phone,Registration_Date,Status,Address,Bank_Name,IBAN,Member_Type,Created_By) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [Name, Surname, Email, Phone, regDate, Status || 'Active', Address, Bank_Name, IBAN, Member_Type, creator],
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
app.put('/api/members/:id', (req, res) => {
    const { Name, Surname, Email, Phone, Registration_Date, Status, Address, Bank_Name, IBAN, Member_Type } = req.body;
    db.run(`UPDATE Members SET Name=?,Surname=?,Email=?,Phone=?,Registration_Date=?,Status=?,Address=?,Bank_Name=?,IBAN=?,Member_Type=? WHERE id=?`,
        [Name, Surname, Email, Phone, Registration_Date, Status || 'Active', Address, Bank_Name, IBAN, Member_Type, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});
app.delete('/api/members/:id', (req, res) => {
    db.run("DELETE FROM Members WHERE id=?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Üye bulunamadı' });
        res.json({ success: true });
    });
});

// --- SPONSORS ---
app.get('/api/sponsors', (req, res) => {
    db.all("SELECT * FROM Sponsors ORDER BY Name ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.post('/api/sponsors', (req, res) => {
    const { Name, Surname, Company, Phone, Email, Amount, Payment_Period, Last_Payment_Date, Next_Payment_Date, Notes, Created_By } = req.body;
    db.run(`INSERT INTO Sponsors (Name,Surname,Company,Phone,Email,Amount,Payment_Period,Last_Payment_Date,Next_Payment_Date,Notes,Created_By) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [Name, Surname || '', Company || '', Phone || '', Email || '', parseFloat(Amount), Payment_Period || 'monthly', Last_Payment_Date, Next_Payment_Date, Notes || '', Created_By || 'Unknown'],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        });
});
app.put('/api/sponsors/:id', (req, res) => {
    const { Name, Surname, Company, Phone, Email, Amount, Payment_Period, Last_Payment_Date, Next_Payment_Date, Notes, Status } = req.body;
    db.run(`UPDATE Sponsors SET Name=?,Surname=?,Company=?,Phone=?,Email=?,Amount=?,Payment_Period=?,Last_Payment_Date=?,Next_Payment_Date=?,Notes=?,Status=? WHERE id=?`,
        [Name, Surname || '', Company || '', Phone || '', Email || '', parseFloat(Amount), Payment_Period, Last_Payment_Date, Next_Payment_Date, Notes || '', Status || 'Active', req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});
app.delete('/api/sponsors/:id', (req, res) => {
    db.run("DELETE FROM Sponsors WHERE id=?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- FINANCIALS ---
app.get('/api/financials', (req, res) => {
    db.all("SELECT * FROM Financials ORDER BY Date DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.put('/api/financials/:id', (req, res) => {
    const { Date: fDate, Type, Category, Amount, Notes } = req.body;
    db.run(`UPDATE Financials SET Date=?,Type=?,Category=?,Amount=?,Notes=? WHERE id=?`,
        [fDate, Type, Category, parseFloat(Amount), Notes || '', req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});
app.post('/api/financials', upload.single('receipt'), (req, res) => {
    const { Date: fDate, Type, Category, Amount, Created_By } = req.body;
    const File_Path = req.file ? req.file.path : null;
    db.run(`INSERT INTO Financials (Date,Type,Category,Amount,File_Path,Created_By) VALUES (?,?,?,?,?,?)`,
        [fDate, Type, Category, parseFloat(Amount), File_Path, Created_By || 'Unknown'],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, File_Path });
        });
});
app.post('/api/financials/daily', upload.single('receipt'), (req, res) => {
    const { Date: fDate, incomes, expenses, Created_By } = req.body;
    const File_Path = req.file ? req.file.path : null;
    const creator = Created_By || 'Unknown';
    let parsedIncomes = [], parsedExpenses = [];
    try {
        if (incomes) parsedIncomes = JSON.parse(incomes);
        if (expenses) parsedExpenses = JSON.parse(expenses);
    } catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); }
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        parsedIncomes.forEach(inc => {
            if (inc.amount > 0) db.run(`INSERT INTO Financials (Date,Type,Category,Amount,File_Path,Created_By) VALUES (?,?,?,?,?,?)`,
                [fDate, 'Income', inc.category, parseFloat(inc.amount), File_Path, creator]);
        });
        parsedExpenses.forEach(exp => {
            if (exp.amount > 0) db.run(`INSERT INTO Financials (Date,Type,Category,Amount,File_Path,Created_By) VALUES (?,?,?,?,?,?)`,
                [fDate, 'Expense', exp.category, parseFloat(exp.amount), File_Path, creator]);
        });
        db.run("COMMIT", (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, File_Path });
        });
    });
});
app.delete('/api/financials/:id', (req, res) => {
    db.run("DELETE FROM Financials WHERE id=?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- STATS ---
app.get('/api/stats/dashboard', (req, res) => {
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

app.get('/api/stats/summary', (req, res) => {
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
app.get('/api/stats/finance', (req, res) => {
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

app.get('/api/archive', (req, res) => {
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
    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendPath, 'index.html'));
    });
}

app.listen(process.env.PORT || port, () => console.log(`Backend running on http://localhost:${process.env.PORT || port}`));
