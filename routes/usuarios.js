// routes/usuarios.js
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

// [R]EAD - Listar Usuários do Ambiente
router.get("/", async (req, res) => {
    const ambienteId = req.ambienteId; // Pega do middleware
    const { filtro } = req.query;
    try {
        let result = await pool.request()
            .input("AmbienteId", sql.Int, ambienteId)
            .input("Filtro", sql.VarChar, filtro || null)
            .execute("sp_ListarUsuarios");
        res.json(result.recordset);
    } catch (err) {
        console.error("Erro /usuarios (GET):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar usuários." });
    }
});

// [R]EAD - Buscar ambientes associados a UM usuário
router.get("/:id/ambientes", async (req, res) => {
    const { id } = req.params;
    try {
        let result = await pool.request()
            .input("UsuarioId", sql.Int, id)
            .query("SELECT ambienteId FROM UsuarioAmbiente WHERE usuarioId = @UsuarioId");

        // Retorna um array simples de IDs: [1, 2, 5]
        res.json(result.recordset.map(r => r.ambienteId));

    } catch (err) {
        console.error("Erro /usuarios/:id/ambientes (GET):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar ambientes do usuário." });
    }
});


// [C]REATE - Criar novo Usuário (Usa SP com HASH)
router.post("/", async (req, res) => {
    const { nomeUsuario, nomeCompleto, senha, isAdmin, idAmbienteCriacao, ambientesAssociados } = req.body;

    if (!nomeUsuario || !senha || !idAmbienteCriacao) {
        return res.status(400).json({ sucesso: false, mensagem: "Nome de usuário, senha e Ambiente de Criação são obrigatórios." });
    }

    const transaction = pool.transaction();
    try {
        await transaction.begin();

        // 1. Criar o usuário principal (SP agora faz o HASH)
        let resultUsuario = await transaction.request()
            .input("Usuario", sql.VarChar, nomeUsuario)
            .input("Senha", sql.VarChar, senha) // Passa a senha em texto puro para a SP
            .input("NomeCompleto", sql.VarChar, nomeCompleto)
            .input("IsAdmin", sql.Bit, isAdmin ? 1 : 0)
            .input("idAmbienteCriacao", sql.Int, idAmbienteCriacao)
            .execute("sp_CriarUsuario"); // Esta SP DEVE usar HASHBYTES

        const spResult = resultUsuario.recordset[0];
        if (!spResult.Sucesso) {
            await transaction.rollback();
            return res.status(400).json({ sucesso: false, mensagem: spResult.Mensagem });
        }

        const novoId = spResult.NovoId;

        // 2. Associar os ambientes (se houver)
        if (ambientesAssociados && ambientesAssociados.length > 0) {
            for (const ambId of ambientesAssociados) {
                await transaction.request()
                    .input("UsuarioId", sql.Int, novoId)
                    .input("AmbienteId", sql.Int, ambId)
                    .query("INSERT INTO UsuarioAmbiente (usuarioId, ambienteId) VALUES (@UsuarioId, @AmbienteId)");
            }
        }

        await transaction.commit();
        res.status(201).json({ sucesso: true, mensagem: spResult.Mensagem, novoId: novoId });

    } catch (err) {
        await transaction.rollback();
        console.error("Erro /usuarios (POST):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao criar usuário: " + err.message });
    }
});

// [U]PDATE - Atualizar um Usuário (Usa SP com HASH)
router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { nomeCompleto, isAdmin, senha, idAmbienteCriacao, ambientesAssociados } = req.body;

    if (!idAmbienteCriacao) {
        return res.status(400).json({ sucesso: false, mensagem: "Ambiente de Criação é obrigatório." });
    }

    const transaction = pool.transaction();
    try {
        await transaction.begin();

        // 1. Atualizar dados principais (SP agora faz o HASH se a senha for passada)
        let resultUpdate = await transaction.request()
            .input("ID", sql.Int, id)
            .input("NomeCompleto", sql.VarChar, nomeCompleto)
            .input("IsAdmin", sql.Bit, isAdmin ? 1 : 0)
            .input("Senha", sql.VarChar, (senha && senha.length > 0) ? senha : null) // Passa senha para a SP
            .execute("sp_AtualizarUsuario"); // Esta SP DEVE usar HASHBYTES

        if (resultUpdate.recordset[0].RowsAffected === 0) {
            await transaction.rollback();
            return res.status(404).json({ sucesso: false, mensagem: "Usuário não encontrado." });
        }

        // 2. Atualizar o Ambiente de Criação (Não está na SP de update)
        await transaction.request()
            .input("ID", sql.Int, id)
            .input("IdAmbienteCriacao", sql.Int, idAmbienteCriacao)
            .query("UPDATE Usuarios SET idAmbienteCriacao = @IdAmbienteCriacao WHERE id = @ID");

        // 3. Limpar associações de ambientes antigas
        await transaction.request()
            .input("UsuarioId", sql.Int, id)
            .query("DELETE FROM UsuarioAmbiente WHERE usuarioId = @UsuarioId");

        // 4. Reinserir as novas associações
        if (ambientesAssociados && ambientesAssociados.length > 0) {
            for (const ambId of ambientesAssociados) {
                await transaction.request()
                    .input("UsuarioId", sql.Int, id)
                    .input("AmbienteId", sql.Int, ambId)
                    .query("INSERT INTO UsuarioAmbiente (usuarioId, ambienteId) VALUES (@UsuarioId, @AmbienteId)");
            }
        }

        await transaction.commit();
        res.json({ sucesso: true, mensagem: "Usuário atualizado com sucesso!" });

    } catch (err) {
        await transaction.rollback();
        console.error("Erro /usuarios/:id (PUT):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao atualizar usuário: " + err.message });
    }
});

// [D]ELETE - Excluir um Usuário (MODIFICADO)
router.delete("/:id", async (req, res) => {
    const { id } = req.params;

    if (req.user.id == id) {
        return res.status(400).json({ sucesso: false, mensagem: "Você não pode excluir a si mesmo." });
    }

    const transaction = pool.transaction();
    try {
        await transaction.begin();

        // 1. Excluir vínculos N-N
        await transaction.request()
            .input("UsuarioId", sql.Int, id)
            .query("DELETE FROM UsuarioAmbiente WHERE usuarioId = @UsuarioId");

        // 2. Excluir o usuário (Precisa de uma SP sp_ExcluirUsuario)
        // Vou assumir que ela existe, como no código anterior
        let result = await transaction.request()
            .input("ID", sql.Int, id)
            .execute("sp_ExcluirUsuario"); // sp_ExcluirUsuario lida com a deleção

        if (result.recordset[0].RowsAffected === 0) {
            await transaction.rollback();
            return res.status(404).json({ sucesso: false, mensagem: "Usuário não encontrado." });
        }

        await transaction.commit();
        res.json({ sucesso: true, mensagem: "Usuário excluído com sucesso!" });

    } catch (err) {
        await transaction.rollback();
        if (err.number === 547) {
            return res.status(400).json({ sucesso: false, mensagem: "Erro: Não é possível excluir este usuário pois ele está vinculado a outros registros (ex: pedidos)." });
        }
        console.error("Erro /usuarios/:id (DELETE):", err);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao excluir usuário: " + err.message });
    }
});


module.exports = router;