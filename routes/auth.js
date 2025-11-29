// routes/auth.js
const express = require('express');
const sql = require('mssql');
const jwt = require('jsonwebtoken');
const { pool, poolConnect } = require('../db.js'); // Importa o pool

require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;

const router = express.Router();

// Assegura que o pool está conectado antes de usar
router.use(async (req, res, next) => {
    try {
        await poolConnect;
        next();
    } catch (err) {
        console.error("Erro ao conectar ao pool no auth.js:", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro de banco de dados." });
    }
});

// Rota login (ATUALIZADA)
router.post("/login", async (req, res) => {
    // Agora recebe usuário, senha e cnpjAmbiente
    const { usuario, senha, cnpjAmbiente } = req.body;

    if (!usuario || !senha || !cnpjAmbiente) {
        return res.status(400).json({ sucesso: false, mensagem: "Usuário, senha e CNPJ do Ambiente são obrigatórios." });
    }

    try {
        let result = await pool.request()
            .input("Usuario", sql.VarChar, usuario)
            .input("Senha", sql.VarChar, senha)
            .input("CNPJ", sql.VarChar, cnpjAmbiente)
            .execute("sp_LoginUsuario"); // Executa a SP ATUALIZADA

        if (result.recordset.length > 0) {
            const loginData = result.recordset[0];

            // ATUALIZADO: O Token agora guarda os dados do Ambiente
            const tokenPayload = {
                id: loginData.usuarioId,
                usuario: loginData.nomeUsuario,
                ambienteId: loginData.ambienteId,
                ambienteNome: loginData.ambienteNome
            };

            const token = jwt.sign(
                tokenPayload,
                JWT_SECRET,
                { expiresIn: '8h' } // Token expira em 8 horas
            );

            // Envia o token para o cliente
            res.json({
                sucesso: true,
                mensagem: `Login realizado com sucesso! Bem-vindo ao ambiente ${loginData.ambienteNome}.`,
                token: token
            });
        }
        else {
            res.status(401).json({ sucesso: false, mensagem: "Credenciais inválidas ou acesso não permitido para este ambiente." });
        }

    } catch (err) {
        console.error("Erro /login:", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro no servidor." });
    }
});

// Rota criar conta (NÃO FOI MODIFICADA, mas o usuário não deve mais vê-la)
// No futuro, esta rota deveria ser administrativa e associar o usuário a um ambiente.
router.post("/signup", async (req, res) => {
    const { usuario, senha } = req.body;
    try {
        let result = await pool.request()
            .input("Usuario", sql.VarChar, usuario)
            .input("Senha", sql.VarChar, senha)
            .execute("sp_CriarUsuario"); // Executa a SP

        const spResult = result.recordset[0];

        if (spResult.Sucesso) {
            res.json({ sucesso: true, mensagem: spResult.Mensagem });
        } else {
            res.json({ sucesso: false, mensagem: spResult.Mensagem });
        }
    } catch (err) {
        console.error("Erro /signup:", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro no servidor." });
    }
});

module.exports = router;

