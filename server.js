// server.js
require('dotenv').config(); // Carrega .env para este arquivo
const express = require("express");
const cors = require("cors");
const path = require("path");
const { poolConnect } = require('./db.js'); // Importa a promessa de conexão
const authMiddleware = require('./authMiddleware.js'); // Importa o middleware

// Importa os roteadores
const authRoutes = require('./routes/auth.js');
const produtoRoutes = require('./routes/produtos.js');
const clienteRoutes = require('./routes/clientes.js');
const pedidoRoutes = require('./routes/pedidos.js');
const ambienteRoutes = require('./routes/ambientes.js');
const usuarioRoutes = require('./routes/usuarios.js');
const dashboardRoutes = require('./routes/dashboard.js'); // NOVO

const app = express();
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos (HTML, CSS)
app.use(express.static(path.join(__dirname, '.')));

// --- Rotas de API ---

// Rotas públicas (login)
app.use('/auth', authRoutes);

// Rotas privadas (protegidas por JWT)
// Todas as rotas abaixo vão exigir um token válido
app.use('/dashboard', authMiddleware, dashboardRoutes); // NOVO
app.use('/produtos', authMiddleware, produtoRoutes);
app.use('/clientes', authMiddleware, clienteRoutes);
app.use('/pedidos', authMiddleware, pedidoRoutes);
app.use('/ambientes', authMiddleware, ambienteRoutes);
app.use('/usuarios', authMiddleware, usuarioRoutes);

// --- Tratamento de Rotas não encontradas ---
app.use((req, res, next) => {
    // Lista de prefixos de API
    const apiPrefixes = ['/auth', '/dashboard', '/produtos', '/clientes', '/pedidos', '/ambientes', '/usuarios'];

    if (apiPrefixes.some(prefix => req.path.startsWith(prefix))) {
        return res.status(404).json({ sucesso: false, mensagem: "Rota de API não encontrada." });
    }
    next();
});

const PORT = process.env.PORT || 3000;

// Inicia o servidor DEPOIS de confirmar a conexão com o banco
poolConnect.then(() => {
    console.log("Conectado ao SQL Server com sucesso!");
    app.listen(PORT, () => {
        console.log(`Servidor rodando em http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error("Erro ao conectar ao SQL Server, servidor não iniciado:", err);
});

