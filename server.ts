import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import fs from "fs";

// Initialize Database
const db = new Database("nihongo.db");
db.pragma("journal_mode = WAL");

// Database Schema Setup
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT CHECK(role IN ('teacher', 'student')) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS essays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_email TEXT NOT NULL,
    title TEXT,
    content TEXT,
    correction TEXT,
    feedback TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_email) REFERENCES users(email)
  );

  CREATE TABLE IF NOT EXISTS vocab_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_email TEXT NOT NULL,
    word TEXT,
    reading TEXT,
    meaning TEXT,
    example TEXT,
    FOREIGN KEY(student_email) REFERENCES users(email)
  );

  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_email TEXT NOT NULL,
    rewritten_text TEXT,
    level TEXT,
    topic TEXT,
    vocabulary_list TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: Add missing columns if they don't exist
const addColumn = (table: string, column: string, type: string) => {
  const info = db.pragma(`table_info(${table})`) as any[];
  if (!info.some(col => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
};

addColumn('essays', 'furigana_content', 'TEXT');
addColumn('essays', 'qa_list', 'TEXT');
addColumn('essays', 'vocabulary_list', 'TEXT');
addColumn('essays', 'images', 'TEXT');

// Seed Data
const seedUsers = [
  { email: 'misaki.nihongo@gmail.com', name: 'Misaki先生', role: 'teacher' },
  { email: 'tudorpetrutmihai@gmail.com', name: 'Tudorさん', role: 'student' },
  { email: 'chris.long.00@gmail.com', name: 'Chrisさん', role: 'student' },
  { email: 'andreu.eric@gmail.com', name: 'Ericさん', role: 'student' },
  { email: 'jacklahti09@gmail.com', name: 'Jackさん', role: 'student' },
  { email: 'aspikchan@gmail.com', name: 'Inaさん', role: 'student' }
];

const insertUser = db.prepare("INSERT OR IGNORE INTO users (email, name, role) VALUES (?, ?, ?)");
seedUsers.forEach(u => insertUser.run(u.email, u.name, u.role));

async function startServer() {
  const app = express();
  app.use(express.json());

  const PORT = 3000;

  // API Routes
  app.get("/api/user/:email", (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(req.params.email);
    if (user) res.json(user);
    else res.status(404).json({ error: "User not found" });
  });

  app.get("/api/students", (req, res) => {
    const students = db.prepare("SELECT * FROM users WHERE role = 'student'").all();
    res.json(students);
  });

  app.get("/api/essays/:email", (req, res) => {
    const essays = db.prepare("SELECT * FROM essays WHERE student_email = ? ORDER BY date DESC").all(req.params.email) as any[];
    const parsedEssays = essays.map(e => ({
      ...e,
      qa_list: e.qa_list ? JSON.parse(e.qa_list) : [],
      vocabulary_list: e.vocabulary_list ? JSON.parse(e.vocabulary_list) : [],
      images: e.images ? JSON.parse(e.images) : []
    }));
    res.json(parsedEssays);
  });

  app.post("/api/essays", (req, res) => {
    const { student_email, title, content } = req.body;
    const info = db.prepare("INSERT INTO essays (student_email, title, content) VALUES (?, ?, ?)").run(student_email, title, content);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/essays/:id", (req, res) => {
    const { title, content, correction, feedback, furigana_content, qa_list, vocabulary_list, images } = req.body;
    const existing = db.prepare("SELECT * FROM essays WHERE id = ?").get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: "Essay not found" });

    db.prepare(`
      UPDATE essays 
      SET title = ?, content = ?, correction = ?, feedback = ?, furigana_content = ?, qa_list = ?, vocabulary_list = ?, images = ? 
      WHERE id = ?
    `).run(
      title ?? existing.title,
      content ?? existing.content,
      correction ?? existing.correction,
      feedback ?? existing.feedback,
      furigana_content ?? existing.furigana_content,
      qa_list ? JSON.stringify(qa_list) : existing.qa_list,
      vocabulary_list ? JSON.stringify(vocabulary_list) : existing.vocabulary_list,
      images ? JSON.stringify(images) : existing.images,
      req.params.id
    );
    res.json({ success: true });
  });

  app.delete("/api/essays/:id", (req, res) => {
    db.prepare("DELETE FROM essays WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/articles/:id", (req, res) => {
    db.prepare("DELETE FROM articles WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/vocab/:email", (req, res) => {
    const vocab = db.prepare("SELECT * FROM vocab_list WHERE student_email = ?").all(req.params.email);
    res.json(vocab);
  });

  app.post("/api/vocab", (req, res) => {
    const { student_email, word, reading, meaning, example } = req.body;
    const info = db.prepare("INSERT INTO vocab_list (student_email, word, reading, meaning, example) VALUES (?, ?, ?, ?, ?)").run(student_email, word, reading, meaning, example);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/articles", (req, res) => {
    const { email } = req.query;
    let articles;
    if (email) {
      articles = db.prepare("SELECT * FROM articles WHERE author_email = ? ORDER BY created_at DESC").all(email) as any[];
    } else {
      articles = db.prepare("SELECT * FROM articles ORDER BY created_at DESC").all() as any[];
    }
    const parsedArticles = articles.map(a => ({
      ...a,
      vocabulary_list: a.vocabulary_list ? JSON.parse(a.vocabulary_list) : []
    }));
    res.json(parsedArticles);
  });

  app.post("/api/articles", (req, res) => {
    const { author_email, rewritten_text, level, topic, vocabulary_list } = req.body;
    const info = db.prepare("INSERT INTO articles (author_email, rewritten_text, level, topic, vocabulary_list) VALUES (?, ?, ?, ?, ?)").run(
      author_email, 
      rewritten_text, 
      level, 
      topic,
      vocabulary_list ? JSON.stringify(vocabulary_list) : "[]"
    );
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/articles/:id", (req, res) => {
    const { rewritten_text, level, topic, vocabulary_list } = req.body;
    const existing = db.prepare("SELECT * FROM articles WHERE id = ?").get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: "Article not found" });

    db.prepare(`
      UPDATE articles 
      SET rewritten_text = ?, level = ?, topic = ?, vocabulary_list = ? 
      WHERE id = ?
    `).run(
      rewritten_text ?? existing.rewritten_text,
      level ?? existing.level,
      topic ?? existing.topic,
      vocabulary_list ? JSON.stringify(vocabulary_list) : existing.vocabulary_list,
      req.params.id
    );
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
