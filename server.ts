import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';

const db = new Database('database.sqlite');

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS committees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department TEXT,
    name TEXT,
    login_code TEXT UNIQUE
  );
  CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department TEXT,
    name TEXT,
    description TEXT,
    image_url TEXT
  );
  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    committee_code TEXT,
    candidate_id INTEGER,
    score INTEGER,
    vote_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(committee_code, candidate_id)
  );
`);

// Seed data
const committeeCount = db.prepare('SELECT COUNT(*) as count FROM committees').get() as {count: number};
if (committeeCount.count === 0) {
  const insertCommittee = db.prepare('INSERT INTO committees (department, name, login_code) VALUES (?, ?, ?)');
  insertCommittee.run('管理部', '評審一', '1001');
  insertCommittee.run('生產部', '評審二', '1002');
  insertCommittee.run('研發部', '評審三', '1003');
  insertCommittee.run('系統', '主辦單位', 'ADMIN');
}

const candidateCount = db.prepare('SELECT COUNT(*) as count FROM candidates').get() as {count: number};
if (candidateCount.count === 0) {
  const insertCandidate = db.prepare('INSERT INTO candidates (department, name, description, image_url) VALUES (?, ?, ?, ?)');
  insertCandidate.run('生產部', '王小明', '主動發現機台潛在危害並提出改善方案，有效預防工安事故。', null);
  insertCandidate.run('廠務部', '李大華', '確實執行每日工安巡檢，連續三個月無缺失，並協助同仁改善作業環境。', null);
  insertCandidate.run('研發部', '張三', '研發新型安全防護具，減少意外發生率，並獲得專利認證。', null);
  insertCandidate.run('總務部', '李四', '辦理多場工安教育訓練，提升員工安全意識，參與率達100%。', null);
  insertCandidate.run('品保部', '陳五', '落實化學品管理，建立完善的SDS資料庫，確保同仁使用安全。', null);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload size limit for base64 images
  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get('/api/committees', (req, res) => {
    const committees = db.prepare('SELECT id, department, name, login_code FROM committees ORDER BY CASE WHEN login_code = "ADMIN" THEN 1 ELSE 0 END, id ASC').all();
    res.json(committees);
  });

  app.post('/api/login', (req, res) => {
    const { name, login_code } = req.body;
    const committee = db.prepare('SELECT * FROM committees WHERE name = ? AND login_code = ?').get(name, login_code);
    if (committee) {
      res.json({ success: true, committee });
    } else {
      res.status(401).json({ success: false, message: '密碼(代號)錯誤' });
    }
  });

  app.post('/api/committees', (req, res) => {
    const { department, name, login_code } = req.body;
    try {
      const result = db.prepare('INSERT INTO committees (department, name, login_code) VALUES (?, ?, ?)').run(department, name, login_code);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '新增失敗，可能是代號重複' });
    }
  });

  app.put('/api/committees/:id', (req, res) => {
    const { id } = req.params;
    const { department, name, login_code } = req.body;
    try {
      db.prepare('UPDATE committees SET department = ?, name = ?, login_code = ? WHERE id = ?').run(department, name, login_code, id);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '更新失敗，可能是代號重複' });
    }
  });

  app.delete('/api/committees/:id', (req, res) => {
    const { id } = req.params;
    try {
      db.prepare('DELETE FROM committees WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '刪除失敗' });
    }
  });

  app.get('/api/candidates', (req, res) => {
    const candidates = db.prepare('SELECT * FROM candidates').all();
    res.json(candidates);
  });

  app.post('/api/candidates', (req, res) => {
    const { department, name, description } = req.body;
    try {
      const result = db.prepare('INSERT INTO candidates (department, name, description) VALUES (?, ?, ?)').run(department, name, description);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '新增失敗' });
    }
  });

  app.put('/api/candidates/:id', (req, res) => {
    const { id } = req.params;
    const { department, name, description } = req.body;
    try {
      db.prepare('UPDATE candidates SET department = ?, name = ?, description = ? WHERE id = ?').run(department, name, description, id);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '更新失敗' });
    }
  });

  app.delete('/api/candidates/:id', (req, res) => {
    const { id } = req.params;
    try {
      db.prepare('DELETE FROM candidates WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '刪除失敗' });
    }
  });

  app.post('/api/candidates/:id/image', (req, res) => {
    const { id } = req.params;
    const { image_url } = req.body;
    try {
      db.prepare('UPDATE candidates SET image_url = ? WHERE id = ?').run(image_url, id);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '上傳圖片失敗' });
    }
  });

  app.get('/api/votes/:committee_code', (req, res) => {
    const { committee_code } = req.params;
    const votes = db.prepare('SELECT * FROM votes WHERE committee_code = ?').all(committee_code);
    res.json(votes);
  });

  app.post('/api/vote', (req, res) => {
    const { committee_code, votes } = req.body; // votes: { candidate_id: score }[]
    
    const insertVote = db.prepare(`
      INSERT INTO votes (committee_code, candidate_id, score) 
      VALUES (?, ?, ?)
      ON CONFLICT(committee_code, candidate_id) DO UPDATE SET score = excluded.score, vote_time = CURRENT_TIMESTAMP
    `);

    const transaction = db.transaction((votesList) => {
      for (const vote of votesList) {
        insertVote.run(committee_code, vote.candidate_id, vote.score);
      }
    });

    try {
      transaction(votes);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '投票失敗' });
    }
  });

  app.get('/api/results', (req, res) => {
    const results = db.prepare(`
      SELECT 
        c.id, c.department, c.name, c.description, c.image_url,
        COALESCE(SUM(v.score), 0) as total_score,
        COUNT(v.id) as vote_count
      FROM candidates c
      LEFT JOIN votes v ON c.id = v.candidate_id
      GROUP BY c.id
      ORDER BY total_score DESC, c.id ASC
    `).all();
    res.json(results);
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
