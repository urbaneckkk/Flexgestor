// routes/pedidos.js
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

// [R]EAD - Ler todos os pedidos
router.get("/", async (req, res) => {
    const ambienteId = req.ambienteId;
    const { status, clienteNome } = req.query;
    try {
        let result = await pool.request()
            .input("AmbienteId", sql.Int, ambienteId)
            .input("Status", sql.VarChar, status || null)
            .input("ClienteNome", sql.VarChar, clienteNome || null)
            .execute("sp_ListarPedidos");
        res.json(result.recordset);
    } catch (err) {
        console.error("Erro /pedidos (GET):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar pedidos." });
    }
});

// [R]EAD - Ler UM pedido
router.get("/:id", async (req, res) => {
    const ambienteId = req.ambienteId;
    const { id } = req.params;
    try {
        let result = await pool.request()
            .input("ID", sql.Int, id)
            .input("AmbienteId", sql.Int, ambienteId)
            .execute("sp_BuscarPedidoPorID");

        if (result.recordsets[0].length === 0) {
            return res.status(404).json({ sucesso: false, mensagem: "Pedido não encontrado ou não pertence a este ambiente." });
        }

        let pedido = result.recordsets[0][0];
        pedido.itens = result.recordsets[1];

        res.json(pedido);

    } catch (err) {
        console.error("Erro /pedidos/:id (GET):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar detalhes do pedido." });
    }
});

// [D]ELETE - Excluir um pedido
router.delete("/:id", async (req, res) => {
    const ambienteId = req.ambienteId;
    const { id } = req.params;
    try {
        let result = await pool.request()
            .input("ID", sql.Int, id)
            .input("AmbienteId", sql.Int, ambienteId)
            .execute("sp_ExcluirPedido");

        if (result.recordset[0].RowsAffected > 0) {
            res.json({ sucesso: true, mensagem: "Pedido excluído com sucesso!" });
        } else {
            res.status(404).json({ sucesso: false, mensagem: "Pedido não encontrado ou não pertence a este ambiente." });
        }
    } catch (err) {
        console.error("Erro /pedidos/:id (DELETE):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao excluir pedido." });
    }
});


// [C]REATE - Criar novo pedido
router.post("/", async (req, res) => {
    const ambienteId = req.ambienteId;
    const usuarioId = req.user.id; // Responsável é o usuário logado

    const {
        clienteId, status, itens,
        valorDesconto, valorFrete,
        formaPagamento, statusPagamento, tipoPedido
    } = req.body;

    if (!clienteId || !itens || itens.length === 0) {
        return res.status(400).json({ sucesso: false, mensagem: "Cliente e itens são obrigatórios." });
    }

    const transaction = pool.transaction();
    try {
        await transaction.begin();

        let valorSubTotalCalculado = 0;

        // 1. Inserir os itens do pedido E CALCULAR O SUBTOTAL
        for (const item of itens) {
            let produtoResult = await transaction.request()
                .input("produtoId", sql.Int, item.produtoId)
                .input("ambienteId", sql.Int, ambienteId)
                .query("SELECT preco FROM Produtos WHERE id = @produtoId AND ambienteId = @ambienteId");

            if (produtoResult.recordset.length === 0) {
                throw new Error(`Produto com ID ${item.produtoId} não encontrado.`);
            }
            const precoReal = produtoResult.recordset[0].preco;

            valorSubTotalCalculado += (precoReal * item.quantidade);
        }

        // 2. CALCULA O VALOR TOTAL (Cálculo seguro no Back-end)
        const vDesconto = parseFloat(valorDesconto) || 0;
        const vFrete = parseFloat(valorFrete) || 0;
        const vSubTotal = parseFloat(valorSubTotalCalculado);
        const valorTotalCalculado = (vSubTotal - vDesconto) + vFrete;

        // 3. Inserir o pedido principal
        let resultPedido = await transaction.request()
            .input("clienteId", sql.Int, clienteId)
            .input("status", sql.VarChar, status)
            .input("valorTotal", sql.Decimal(10, 2), valorTotalCalculado)
            .input("ambienteId", sql.Int, ambienteId)
            .input("usuarioId", sql.Int, usuarioId)
            .input("valorSubTotal", sql.Decimal(10, 2), vSubTotal)
            .input("valorDesconto", sql.Decimal(10, 2), vDesconto)
            .input("valorFrete", sql.Decimal(10, 2), vFrete)
            .input("formaPagamento", sql.VarChar, formaPagamento)
            .input("statusPagamento", sql.VarChar, statusPagamento || 'Pendente')
            .input("tipoPedido", sql.VarChar, tipoPedido)
            .query(`INSERT INTO Pedidos (
                        clienteId, status, valorTotal, dataPedido, ambienteId, usuarioId,
                        valorSubTotal, valorDesconto, valorFrete, formaPagamento, statusPagamento, tipoPedido
                    ) 
                    OUTPUT INSERTED.id 
                    VALUES (
                        @clienteId, @status, @valorTotal, GETDATE(), @ambienteId, @usuarioId,
                        @valorSubTotal, @valorDesconto, @valorFrete, @formaPagamento, @statusPagamento, @tipoPedido
                    )`);

        const pedidoId = resultPedido.recordset[0].id;

        // 4. Inserir os itens (agora que o PedidoID existe)
        for (const item of itens) {
            let produtoResult = await transaction.request()
                .input("produtoId", sql.Int, item.produtoId)
                .input("ambienteId", sql.Int, ambienteId)
                .query("SELECT preco FROM Produtos WHERE id = @produtoId AND ambienteId = @ambienteId");
            const precoReal = produtoResult.recordset[0].preco;

            await transaction.request()
                .input("pedidoId", sql.Int, pedidoId)
                .input("produtoId", sql.Int, item.produtoId)
                .input("quantidade", sql.Int, item.quantidade)
                .input("precoUnitario", sql.Decimal(10, 2), precoReal)
                .query("INSERT INTO PedidoItens (pedidoId, produtoId, quantidade, precoUnitario) VALUES (@pedidoId, @produtoId, @quantidade, @precoUnitario)");
        }

        await transaction.commit();
        res.status(201).json({ sucesso: true, mensagem: "Pedido criado com sucesso!", pedidoId: pedidoId });

    } catch (err) {
        console.error("Erro /pedidos (POST):", err);
        await transaction.rollback();
        res.status(500).json({ sucesso: false, mensagem: "Erro ao criar pedido: " + err.message });
    }
});


