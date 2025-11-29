// routes/produtos.js
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

// [R]EAD - Ler todos os produtos (ATUALIZADO com filtro e ambiente)
router.get("/", async (req, res) => {
    // Pega o ambienteId do middleware e o filtro da query
    const ambienteId = req.ambienteId;
    const { nome } = req.query;

    try {
        let result = await pool.request()
            .input("AmbienteId", sql.Int, ambienteId)
            .input("Nome", sql.VarChar, nome || null)
            .execute("sp_ListarProdutos");
        res.json(result.recordset);
    } catch (err) {
        console.error("Erro /produtos (GET):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar produtos." });
    }
});

// [C]REATE - Criar novo produto (ATUALIZADO com ambiente)
router.post("/", async (req, res) => {
    const ambienteId = req.ambienteId; // Pega do middleware
    const { nome, descricao, preco } = req.body;
    if (!nome || preco === undefined) {
        return res.status(400).json({ sucesso: false, mensagem: "Nome e preço são obrigatórios." });
    }
    try {
        await pool.request()
            .input("AmbienteId", sql.Int, ambienteId) // Passa o AmbienteId
            .input("Nome", sql.VarChar, nome)
            .input("Descricao", sql.VarChar, descricao)
            .input("Preco", sql.Decimal(10, 2), preco)
            .execute("sp_CriarProduto");
        res.status(201).json({ sucesso: true, mensagem: "Produto criado com sucesso!" });
    } catch (err) {
        console.error("Erro /produtos (POST):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao criar produto." });
    }
});

// [U]PDATE - Atualizar um produto (ATUALIZADO com ambiente)
router.put("/:id", async (req, res) => {
    const ambienteId = req.ambienteId; // Pega do middleware
    const { id } = req.params;
    const { nome, descricao, preco } = req.body;
    try {
        let result = await pool.request()
            .input("ID", sql.Int, id)
            .input("AmbienteId", sql.Int, ambienteId) // Passa o AmbienteId
            .input("Nome", sql.VarChar, nome)
            .input("Descricao", sql.VarChar, descricao)
            .input("Preco", sql.Decimal(10, 2), preco)
            .execute("sp_AtualizarProduto");

        if (result.recordset[0].RowsAffected > 0) {
            res.json({ sucesso: true, mensagem: "Produto atualizado com sucesso!" });
        } else {
            res.status(404).json({ sucesso: false, mensagem: "Produto não encontrado ou não pertence a este ambiente." });
        }
    } catch (err) {
        console.error("Erro /produtos/:id (PUT):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao atualizar produto." });
    }
});

// [D]ELETE - Excluir um produto (ATUALIZADO com ambiente)
router.delete("/:id", async (req, res) => {
    const ambienteId = req.ambienteId; // Pega do middleware
    const { id } = req.params;
    try {
        let result = await pool.request()
            .input("ID", sql.Int, id)
            .input("AmbienteId", sql.Int, ambienteId) // Passa o AmbienteId
            .execute("sp_ExcluirProduto");

        if (result.recordset[0].RowsAffected > 0) {
            res.json({ sucesso: true, mensagem: "Produto excluído com sucesso!" });
        } else {
            res.status(404).json({ sucesso: false, mensagem: "Produto não encontrado ou não pertence a este ambiente." });
        }
    } catch (err) {
        console.error("Erro /produtos/:id (DELETE):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao excluir produto." });
    }
});

module.exports = router;

