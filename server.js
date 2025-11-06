import express from "express";
import cors from "cors";
import mysql from "mysql2";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// === Middlewares ===
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public")));

// === Conexão MySQL ===
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "NovaSenhaSegura",
  database: "chupchup_db",
});

db.connect((err) => {
  if (err) console.error("❌ Erro ao conectar no MySQL:", err);
  else console.log("✅ Conectado ao MySQL!");
});

// === Configuração de upload ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// === ROTAS ===

// 🧍 Cadastro de usuário
app.post("/api/cadastro", async (req, res) => {
  const { nome, email, senha, bairro, rua, referencia } = req.body;

  if (!nome || !email || !senha)
    return res.status(400).json({ erro: "Campos obrigatórios não preenchidos." });

  db.query("SELECT * FROM usuarios WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).json({ erro: "Erro no servidor." });
    if (results.length > 0)
      return res.status(400).json({ erro: "Usuário já cadastrado." });

    const senhaHash = await bcrypt.hash(senha, 10);
    const sql =
      "INSERT INTO usuarios (nome, email, senha, bairro, rua, referencia, tipo) VALUES (?, ?, ?, ?, ?, ?, 'user')";
    db.query(sql, [nome, email, senhaHash, bairro, rua, referencia], (err) => {
      if (err) return res.status(500).json({ erro: "Erro ao cadastrar usuário." });
      res.json({ mensagem: "Cadastro realizado com sucesso!", redirect: "paginainicial.html" });
    });
  });
});

// 🔑 Login
app.post("/api/login", (req, res) => {
  const { email, senha } = req.body;

  db.query("SELECT * FROM usuarios WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).json({ erro: "Erro no servidor." });
    if (results.length === 0)
      return res.status(401).json({ erro: "Usuário não encontrado." });

    const usuario = results[0];
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

    if (!senhaCorreta) return res.status(401).json({ erro: "Senha incorreta." });

    const redirect = usuario.tipo === "admin" ? "admin.html" : "paginainicial.html";
    res.json({
      mensagem: "Login realizado com sucesso!",
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        bairro: usuario.bairro,
        rua: usuario.rua,
        referencia: usuario.referencia,
        tipo: usuario.tipo,
      },
      redirect,
    });
  });
});

// 🧁 Cadastro de produtos (admin)
app.post("/api/produtos", upload.single("imagem"), (req, res) => {
  const { nome, descricao, preco } = req.body;
  const imagem = req.file ? `/uploads/${req.file.filename}` : null;

  if (!nome || !preco)
    return res.status(400).json({ erro: "Campos obrigatórios faltando." });

  const sql =
    "INSERT INTO produtos (nome, descricao, preco, imagem) VALUES (?, ?, ?, ?)";
  db.query(sql, [nome, descricao, preco, imagem], (err) => {
    if (err) return res.status(500).json({ erro: "Erro ao cadastrar produto." });
    res.json({ mensagem: "Produto cadastrado com sucesso!" });
  });
});

// 📋 Listar produtos
app.get("/api/produtos", (req, res) => {
  db.query("SELECT * FROM produtos", (err, results) => {
    if (err) return res.status(500).json({ erro: "Erro ao buscar produtos." });
    res.json(results);
  });
});

// ❌ Excluir produto
app.delete("/api/produtos/:id", (req, res) => {
  const id = req.params.id;
  db.query("SELECT imagem FROM produtos WHERE id = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ erro: "Erro ao buscar produto." });
    if (results.length > 0 && results[0].imagem) {
      const caminhoImagem = path.join(__dirname, "public", results[0].imagem);
      if (fs.existsSync(caminhoImagem)) fs.unlinkSync(caminhoImagem);
    }
    db.query("DELETE FROM produtos WHERE id = ?", [id], (err) => {
      if (err) return res.status(500).json({ erro: "Erro ao remover produto." });
      res.json({ mensagem: "Produto removido com sucesso!" });
    });
  });
});

// 🌐 Página inicial
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 🚀 Iniciar servidor
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
