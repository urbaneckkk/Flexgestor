// authMiddleware.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ sucesso: false, mensagem: "Token não fornecido." });
    }

    // Verifica se o token é válido
    jwt.verify(token, JWT_SECRET, (err, tokenPayload) => {
        if (err) {
            return res.status(403).json({ sucesso: false, mensagem: "Token inválido." });
        }

        // ATUALIZADO: Extrai o ambienteId do token
        // tokenPayload é { id, usuario, ambienteId, ambienteNome }
        if (!tokenPayload.ambienteId) {
            return res.status(403).json({ sucesso: false, mensagem: "Token inválido (sem ambiente)." });
        }

        // Adiciona dados do usuário e do ambiente ao 'req'
        req.user = { id: tokenPayload.id, usuario: tokenPayload.usuario };
        req.ambienteId = tokenPayload.ambienteId;
        req.ambienteNome = tokenPayload.ambienteNome;

        next();
    });
}

module.exports = authMiddleware;