// [U]PDATE - Atualizar um pedido
router.put("/:id", async (req, res) => {
    const ambienteId = req.ambienteId;
    const { id } = req.params;

    const {
        clienteId, status, responsavelId, itens,
        valorDesconto, valorFrete,
        formaPagamento, statusPagamento, tipoPedido
    } = req.body;

    const transaction = pool.transaction();
    try {
        await transaction.begin();

        let valorSubTotalCalculado = 0;

        // 1. Excluir itens antigos
        await transaction.request()
            .input("id", sql.Int, id)
            .query("DELETE FROM PedidoItens WHERE pedidoId = @id");

        // 2. Reinserir os novos itens E CALCULAR O SUBTOTAL
        for (const item of itens) {
            let produtoResult = await transaction.request()
                .input("produtoId", sql.Int, item.produtoId)
                .input("ambienteId", sql.Int, ambienteId)
                .query("SELECT preco FROM Produtos WHERE id = @produtoId AND ambienteId = @ambienteId");

            if (produtoResult.recordset.length === 0) {
                throw new Error(`Produto com ID ${item.produtoId} não encontrado.`);
            }
            const precoReal = produtoResult.recordset[0].preco;

            valorSubTotalCalculado += (precoReal * item.quantidade);

            await transaction.request()
                .input("pedidoId", sql.Int, id)
                .input("produtoId", sql.Int, item.produtoId)
                .input("quantidade", sql.Int, item.quantidade)
                .input("precoUnitario", sql.Decimal(10, 2), precoReal)
                .query("INSERT INTO PedidoItens (pedidoId, produtoId, quantidade, precoUnitario) VALUES (@pedidoId, @produtoId, @quantidade, @precoUnitario)");
        }

        // 3. CALCULA O VALOR TOTAL (Cálculo seguro no Back-end)
        const vDesconto = parseFloat(valorDesconto) || 0;
        const vFrete = parseFloat(valorFrete) || 0;
        const vSubTotal = parseFloat(valorSubTotalCalculado);
        const valorTotalCalculado = (vSubTotal - vDesconto) + vFrete;

        // 4. Atualizar o pedido principal
        let updateResult = await transaction.request()
            .input("id", sql.Int, id)
            .input("clienteId", sql.Int, clienteId)
            .input("status", sql.VarChar, status)
            .input("valorTotal", sql.Decimal(10, 2), valorTotalCalculado)
            .input("ambienteId", sql.Int, ambienteId)
            .input("usuarioId", sql.Int, responsavelId)
            .input("valorSubTotal", sql.Decimal(10, 2), vSubTotal)
            .input("valorDesconto", sql.Decimal(10, 2), vDesconto)
            .input("valorFrete", sql.Decimal(10, 2), vFrete)
            .input("formaPagamento", sql.VarChar, formaPagamento)
            .input("statusPagamento", sql.VarChar, statusPagamento)
            .input("tipoPedido", sql.VarChar, tipoPedido)
            .query(`UPDATE Pedidos SET 
                        clienteId = @clienteId, 
                        status = @status, 
                        valorTotal = @valorTotal, 
                        usuarioId = @usuarioId,
                        valorSubTotal = @valorSubTotal,
                        valorDesconto = @valorDesconto,
                        valorFrete = @valorFrete,
                        formaPagamento = @formaPagamento,
                        statusPagamento = @statusPagamento,
                        tipoPedido = @tipoPedido
                    WHERE 
                        id = @id AND ambienteId = @ambienteId`);

        if (updateResult.rowsAffected[0] === 0) {
            throw new Error("Pedido não encontrado ou não pertence a este ambiente.");
        }

        await transaction.commit();
        res.json({ sucesso: true, mensagem: "Pedido atualizado com sucesso!" });

    } catch (err) {
        console.error("Erro /pedidos/:id (PUT):", err);
        await transaction.rollback();
        res.status(500).json({ sucesso: false, mensagem: "Erro ao atualizar pedido: " + err.message });
    }
});

module.exports = router;