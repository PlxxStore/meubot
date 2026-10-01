const crypto = require('crypto');

// ============================
// CONFIG
// ============================
const USUARIO = process.env.PAINEL_USUARIO || 'admin';
const SENHA = process.env.PAINEL_SENHA || 'admin';
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Sessões ativas (em memória — reinicia quando o bot reinicia)
const sessoes = new Map();

// Tentativas de login por IP
const tentativas = new Map();

// ============================
// GERAR TOKEN DE SESSÃO
// ============================
function gerarToken() {
    return crypto.randomBytes(32).toString('hex');
}

// ============================
// LOGIN
// ============================
function fazerLogin(usuario, senha, ip) {
    // Rate limit
    const agora = Date.now();
    const reg = tentativas.get(ip) || { count: 0, primeira: agora };

    if (agora - reg.primeira > 60000) {
        reg.count = 0;
        reg.primeira = agora;
    }

    reg.count++;
    tentativas.set(ip, reg);

    if (reg.count > 5) {
        return { sucesso: false, erro: 'Muitas tentativas. Aguarde 1 minuto.' };
    }

    // Comparação em tempo constante (evita timing attack)
    const usuarioOk = crypto.timingSafeEqual(
        Buffer.from(usuario.padEnd(64, ' ')),
        Buffer.from(USUARIO.padEnd(64, ' '))
    );

    const senhaOk = crypto.timingSafeEqual(
        Buffer.from(senha.padEnd(64, ' ')),
        Buffer.from(SENHA.padEnd(64, ' '))
    );

    if (!usuarioOk || !senhaOk) {
        return { sucesso: false, erro: 'Usuário ou senha inválidos.' };
    }

    // Cria sessão
    const token = gerarToken();
    const expiraEm = Date.now() + (24 * 60 * 60 * 1000); // 24h

    sessoes.set(token, {
        usuario: USUARIO,
        ip,
        criadaEm: Date.now(),
        expiraEm,
        csrf: crypto.randomBytes(16).toString('hex')
    });

    return { sucesso: true, token, csrf: sessoes.get(token).csrf };
}

// ============================
// VALIDAR SESSÃO
// ============================
function validarSessao(token) {
    if (!token) return null;
    const sessao = sessoes.get(token);
    if (!sessao) return null;
    if (Date.now() > sessao.expiraEm) {
        sessoes.delete(token);
        return null;
    }
    return sessao;
}

// ============================
// LOGOUT
// ============================
function fazerLogout(token) {
    sessoes.delete(token);
}

// ============================
// MIDDLEWARE DE AUTENTICAÇÃO
// ============================
function middlewareAuth(req, res, next) {
    const token = req.cookies?.painel_token || req.headers['x-painel-token'];
    const sessao = validarSessao(token);

    if (!sessao) {
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({ error: 'Não autenticado.' });
        }
        return res.redirect('/painel/login');
    }

    // Para requisições de escrita, valida CSRF
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        const csrf = req.headers['x-csrf-token'];
        if (!csrf || csrf !== sessao.csrf) {
            return res.status(403).json({ error: 'Token CSRF inválido.' });
        }
    }

    req.sessao = sessao;
    req.token = token;
    next();
}

// ============================
// EXPORTAR
// ============================
module.exports = {
    fazerLogin,
    validarSessao,
    fazerLogout,
    middlewareAuth,
    sessoes
};