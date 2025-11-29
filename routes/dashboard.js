// routes/dashboard.js
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

// [R]EAD - Busca os dados do Dashboard (KPIs Principais)
// Rota: GET /dashboard/
router.get("/", async (req, res) => {
    const ambienteId = req.ambienteId; // Pega do middleware

    try {
        let result = await pool.request()
            .input("AmbienteId", sql.Int, ambienteId)
            .execute("sp_GetDashboardData"); // SP para KPIs

        // A SP retorna 1 linha com 6 colunas
        res.json(result.recordset[0]);

    } catch (err) {
        console.error("Erro /dashboard (GET):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar dados do dashboard." });
    }
});


// ATUALIZADO: [R]EAD - Busca os dados dos GRÁFICOS do Dashboard
// Rota: GET /dashboard/graficos

router.get("/graficos", async (req, res) => {
    const ambienteId = req.ambienteId;

    // Pega datas do query string
    let { dataInicio, dataFim } = req.query;

    if (!dataFim) {
        dataFim = new Date(); // Hoje
    } else {
        let fim = new Date(dataFim);
        fim.setHours(23, 59, 59, 999);
        dataFim = fim;
    }

    if (!dataInicio) {
        const hoje = new Date(dataFim);
        dataInicio = new Date(hoje.setDate(hoje.getDate() - 6)); // 7 dias atrás
        dataInicio.setHours(0, 0, 0, 0);
    } else {
        let inicio = new Date(dataInicio);
        inicio.setHours(0, 0, 0, 0);
        dataInicio = inicio;
    }

    try {
        let result = await pool.request()
            .input("AmbienteId", sql.Int, ambienteId)
            .input("DataInicio", sql.DateTime, dataInicio)
            .input("DataFim", sql.DateTime, dataFim)
            .execute("sp_GetDashboardGraficos"); // A SP vai ser atualizada (Passo 3)

        // ATUALIZADO: Agora esperamos 7 recordsets (removido o faturamentoPorOrigem)
        const [
            faturamentoPorDia, 
            pedidosPorStatus, 
            topProdutos, 
            novosClientes,
            faturamentoPorPagamento,   // (Era o 6º, virou o 5º)
            faturamentoPorTipoPedido,  // (Era o 7º, virou o 6º)
            faturamentoPorRamo         // (Era o 8º, virou o 7º)
        ] = result.recordsets;

        // ATUALIZADO: Enviamos os 7 no JSON
        res.json({
            faturamentoPorDia,
            pedidosPorStatus,
            topProdutos,
            novosClientes,
            // (faturamentoPorOrigem removido daqui)
            faturamentoPorPagamento,
            faturamentoPorTipoPedido,
            faturamentoPorRamo
        });

    } catch (err) {
        console.error("Erro /dashboard/graficos (GET):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar dados dos gráficos." });
    }
});


module.exports = router;