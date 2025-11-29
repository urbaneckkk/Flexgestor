// routes/clientes.js
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

// [R]EAD - Ler todos os clientes
router.get("/", async (req, res) => {
    const ambienteId = req.ambienteId;
    const { filtro } = req.query;
    try {
        let result = await pool.request()
            .input("AmbienteId", sql.Int, ambienteId)
            .input("Filtro", sql.VarChar, filtro || null)
            .execute("sp_ListarClientes"); // Sua SP já deve estar listando 'documento' e 'logradouro'
        res.json(result.recordset);
    } catch (err) {
        console.error("Erro /clientes (GET):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar clientes." });
    }
});

// [C]REATE - Criar novo cliente (ATUALIZADO)
router.post("/", async (req, res) => {
    const ambienteId = req.ambienteId;

    // ATUALIZADO: para 'documento' e 'logradouro'
    const { nome, telefone, email, documento, logradouro, cep, limiteCredito, tags, ramoAtividade } = req.body;

    try {
        let result = await pool.request()
            .input("AmbienteId", sql.Int, ambienteId)
            .input("Nome", sql.VarChar, nome)
            .input("Telefone", sql.VarChar, telefone)
            .input("Email", sql.VarChar, email)
            .input("Documento", sql.VarChar, documento)     // ATUALIZADO de CPF
            .input("Logradouro", sql.VarChar, logradouro)   // ATUALIZADO de Endereco
            .input("CEP", sql.VarChar, cep)
            .input("LimiteCredito", sql.Decimal(10, 2), limiteCredito || null)
            .input("Tags", sql.VarChar, tags || null)
            .input("RamoAtividade", sql.VarChar, ramoAtividade || null)
            .execute("sp_CriarCliente");

        const novoId = result.recordset[0].id;
        res.status(201).json({ sucesso: true, mensagem: "Cliente criado com sucesso!", novoId: novoId });
    } catch (err) {
        console.error("Erro /clientes (POST):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao criar cliente." });
    }
});

// [U]PDATE - Atualizar um cliente (ATUALIZADO)
router.put("/:id", async (req, res) => {
    const ambienteId = req.ambienteId;
    const { id } = req.params;

    // ATUALIZADO: para 'documento' e 'logradouro'
    const { nome, telefone, email, documento, logradouro, cep, limiteCredito, tags, ramoAtividade } = req.body;

    try {
        let result = await pool.request()
            .input("ID", sql.Int, id)
            .input("AmbienteId", sql.Int, ambienteId)
            .input("Nome", sql.VarChar, nome)
            .input("Telefone", sql.VarChar, telefone)
            .input("Email", sql.VarChar, email)
            .input("Documento", sql.VarChar, documento)     // ATUALIZADO de CPF
            .input("Logradouro", sql.VarChar, logradouro)   // ATUALIZADO de Endereco
            .input("CEP", sql.VarChar, cep)
            .input("LimiteCredito", sql.Decimal(10, 2), limiteCredito || null)
            .input("Tags", sql.VarChar, tags || null)
            .input("RamoAtividade", sql.VarChar, ramoAtividade || null)
            .execute("sp_AtualizarCliente"); // AQUI ESTAVA O MEU TYPO (sqlAddress") - Corrigido.

        if (result.recordset[0].RowsAffected > 0) {
            res.json({ sucesso: true, mensagem: "Cliente atualizado com sucesso!" });
        } else {
            res.status(404).json({ sucesso: false, mensagem: "Cliente não encontrado ou não pertence a este ambiente." });
        }
    } catch (err) {
        console.error("Erro /clientes/:id (PUT):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao atualizar cliente." });
    }
});

// [D]ELETE - Excluir um cliente (Não precisa de alteração)
router.delete("/:id", async (req, res) => {
    const ambienteId = req.ambienteId;
    const { id } = req.params;
    try {
        let result = await pool.request()
            .input("ID", sql.Int, id)
            .input("AmbienteId", sql.Int, ambienteId)
            .execute("sp_ExcluirCliente");

        if (result.recordset[0].RowsAffected > 0) {
            res.json({ sucesso: true, mensagem: "Cliente excluído com sucesso!" });
        } else {
            res.status(404).json({ sucesso: false, mensagem: "Cliente não encontrado ou não pertence a este ambiente." });
        }
    } catch (err) {
        console.error("Erro /clientes/:id (DELETE):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao excluir cliente." });
    }
});

module.exports = router;