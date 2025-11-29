// db.js
// Carrega as variáveis de ambiente do .env
require('dotenv').config();

const sql = require('mssql');

// Configuração do banco de dados lendo do .env
const config = {
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    server: process.env.DATABASE_SERVER,
    database: process.env.DATABASE_NAME,
    port: parseInt(process.env.DATABASE_PORT, 10),
    options: {
        encrypt: false, // Mude para true se estiver na Azure
        trustServerCertificate: true // Para conexões locais
    }
};

// Criamos um "pool" de conexões para ser reutilizado
const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

pool.on('error', err => {
    console.error("Erro no Pool do SQL:", err);
});

module.exports = {
    pool,
    poolConnect // Exportamos a promessa de conexão
};
