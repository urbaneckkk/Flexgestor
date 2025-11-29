// routes/ambientes.js
const express = require('express');
const sql = require('mssql');
const { pool, poolConnect } = require('../db.js');

const router = express.Router();

// Assegura que o pool está conectado
router.use(async (req, res, next) => {
    try {
        await poolConnect;
        next();
    } catch (err) {
        res.status(500).json({ sucesso: false, mensagem: "Erro de banco de dados." });
    }
});

// [R]EAD - Listar Ambientes
router.get("/", async (req, res) => {
    // TODO: Adicionar checagem se o usuário é "Admin Global"
    // Por enquanto, está aberto para qualquer usuário logado.
    const { filtro } = req.query;
    try {
        let result = await pool.request()
            .input("Filtro", sql.VarChar, filtro || null)
            .execute("sp_ListarAmbientes");
        res.json(result.recordset);
    } catch (err) {
        console.error("Erro /ambientes (GET):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar ambientes." });
    }
});

// [C]REATE - Criar Ambiente
router.post("/", async (req, res) => {
    const { cnpj, nomeFantasia, razaoSocial } = req.body;
    if (!cnpj || !nomeFantasia) {
        return res.status(400).json({ sucesso: false, mensagem: "CNPJ e Nome Fantasia são obrigatórios." });
    }
    try {
        let result = await pool.request()
            .input("CNPJ", sql.VarChar, cnpj)
            .input("NomeFantasia", sql.VarChar, nomeFantasia)
            .input("RazaoSocial", sql.VarChar, razaoSocial)
            .execute("sp_CriarAmbiente");

        const spResult = result.recordset[0];
        if (spResult.Sucesso) {
            res.status(201).json({ sucesso: true, mensagem: spResult.Mensagem, novoId: spResult.NovoId });
        } else {
            res.status(400).json({ sucesso: false, mensagem: spResult.Mensagem });
        }
    } catch (err) {
        console.error("Erro /ambientes (POST):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao criar ambiente." });
    }
});

// [U]PDATE - Atualizar Ambiente
router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { cnpj, nomeFantasia, razaoSocial } = req.body;
    if (!cnpj || !nomeFantasia) {
        return res.status(400).json({ sucesso: false, mensagem: "CNPJ e Nome Fantasia são obrigatórios." });
    }
    try {
        let result = await pool.request()
            .input("ID", sql.Int, id)
            .input("CNPJ", sql.VarChar, cnpj)
            .input("NomeFantasia", sql.VarChar, nomeFantasia)
            .input("RazaoSocial", sql.VarChar, razaoSocial)
            .execute("sp_AtualizarAmbiente");

        const spResult = result.recordset[0];
        if (spResult.Sucesso) {
            res.json({ sucesso: true, mensagem: spResult.Mensagem });
        } else {
            res.status(400).json({ sucesso: false, mensagem: spResult.Mensagem });
        }
    } catch (err) {
        console.error("Erro /ambientes/:id (PUT):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao atualizar ambiente." });
    }
});

// [D]ELETE - Excluir Ambiente
router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        let result = await pool.request()
            .input("ID", sql.Int, id)
            .execute("sp_ExcluirAmbiente");

        const spResult = result.recordset[0];
        if (spResult.Sucesso) {
            res.json({ sucesso: true, mensagem: spResult.Mensagem });
        } else {
            // A SP retorna Sucesso=0 se não puder excluir (ex: dados vinculados)
            res.status(400).json({ sucesso: false, mensagem: spResult.Mensagem });
        }
    } catch (err) {
        console.error("Erro /ambientes/:id (DELETE):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao excluir ambiente." });
    }
});

module.exports = router;
