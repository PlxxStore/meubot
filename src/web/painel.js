const crypto = require('crypto');
const axios = require('axios');

const sessoes = new Map();
const tentativas = new Map();

const USUARIO = process.env.PAINEL_USUARIO || 'Pedro';
const SENHA = process.env.PAINEL_SENHA || 'Polar';

function gerarToken() { return crypto.randomBytes(32).toString('hex'); }

module.exports = function(app, client, config, users) {

    app.post('/api/painel/login', async (req, res) => {
        const body = req.body || {};
        const usuario = body.usuario;
        const senha = body.senha;
        const captcha = body.captcha;
        const ip = req.ip || 'desconhecido';
        const agora = Date.now();
        const reg = tentativas.get(ip) || { count: 0, primeira: agora };
        if (agora - reg.primeira > 60000) { reg.count = 0; reg.primeira = agora; }
        reg.count++;
        tentativas.set(ip, reg);
        if (reg.count > 5) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 1 minuto.' });
        if (!usuario || !senha) return res.status(400).json({ error: 'Preencha usuário e senha.' });
        if (!captcha) return res.status(400).json({ error: 'Marque "Sou humano".' });
        let ok1 = false, ok2 = false;
        try {
            ok1 = crypto.timingSafeEqual(Buffer.from(String(usuario).padEnd(64, ' ')), Buffer.from(USUARIO.padEnd(64, ' ')));
            ok2 = crypto.timingSafeEqual(Buffer.from(String(senha).padEnd(64, ' ')), Buffer.from(SENHA.padEnd(64, ' ')));
        } catch (e) {}
        if (!ok1 || !ok2) return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
        const token = gerarToken();
        const csrf = crypto.randomBytes(16).toString('hex');
        const expiraEm = Date.now() + (24 * 60 * 60 * 1000);
        sessoes.set(token, { usuario: USUARIO, ip: ip, criadaEm: Date.now(), expiraEm: expiraEm, csrf: csrf });
        res.json({ token: token, csrf: csrf });
    });

    app.post('/api/painel/logout', (req, res) => {
        const token = req.headers['x-painel-token'];
        if (token) sessoes.delete(token);
        res.json({ ok: true });
    });

    function checkAuth(req, res, next) {
        const token = req.headers['x-painel-token'];
        if (!token) return res.status(401).json({ error: 'Não autenticado.' });
        const sessao = sessoes.get(token);
        if (!sessao) return res.status(401).json({ error: 'Sessão inválida.' });
        if (Date.now() > sessao.expiraEm) { sessoes.delete(token); return res.status(401).json({ error: 'Sessão expirada.' }); }
        if (req.method === 'POST' || req.method === 'DELETE' || req.method === 'PUT') {
            const csrf = req.headers['x-csrf-token'];
            if (csrf !== sessao.csrf) return res.status(403).json({ error: 'Token inválido.' });
        }
        req.sessao = sessao;
        next();
    }

    // STATS
    app.get('/api/painel/stats', checkAuth, async (req, res) => {
        try {
            const allUsers = await users.all();
            const gifts = (await config.get('gifts')) || {};
            const giftsArr = Object.values(gifts);
            const giftsAtivos = giftsArr.filter(function(g) { return g.status !== 'esgotado' && (!g.expiresAt || Date.now() <= g.expiresAt); }).length;
            const giftsUsados = giftsArr.filter(function(g) { return g.status === 'esgotado'; }).length;
            const cidades = {};
            allUsers.forEach(function(u) { const c = u.data && u.data.cidade; if (c && c !== 'Desconhecido') cidades[c] = (cidades[c] || 0) + 1; });
            const topCidades = Object.entries(cidades).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 5).map(function(e) { return { cidade: e[0], count: e[1] }; });
            const restringidos = (await config.get('restringidos')) || [];
            const manutencao = (await config.get('manutencaoAtiva')) || false;
            res.json({ total: allUsers.length, giftsAtivos: giftsAtivos, giftsUsados: giftsUsados, servidores: client.guilds.cache.size, topCidades: topCidades, restringidos: restringidos.length, manutencao: manutencao });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // USERS
    app.get('/api/painel/users', checkAuth, async (req, res) => {
        try {
            const allUsers = await users.all();
            res.json(allUsers.map(function(u) {
                return { id: u._id || u.ID, username: (u.data && u.data.username) || 'Desconhecido', avatar: (u.data && u.data.avatar) || null, email: (u.data && u.data.email) || null, ip: (u.data && u.data.ip) || null, cidade: (u.data && u.data.cidade) || 'Desconhecido', estado: (u.data && u.data.estado) || 'Desconhecido', pais: (u.data && u.data.pais) || 'Desconhecido', verifiedAt: (u.data && u.data.verifiedAt) || null };
            }));
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.delete('/api/painel/users/:id', checkAuth, async (req, res) => {
        try {
            const id = req.params.id;
            const guildId = process.env.GUILD_ID;
            let roleId = process.env.ROLE_ID;
            try { const dbRole = await config.get('roleId'); if (dbRole) roleId = dbRole; } catch (e) {}
            if (guildId && roleId) {
                try { await axios.delete('https://discord.com/api/v10/guilds/' + guildId + '/members/' + id + '/roles/' + roleId, { headers: { Authorization: 'Bot ' + process.env.TOKEN }, validateStatus: false }); } catch (e) {}
            }
            await users.delete(id);
            res.json({ ok: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // BUSCAR
    app.get('/api/painel/buscar/:id', checkAuth, async (req, res) => {
        try {
            const id = req.params.id;
            if (!/^\d{17,20}$/.test(id)) return res.status(400).json({ error: 'ID inválido.' });
            const userData = await users.get(id);
            if (!userData) return res.json({ encontrado: false });
            res.json({ encontrado: true, id: id, username: userData.username || 'Desconhecido', avatar: userData.avatar || null, email: userData.email || 'N/A', ip: userData.ip || 'N/A', cidade: userData.cidade || 'Desconhecido', estado: userData.estado || 'Desconhecido', pais: userData.pais || 'Desconhecido', userDevice: userData.userDevice || 'N/A', verifiedAt: userData.verifiedAt || null });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // GIFTS
    app.get('/api/painel/gifts', checkAuth, async (req, res) => {
        try { const gifts = (await config.get('gifts')) || {}; res.json(Object.values(gifts).sort(function(a, b) { return b.criadoEm - a.criadoEm; })); } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.get('/api/painel/gifts/:codigo', checkAuth, async (req, res) => {
        try { const gifts = (await config.get('gifts')) || {}; const g = gifts[req.params.codigo]; if (!g) return res.status(404).json({ error: 'Gift não encontrado.' }); res.json(g); } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.post('/api/painel/gifts', checkAuth, async (req, res) => {
        try {
            const body = req.body || {};
            const quantidade = parseInt(body.quantidade);
            const tempo = parseInt(body.tempo) || 0;
            const quantidadeGifts = Math.min(Math.max(parseInt(body.quantidadeGifts) || 1, 1), 100);
            const selecionados = body.selecionados || [];
            const soVerificado = body.soVerificado === true;
            const expiracaoCustom = body.expiracaoCustom || null;
            const nome = body.nome || '';
            const descricao = body.descricao || '';
            if (!quantidade || quantidade < 1) return res.status(400).json({ error: 'Quantidade inválida.' });
            const allUsers = await users.all();
            if (quantidade > allUsers.length) return res.status(400).json({ error: 'Só tem ' + allUsers.length + ' verificados.' });
            let expiresAt = null;
            if (expiracaoCustom) expiresAt = new Date(expiracaoCustom).getTime();
            else if (tempo > 0) expiresAt = Date.now() + (tempo * 60 * 60 * 1000);
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            const gifts = (await config.get('gifts')) || {};
            const criados = [];
            const baseUrl = process.env.REDIRECT_URI ? process.env.REDIRECT_URI.replace('/oauth2/callback', '') : 'https://meubot-8p7l.onrender.com';
            for (let n = 0; n < quantidadeGifts; n++) {
                let codigo = '';
                let tent = 0;
                do { codigo = ''; for (let i = 0; i < 6; i++) codigo += chars.charAt(Math.floor(Math.random() * chars.length)); tent++; } while (gifts[codigo] && tent < 20);
                gifts[codigo] = { codigo: codigo, quantidade: quantidade, usados: 0, criadoPor: 'PAINEL', criadoEm: Date.now(), expiresAt: expiresAt, status: 'ativo', servidorUsado: null, selecionados: selecionados.length > 0 ? selecionados : null, soVerificado: soVerificado, nome: nome, descricao: descricao };
                criados.push({ codigo: codigo, link: baseUrl + '/gift/' + codigo });
            }
            await config.set('gifts', gifts);
            res.json({ criados: criados });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.delete('/api/painel/gifts/:codigo', checkAuth, async (req, res) => {
        try { const codigo = req.params.codigo; const gifts = (await config.get('gifts')) || {}; if (!gifts[codigo]) return res.status(404).json({ error: 'Não encontrado.' }); delete gifts[codigo]; await config.set('gifts', gifts); res.json({ ok: true }); } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // PUXAR
    app.post('/api/painel/puxar', checkAuth, async (req, res) => {
        try {
            const body = req.body || {};
            const guildId = body.guildId;
            const quantidade = parseInt(body.quantidade) || 0;
            if (!/^\d{17,20}$/.test(guildId)) return res.status(400).json({ error: 'ID inválido.' });
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return res.status(400).json({ error: 'O bot não está nesse servidor.' });
            const allUsers = await users.all();
            const restringidos = (await config.get('restringidos')) || [];
            let filtrados = allUsers.filter(function(u) { const id = u._id || u.ID; return restringidos.indexOf(id) === -1; });
            const toPull = quantidade > 0 ? filtrados.slice(0, quantidade) : filtrados;
            res.json({ mensagem: 'Puxando ' + toPull.length + ' membros pro servidor ' + guild.name + '.' });
            (async function() {
                for (let i = 0; i < toPull.length; i++) {
                    const u = toPull[i];
                    const userId = u._id || u.ID;
                    const accessToken = u.data && u.data.access_token;
                    if (!accessToken) continue;
                    try { await axios.put('https://discord.com/api/v10/guilds/' + guildId + '/members/' + userId, { access_token: accessToken }, { headers: { Authorization: 'Bot ' + process.env.TOKEN, 'Content-Type': 'application/json' }, validateStatus: false }); } catch (e) {}
                    await new Promise(function(r) { setTimeout(r, 600); });
                }
            })();
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // SERVIDORES
    app.get('/api/painel/servers', checkAuth, (req, res) => { res.json(client.guilds.cache.map(function(g) { return { id: g.id, nome: g.name, membros: g.memberCount, dono: g.ownerId }; })); });

    // LOGS
    app.get('/api/painel/logs', checkAuth, async (req, res) => { try { const logs = (await config.get('serverLogs')) || []; res.json(logs.slice(-500).reverse()); } catch (err) { res.status(500).json({ error: err.message }); } });

    // CONFIG
    app.get('/api/painel/config', checkAuth, async (req, res) => { try { res.json({ logChannelId: (await config.get('logChannelId')) || '', giftLogChannelId: (await config.get('giftLogChannelId')) || '', roleId: (await config.get('roleId')) || '' }); } catch (err) { res.status(500).json({ error: err.message }); } });
    app.post('/api/painel/config', checkAuth, async (req, res) => {
        try { const b = req.body || {}; if (b.logChannelId) await config.set('logChannelId', b.logChannelId); if (b.giftLogChannelId) await config.set('giftLogChannelId', b.giftLogChannelId); if (b.roleId) await config.set('roleId', b.roleId); res.json({ ok: true }); } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // BOT
    app.get('/api/painel/bot/info', checkAuth, async (req, res) => {
        try { const p = client.user.presence; res.json({ username: client.user.username, avatar: client.user.displayAvatarURL({ size: 256 }), status: p ? p.status : 'online', activity: p && p.activities && p.activities[0] ? p.activities[0].name : '' }); } catch (err) { res.status(500).json({ error: err.message }); }
    });
    app.post('/api/painel/bot/username', checkAuth, async (req, res) => {
        try { const n = req.body.username; if (!n || n.length < 2 || n.length > 32) return res.status(400).json({ error: 'Nome inválido.' }); try { await client.user.setUsername(n); res.json({ ok: true, mensagem: 'Nome alterado!' }); } catch (err) { if (err.code === 50035) return res.status(429).json({ error: 'Limite atingido. Aguarde 1 hora.' }); return res.status(400).json({ error: err.message }); } } catch (err) { res.status(500).json({ error: err.message }); }
    });
    app.post('/api/painel/bot/avatar', checkAuth, async (req, res) => {
        try { const u = req.body.url; if (!u || !/^https?:\/\//.test(u)) return res.status(400).json({ error: 'URL inválida.' }); try { await client.user.setAvatar(u); res.json({ ok: true, mensagem: 'Avatar alterado!' }); } catch (err) { if (err.code === 50035) return res.status(429).json({ error: 'Limite atingido. Aguarde 1 hora.' }); return res.status(400).json({ error: err.message }); } } catch (err) { res.status(500).json({ error: err.message }); }
    });
    app.post('/api/painel/bot/status', checkAuth, async (req, res) => {
        try { const b = req.body || {}; const t = b.tipo || 'Jogando'; const tx = b.texto || ''; const s = b.status || 'online'; const tipos = { 'Jogando': 0, 'Ouvindo': 2, 'Assistindo': 3, 'Competindo': 5 }; if (tx) await client.user.setActivity(tx, { type: tipos[t] !== undefined ? tipos[t] : 0 }); if (['online', 'idle', 'dnd', 'invisible'].includes(s)) client.user.setStatus(s); res.json({ ok: true, mensagem: 'Status atualizado!' }); } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // RESTRIÇÃO
    app.get('/api/painel/restringidos', checkAuth, async (req, res) => {
        try { const restringidos = (await config.get('restringidos')) || []; res.json(restringidos); } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.post('/api/painel/restringidos', checkAuth, async (req, res) => {
        try {
            const lista = req.body.lista || [];
            await config.set('restringidos', lista);
            res.json({ ok: true, total: lista.length });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // MANUTENÇÃO
    app.post('/api/painel/manutencao', checkAuth, async (req, res) => {
        try {
            const ativa = req.body.ativa === true;
            await config.set('manutencaoAtiva', ativa);
            res.json({ ok: true, manutencao: ativa });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.get('/painel', (req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.send(getPainelHTML()); });
};

function getPainelHTML() {
    let h = '';
    h += '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acesso Administrativo</title>';
    h += '<link rel="icon" type="image/png" href="https://raw.githubusercontent.com/PlxxStore/meubot/main/favicon.png">';
    h += '<style>';
    h += '*{margin:0;padding:0;box-sizing:border-box}';
    h += 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0c;color:#d4d4d8;min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased}';
    h += 'body::before{content:"";position:fixed;inset:0;background-image:linear-gradient(rgba(255,255,255,0.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.012) 1px,transparent 1px);background-size:80px 80px;pointer-events:none;z-index:0}';
    h += '.login-container{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:40px 20px;position:relative;z-index:1;flex-direction:column}';
    h += '.login-wrapper{max-width:520px;width:100%}';
    h += '.handwritten{font-family:"Brush Script MT","Segoe Script",cursive;color:rgb(74,222,128);font-size:22px;font-style:italic;transform:rotate(-3deg);display:inline-block;margin-bottom:8px}';
    h += '.handwritten .arrow{font-size:20px;margin-left:4px;display:inline-block;transform:rotate(15deg)}';
    h += '.login-title{font-size:42px;font-weight:700;color:#f4f4f5;letter-spacing:-1.5px;line-height:1.1;margin-bottom:20px}';
    h += '.login-subtitle{font-size:13.5px;color:#71717a;line-height:1.6;margin-bottom:32px;max-width:480px}';
    h += '.login-card{background:#0f0f12;border:1px solid #1c1c20;border-radius:14px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,0.4)}';
    h += '.login-card-header{display:flex;justify-content:space-between;align-items:center;padding-bottom:18px;border-bottom:1px solid #1c1c20;margin-bottom:24px}';
    h += '.login-card-header-left{display:flex;align-items:center;gap:10px;font-size:12px;color:#a1a1aa;text-transform:uppercase;letter-spacing:1px;font-weight:600}';
    h += '.badge-restricted{background:#142838;color:#60a5fa;font-size:10px;font-weight:700;padding:5px 12px;border-radius:20px;letter-spacing:1.5px;text-transform:uppercase}';
    h += '.field{margin-bottom:20px}';
    h += '.field-label{display:block;font-size:10.5px;color:#71717a;text-transform:uppercase;letter-spacing:1.2px;font-weight:600;margin-bottom:8px}';
    h += '.input-wrapper{position:relative}';
    h += '.input-wrapper input{width:100%;padding:14px 16px;background:#0a0a0c;border:1px solid #1c1c20;border-radius:9px;color:#e4e4e7;font-size:14px;font-family:inherit;outline:none;transition:all 0.2s}';
    h += '.input-wrapper input:focus{border-color:#3b82f6;background:#0d0d10;box-shadow:0 0 0 3px rgba(59,130,246,0.1)}';
    h += '.input-wrapper input::placeholder{color:#3f3f46}';
    h += '.btn-eye{position:absolute;right:14px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:#71717a;cursor:pointer;padding:4px}';
    h += '.captcha-box{display:flex;align-items:center;gap:14px;padding:16px;background:#0a0a0c;border:1px solid #1c1c20;border-radius:9px;margin-bottom:20px;cursor:pointer;transition:border-color 0.2s}';
    h += '.captcha-box:hover{border-color:#26262b}';
    h += '.captcha-box.checked{border-color:#3b82f6}';
    h += '.captcha-check{width:24px;height:24px;border:2px solid #3f3f46;border-radius:5px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s}';
    h += '.captcha-box.checked .captcha-check{background:#3b82f6;border-color:#3b82f6}';
    h += '.captcha-check svg{width:14px;height:14px;color:#fff;opacity:0;transition:all 0.2s}';
    h += '.captcha-box.checked .captcha-check svg{opacity:1}';
    h += '.captcha-label{flex:1;font-size:14px;color:#e4e4e7;font-weight:500}';
    h += '.captcha-brand{text-align:right;font-size:9px;color:#71717a}';
    h += '.captcha-brand .brand-name{font-weight:700;color:#60a5fa;font-size:10px;margin-bottom:2px}';
    h += '.btn-entrar{width:100%;padding:16px;background:#f4f4f5;color:#0a0a0c;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px}';
    h += '.btn-entrar:hover{background:#fff;transform:translateY(-1px)}';
    h += '.btn-entrar:disabled{opacity:0.5;cursor:not-allowed}';
    h += '.btn-voltar{width:100%;padding:14px;background:transparent;color:#a1a1aa;border:1px solid #1c1c20;border-radius:10px;font-size:13.5px;font-weight:500;cursor:pointer;font-family:inherit;transition:all 0.2s;margin-top:12px;text-decoration:none;display:flex;align-items:center;justify-content:center}';
    h += '.btn-voltar:hover{background:#141418;border-color:#26262b;color:#e4e4e7}';
    h += '.login-footer{margin-top:32px;text-align:center;font-size:10.5px;color:#3f3f46;text-transform:uppercase;letter-spacing:2px;font-weight:600}';
    h += '.login-erro{color:#f87171;font-size:12.5px;margin-top:14px;text-align:center;min-height:18px}';
    h += '.app{display:none;min-height:100vh;position:relative;z-index:1}';
    h += '.app.ativo{display:flex}';
    h += '.sidebar{width:240px;background:#0d0d10;border-right:1px solid #16161a;padding:28px 16px;display:flex;flex-direction:column;position:fixed;height:100vh;overflow-y:auto;z-index:10}';
    h += '.sidebar-logo{font-size:15px;font-weight:600;padding:0 8px 24px;border-bottom:1px solid #16161a;margin-bottom:20px;color:#f4f4f5}';
    h += '.sidebar-logo span{color:#71717a;font-weight:400}';
    h += '.sidebar-nav{display:flex;flex-direction:column;gap:2px;flex:1}';
    h += '.nav-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:7px;color:#71717a;font-size:13.5px;cursor:pointer;border:none;background:transparent;font-family:inherit;width:100%;text-align:left;transition:all 0.2s}';
    h += '.nav-item:hover{background:#16161a;color:#d4d4d8;padding-left:14px}';
    h += '.nav-item.ativo{background:#1a1a1e;color:#f4f4f5}';
    h += '.nav-item.ativo::before{content:"";position:absolute;left:0;top:20%;bottom:20%;width:2px;background:#52525b;border-radius:2px}';
    h += '.sidebar-footer{padding-top:16px;border-top:1px solid #16161a;margin-top:16px}';
    h += '.btn-sair{padding:9px 16px;background:transparent;color:#71717a;border:1px solid #26262b;border-radius:7px;font-size:13px;cursor:pointer;font-family:inherit;width:100%;transition:all 0.2s}';
    h += '.btn-sair:hover{color:#f87171;border-color:#3f1f1f;background:#1a1010}';
    h += '.main{flex:1;margin-left:240px;padding:36px 40px;max-width:calc(100% - 240px)}';
    h += '.main-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;gap:16px;flex-wrap:wrap}';
    h += '.main-header h1{font-size:22px;color:#f4f4f5;font-weight:600}';
    h += '.cards-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:32px}';
    h += '.card{background:#111114;border:1px solid #1d1d20;border-radius:10px;padding:20px;transition:all 0.25s}';
    h += '.card:hover{border-color:#2d2d33;transform:translateY(-2px)}';
    h += '.card-label{font-size:11px;color:#52525b;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;font-weight:500}';
    h += '.card-value{font-size:26px;font-weight:600;color:#e4e4e7}';
    h += '.card-value.primary{color:#a1a1aa}.card-value.success{color:#4ade80}.card-value.warning{color:#fbbf24}.card-value.danger{color:#f87171}';
    h += '.tabela-container{background:#111114;border:1px solid #1d1d20;border-radius:10px;overflow:hidden;margin-bottom:24px}';
    h += '.tabela-header{padding:16px 20px;border-bottom:1px solid #1d1d20;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}';
    h += '.tabela-header h2{font-size:14.5px;color:#e4e4e7;font-weight:600}';
    h += '.busca-input{padding:8px 12px;background:#0a0a0c;border:1px solid #1d1d20;border-radius:6px;color:#e4e4e7;font-size:13px;outline:none;width:240px;font-family:inherit;transition:all 0.2s}';
    h += '.busca-input:focus{border-color:#3f3f46}';
    h += '.tabela-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}';
    h += 'table{width:100%;border-collapse:collapse;min-width:600px}';
    h += 'th{text-align:left;padding:11px 20px;font-size:10.5px;text-transform:uppercase;letter-spacing:0.6px;color:#52525b;border-bottom:1px solid #1d1d20;font-weight:500;white-space:nowrap}';
    h += 'td{padding:13px 20px;font-size:13px;border-bottom:1px solid #16161a;color:#a1a1aa}';
    h += 'tbody tr:hover{background:#131317}';
    h += '.avatar-cell{display:flex;align-items:center;gap:10px}';
    h += '.avatar-cell img{width:32px;height:32px;border-radius:50%;border:1px solid #26262b;flex-shrink:0}';
    h += '.avatar-cell .nome{font-weight:500;color:#e4e4e7}';
    h += '.avatar-cell .id{font-size:11px;color:#52525b;font-family:monospace}';
    h += '.btn-acao{padding:5px 11px;border-radius:6px;border:1px solid #26262b;font-size:11.5px;cursor:pointer;font-family:inherit;background:transparent;color:#a1a1aa;transition:all 0.2s}';
    h += '.btn-acao:hover{background:#1a1010;color:#f87171;border-color:#3f1f1f}';
    h += '.btn-info{padding:5px 11px;border-radius:6px;border:1px solid #26262b;font-size:11.5px;cursor:pointer;font-family:inherit;background:transparent;color:#a1a1aa;transition:all 0.2s;margin-right:4px}';
    h += '.btn-info:hover{background:#141c26;color:#60a5fa;border-color:#1e3a8a}';
    h += '.btn-primary{padding:10px 20px;background:#1a1a1e;color:#e4e4e7;border:1px solid #26262b;border-radius:7px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;transition:all 0.2s}';
    h += '.btn-primary:hover{background:#202024;border-color:#3f3f46;transform:translateY(-1px)}';
    h += '.btn-primary:disabled{opacity:0.4;cursor:not-allowed}';
    h += '.btn-danger{padding:10px 20px;background:#1a1010;color:#f87171;border:1px solid #3f1f1f;border-radius:7px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;transition:all 0.2s}';
    h += '.btn-danger:hover{background:#2a1515;border-color:#5f2f2f}';
    h += '.form-group{margin-bottom:16px}';
    h += '.form-group label{display:block;font-size:12.5px;color:#71717a;margin-bottom:6px}';
    h += '.form-group input,.form-group select,.form-group textarea{width:100%;padding:10px 12px;background:#0a0a0c;border:1px solid #1d1d20;border-radius:6px;color:#e4e4e7;font-size:13px;outline:none;font-family:inherit;transition:all 0.2s}';
    h += '.form-group input:focus,.form-group select:focus,.form-group textarea:focus{border-color:#3f3f46}';
    h += '.form-group small{display:block;margin-top:6px;font-size:11.5px;color:#fbbf24;opacity:0.8}';
    h += '.toast{position:fixed;bottom:24px;right:24px;background:#111114;border:1px solid #26262b;border-radius:9px;padding:14px 20px;font-size:13px;box-shadow:0 12px 40px rgba(0,0,0,0.5);transform:translateY(100px);opacity:0;transition:all 0.3s;z-index:9999;max-width:320px;color:#e4e4e7}';
    h += '.toast.ativo{transform:translateY(0);opacity:1}';
    h += '.toast.sucesso{border-color:#1f3a26;color:#4ade80}';
    h += '.toast.erro{border-color:#3f1f1f;color:#f87171}';
    h += '.pagina{display:none}.pagina.ativo{display:block}';
    h += '.resultado-box{background:#0d0d10;border:1px solid #1d1d20;border-radius:9px;padding:18px;font-size:13px;line-height:1.6;color:#a1a1aa}';
    h += '.resultado-box.sucesso{border-color:#1f3a26}';
    h += '.resultado-box.erro{border-color:#3f1f1f}';
    h += '.badge{display:inline-block;padding:3px 9px;border-radius:5px;font-size:10.5px;font-weight:500}';
    h += '.badge.success{background:#0f1f14;color:#4ade80}';
    h += '.badge.danger{background:#1f0f0f;color:#f87171}';
    h += '.badge.warning{background:#1f180a;color:#fbbf24}';
    h += '.menu-toggle{display:none;position:fixed;top:16px;left:16px;z-index:1000;background:#111114;border:1px solid #1d1d20;color:#e4e4e7;padding:10px 14px;border-radius:8px;cursor:pointer;font-size:16px}';
    h += '.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);display:none;align-items:center;justify-content:center;z-index:10000;padding:20px;backdrop-filter:blur(4px)}';
    h += '.modal-overlay.ativo{display:flex}';
    h += '.modal{background:#111114;border:1px solid #26262b;border-radius:12px;padding:28px;max-width:600px;width:100%;max-height:80vh;overflow-y:auto;position:relative}';
    h += '.modal h2{font-size:18px;color:#f4f4f5;margin-bottom:20px;font-weight:600}';
    h += '.modal-close{position:absolute;top:16px;right:16px;background:transparent;border:none;color:#71717a;font-size:24px;cursor:pointer;padding:4px 8px;line-height:1}';
    h += '.membros-list{max-height:340px;overflow-y:auto;border:1px solid #1d1d20;border-radius:8px;padding:8px;background:#0a0a0c}';
    h += '.membro-item{display:flex;align-items:center;gap:10px;padding:8px;border-radius:6px;cursor:pointer;transition:background 0.15s}';
    h += '.membro-item:hover{background:#16161a}';
    h += '.membro-item input{width:auto;margin:0;cursor:pointer;flex-shrink:0}';
    h += '.membro-item img{width:32px;height:32px;border-radius:50%;flex-shrink:0}';
    h += '.membro-item .nome{font-size:13px;color:#e4e4e7;font-weight:500}';
    h += '.membro-item .id{font-size:11px;color:#52525b;font-family:monospace}';
    h += '.manut-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;border-radius:10px;margin-bottom:20px;flex-wrap:wrap}';
    h += '.manut-on{background:#1f180a;border:1px solid #3f2f0a;color:#fbbf24}';
    h += '.manut-off{background:#0f1f14;border:1px solid #1f3a26;color:#4ade80}';
    h += '.manut-text{font-size:13px;font-weight:500}';
    h += '.manut-sub{font-size:11.5px;opacity:0.7;margin-top:2px}';
    h += '@media(max-width:768px){';
    h += '.menu-toggle{display:block}';
    h += '.sidebar{transform:translateX(-100%);transition:transform 0.3s;box-shadow:20px 0 60px rgba(0,0,0,0.5)}';
    h += '.sidebar.aberto{transform:translateX(0)}';
    h += '.main{margin-left:0;max-width:100%;padding:72px 16px 24px}';
    h += '.main-header h1{font-size:18px}';
    h += '.busca-input{width:100%}';
    h += '.cards-grid{grid-template-columns:repeat(2,1fr);gap:10px}';
    h += '.card{padding:14px}';
    h += '.card-value{font-size:20px}';
    h += '.card-label{font-size:10px}';
    h += '.tabela-header{flex-direction:column;align-items:stretch}';
    h += 'th,td{padding:10px 12px;font-size:12px}';
    h += 'table{min-width:auto}';
    h += '.ocultar-mobile{display:none!important}';
    h += '.login-title{font-size:32px}';
    h += '.login-card{padding:20px}';
    h += '.modal{padding:20px;border-radius:10px}';
    h += '.form-group input,.form-group select,.form-group textarea{font-size:15px;padding:11px 12px}';
    h += '.btn-primary,.btn-danger{width:100%;padding:12px}';
    h += '.avatar-cell .id{display:none}';
    h += '}';
    h += '</style></head><body>';

    // LOGIN
    h += '<div class="login-container" id="loginContainer"><div class="login-wrapper">';
    h += '<div class="handwritten">painel seguro <span class="arrow">↗</span></div>';
    h += '<h1 class="login-title">Acesso Administrativo</h1>';
    h += '<p class="login-subtitle">Autenticação com proteção anti-tampering, salteamento scrypt e armazenamento criptografado.</p>';
    h += '<div class="login-card">';
    h += '<div class="login-card-header"><div class="login-card-header-left">AUTENTICAÇÃO MESTRA</div><div class="badge-restricted">RESTRICTED</div></div>';
    h += '<div class="field"><label class="field-label">USUÁRIO</label><div class="input-wrapper"><input type="text" id="loginUsuario" placeholder="Digite seu usuário" autocomplete="username"></div></div>';
    h += '<div class="field"><label class="field-label">SENHA MESTRA</label><div class="input-wrapper"><input type="password" id="loginSenha" placeholder="••••••••••••••" autocomplete="current-password"><button class="btn-eye" onclick="toggleSenha()" type="button">👁</button></div></div>';
    h += '<div class="captcha-box" id="captchaBox" onclick="toggleCaptcha()"><div class="captcha-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div><div class="captcha-label">Sou humano</div><div class="captcha-brand"><div class="brand-name">Fuzion Captcha</div><div>Privacy · Terms</div></div></div>';
    h += '<button class="btn-entrar" onclick="fazerLogin()" id="btnEntrar">Entrar no Painel →</button>';
    h += '<a href="/" class="btn-voltar">← Voltar para a Loja Oficial</a>';
    h += '<div class="login-erro" id="loginErro"></div>';
    h += '</div>';
    h += '<div class="login-footer">ANTI-NOSQL INJECTION · 2-ERROS 24H LOCKOUT · SHIELD ATIVO</div>';
    h += '</div></div>';

    // APP
    h += '<div class="app" id="app"><button class="menu-toggle" onclick="toggleSidebar()">☰</button><aside class="sidebar" id="sidebar"><div class="sidebar-logo">Fuzion <span>Painel</span></div><nav class="sidebar-nav">';
    h += '<button class="nav-item ativo" data-pagina="dashboard" onclick="mostrarPagina(\'dashboard\')">Dashboard</button>';
    h += '<button class="nav-item" data-pagina="verificados" onclick="mostrarPagina(\'verificados\')">Verificados</button>';
    h += '<button class="nav-item" data-pagina="buscar" onclick="mostrarPagina(\'buscar\')">Buscar</button>';
    h += '<button class="nav-item" data-pagina="restringir" onclick="mostrarPagina(\'restringir\')">Restrição</button>';
    h += '<button class="nav-item" data-pagina="criar-gift" onclick="mostrarPagina(\'criar-gift\')">Criar Gift</button>';
    h += '<button class="nav-item" data-pagina="deletar-gift" onclick="mostrarPagina(\'deletar-gift\')">Gerenciar Gifts</button>';
    h += '<button class="nav-item" data-pagina="puxar" onclick="mostrarPagina(\'puxar\')">Puxar</button>';
    h += '<button class="nav-item" data-pagina="servidores" onclick="mostrarPagina(\'servidores\')">Servidores</button>';
    h += '<button class="nav-item" data-pagina="logs" onclick="mostrarPagina(\'logs\')">Logs</button>';
    h += '<button class="nav-item" data-pagina="bot" onclick="mostrarPagina(\'bot\')">Bot</button>';
    h += '<button class="nav-item" data-pagina="config" onclick="mostrarPagina(\'config\')">Config</button>';
    h += '</nav><div class="sidebar-footer"><button class="btn-sair" onclick="fazerLogout()">Sair</button></div></aside>';
    h += '<main class="main"><div class="main-header"><h1 id="tituloPagina">Dashboard</h1><div id="manutBtn"></div></div>';

    h += '<div class="pagina ativo" id="pagina-dashboard"><div id="manutBanner"></div><div class="cards-grid" id="cardsStats"></div><div class="tabela-container"><div class="tabela-header"><h2>Top 5 Cidades</h2></div><div class="tabela-scroll"><table><thead><tr><th>#</th><th>Cidade</th><th>Usuários</th></tr></thead><tbody id="topCidades"></tbody></table></div></div></div>';

    h += '<div class="pagina" id="pagina-verificados"><div class="tabela-container"><div class="tabela-header"><h2>Verificados (<span id="totalVerificados">0</span>)</h2><input type="text" class="busca-input" id="buscaVerificados" placeholder="Buscar..." oninput="filtrarVerificados()"></div><div class="tabela-scroll"><table><thead><tr><th>Usuário</th><th class="ocultar-mobile">Localização</th><th class="ocultar-mobile">Email</th><th class="ocultar-mobile">IP</th><th class="ocultar-mobile">Data</th><th>Ações</th></tr></thead><tbody id="tabelaVerificados"></tbody></table></div></div></div>';

    h += '<div class="pagina" id="pagina-buscar"><div class="tabela-container" style="padding:24px"><h2 style="margin-bottom:16px;font-size:15px;color:#e4e4e7">Buscar Usuário</h2><div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap"><input type="text" id="buscarId" placeholder="ID do Discord" maxlength="20" style="flex:1;min-width:200px"><button class="btn-primary" onclick="buscarUsuario()" id="btnBuscar">Buscar</button></div><div id="resultadoBuscar"></div></div></div>';

    // RESTRIÇÃO
    h += '<div class="pagina" id="pagina-restringir"><div class="tabela-container" style="padding:24px"><h2 style="margin-bottom:8px;font-size:15px;color:#e4e4e7">Restrição de Membros</h2><p style="color:#71717a;font-size:13px;margin-bottom:20px;line-height:1.5">Os usuários selecionados <strong style="color:#f87171">nunca</strong> serão puxados pelo bot, nem por gifts nem pelo comando /puxar.</p><input type="text" id="buscaRestricao" placeholder="Buscar por nome ou ID..." oninput="filtrarRestricao()" style="margin-bottom:12px"><div class="membros-list" id="listaRestricao"></div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;flex-wrap:wrap;gap:12px"><small id="contadorRestricao" style="color:#fbbf24;font-size:12px">0 restringidos</small><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-primary" onclick="salvarRestricao()" id="btnSalvarRestricao">Concluir</button><button class="btn-primary" onclick="limparRestricao()">Limpar tudo</button></div></div><div id="resultadoRestricao"></div></div></div>';

    h += '<div class="pagina" id="pagina-criar-gift"><div class="tabela-container" style="padding:24px"><h2 style="margin-bottom:20px;font-size:15px;color:#e4e4e7">Criar Gift</h2><div class="form-group"><label>Quantidade de membros (por gift)</label><input type="number" id="giftQuantidade" min="1" placeholder="Ex: 5"></div><div class="form-group"><label>Quantos gifts gerar (1-100)</label><input type="number" id="giftQuantidadeGifts" min="1" max="100" value="1"></div><div class="form-group"><label>Expiração</label><select id="giftTempo" onchange="toggleExpiracaoCustom()"><option value="1">1 hora</option><option value="6">6 horas</option><option value="24">24 horas</option><option value="168" selected>7 dias</option><option value="720">30 dias</option><option value="custom">Data/hora personalizada</option><option value="0">Nunca expira</option></select></div><div class="form-group" id="containerExpiracaoCustom" style="display:none"><label>Data e hora personalizada</label><input type="datetime-local" id="giftExpiracaoCustom"></div><div class="form-group"><label><input type="checkbox" id="giftSoVerificado" style="width:auto;margin-right:8px"> Só quem já se verificou no bot pode acessar</label></div><div class="form-group"><label>Nome do gift (opcional)</label><input type="text" id="giftNome" maxlength="60"></div><div class="form-group"><label>Descrição (opcional)</label><textarea id="giftDescricao" maxlength="200" rows="2"></textarea></div><div class="form-group"><label><input type="checkbox" id="giftSelecionar" onchange="toggleSelecionarUsuarios()" style="width:auto;margin-right:8px"> Selecionar membros específicos</label></div><div class="form-group" id="containerUsuarios" style="display:none"><label>Buscar membro</label><input type="text" id="buscarMembroInput" placeholder="Nome ou ID..." oninput="filtrarMembrosGift()" style="margin-bottom:8px"><div class="membros-list" id="listaMembros"></div><small id="contadorSelecionados">0 selecionados</small></div><button class="btn-primary" onclick="criarGift()" id="btnCriarGift">Criar Gift</button><div id="resultadoGift"></div></div></div>';

    h += '<div class="pagina" id="pagina-deletar-gift"><div class="tabela-container"><div class="tabela-header"><h2>Gerenciar Gifts</h2><input type="text" class="busca-input" id="buscaGifts" placeholder="Buscar..." oninput="filtrarGifts()"></div><div class="tabela-scroll"><table><thead><tr><th>Código</th><th>Qtd</th><th>Status</th><th>Expira</th><th>Ações</th></tr></thead><tbody id="tabelaGifts"></tbody></table></div></div></div>';

    h += '<div class="pagina" id="pagina-puxar"><div class="tabela-container" style="padding:24px"><h2 style="margin-bottom:20px;font-size:15px;color:#e4e4e7">Puxar Membros</h2><div class="form-group"><label>ID do servidor</label><input type="text" id="puxarGuildId" maxlength="20"></div><div class="form-group"><label>Quantidade (0 = todos)</label><input type="number" id="puxarQuantidade" min="0" value="0"></div><button class="btn-primary" onclick="puxarMembros()" id="btnPuxar">Puxar</button><div id="resultadoPuxar"></div></div></div>';

    h += '<div class="pagina" id="pagina-servidores"><div class="tabela-container"><div class="tabela-header"><h2>Servidores</h2></div><div class="tabela-scroll"><table><thead><tr><th>Servidor</th><th>ID</th><th class="ocultar-mobile">Membros</th></tr></thead><tbody id="tabelaServidores"></tbody></table></div></div></div>';

    h += '<div class="pagina" id="pagina-logs"><div class="tabela-container"><div class="tabela-header"><h2>Logs</h2><select class="busca-input" id="filtroLogs" onchange="filtrarLogs()"><option value="todos">Todos</option><option value="entrou">Entrou</option><option value="saiu">Saiu</option><option value="ban">Ban</option><option value="kick">Kick</option><option value="mute">Mute</option><option value="verificacao">Verificação</option><option value="gift">Gift</option></select></div><div class="tabela-scroll"><table><thead><tr><th>Data</th><th>Tipo</th><th>Usuário</th><th class="ocultar-mobile">Detalhes</th></tr></thead><tbody id="tabelaLogs"></tbody></table></div></div></div>';

    h += '<div class="pagina" id="pagina-bot"><div class="tabela-container" style="padding:24px"><h2 style="margin-bottom:20px;font-size:15px;color:#e4e4e7">Personalização do Bot</h2><div class="form-group"><label>Nome do Bot</label><input type="text" id="botUsername" maxlength="32"><small>Limite: 2 mudanças por hora</small></div><button class="btn-primary" onclick="salvarUsername()" id="btnUsername">Salvar Nome</button><div id="resultadoUsername"></div><div style="margin-top:32px;padding-top:24px;border-top:1px solid #1d1d20"><div class="form-group"><label>Avatar (URL)</label><input type="text" id="botAvatar"><small>Limite: 2 mudanças por hora</small></div><button class="btn-primary" onclick="salvarAvatar()" id="btnAvatar">Salvar Avatar</button><div id="resultadoAvatar"></div></div><div style="margin-top:32px;padding-top:24px;border-top:1px solid #1d1d20"><h3 style="margin-bottom:16px;font-size:14px;color:#e4e4e7">Status</h3><div class="form-group"><label>Tipo</label><select id="botStatusTipo"><option value="Jogando">Jogando</option><option value="Ouvindo">Ouvindo</option><option value="Assistindo">Assistindo</option><option value="Competindo">Competindo</option></select></div><div class="form-group"><label>Texto</label><input type="text" id="botStatusTexto" maxlength="128"></div><div class="form-group"><label>Status online</label><select id="botStatusOnline"><option value="online">Online</option><option value="idle">Ausente</option><option value="dnd">Não perturbe</option><option value="invisible">Invisível</option></select></div><button class="btn-primary" onclick="salvarStatus()" id="btnStatus">Salvar Status</button><div id="resultadoStatus"></div></div></div></div>';

    h += '<div class="pagina" id="pagina-config"><div class="tabela-container" style="padding:24px"><h2 style="margin-bottom:20px;font-size:15px;color:#e4e4e7">Configurações</h2><div class="form-group"><label>Canal de logs de verificação</label><input type="text" id="cfgLogChannel"></div><div class="form-group"><label>Canal de logs de gift</label><input type="text" id="cfgGiftLogChannel"></div><div class="form-group"><label>Cargo de verificado</label><input type="text" id="cfgRoleId"></div><button class="btn-primary" onclick="salvarConfig()" id="btnSalvarConfig">Salvar</button><div id="resultadoConfig"></div></div></div>';

    h += '</main></div>';
    h += '<div class="modal-overlay" id="modalInfo"><div class="modal"><button class="modal-close" onclick="fecharModal()">×</button><h2>Informações do Gift</h2><div id="modalInfoContent"></div></div></div>';
    h += '<div class="toast" id="toast"></div>';

    h += '<script>';
    h += 'var TOKEN=localStorage.getItem("painel_token");var CSRF=localStorage.getItem("painel_csrf");var USUARIOS_CACHE=[];var GIFTS_CACHE=[];var LOGS_CACHE=[];var SELECIONADOS_GIFT=[];var RESTRINGIDOS=[];var CAPTCHA=false;var MANUTENCAO=false;';
    h += 'function toggleSenha(){var i=document.getElementById("loginSenha");i.type=i.type==="password"?"text":"password";}';
    h += 'function toggleCaptcha(){CAPTCHA=!CAPTCHA;var b=document.getElementById("captchaBox");if(CAPTCHA)b.classList.add("checked");else b.classList.remove("checked");}';
    h += 'async function api(url,options){options=options||{};var opts={method:options.method||"GET",headers:{"Content-Type":"application/json","x-painel-token":TOKEN,"x-csrf-token":CSRF}};if(options.body)opts.body=options.body;var resp=await fetch(url,opts);if(resp.status===401){fazerLogout();throw new Error("Sessao expirada");}return resp;}';
    h += 'function toast(msg,tipo){tipo=tipo||"sucesso";var el=document.getElementById("toast");el.textContent=msg;el.className="toast ativo "+tipo;setTimeout(function(){el.className="toast "+tipo;},3000);}';
    h += 'function formatarData(iso){if(!iso)return "-";return new Date(iso).toLocaleString("pt-BR");}';
    h += 'async function fazerLogin(){var u=document.getElementById("loginUsuario").value.trim();var s=document.getElementById("loginSenha").value;var b=document.getElementById("btnEntrar");var e=document.getElementById("loginErro");e.textContent="";if(!u||!s){e.textContent="Preencha tudo.";return;}if(!CAPTCHA){e.textContent="Marque Sou humano.";return;}b.disabled=true;b.textContent="Verificando...";try{var resp=await fetch("/api/painel/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({usuario:u,senha:s,captcha:CAPTCHA})});var data=await resp.json();if(!resp.ok){e.textContent=data.error||"Erro";b.disabled=false;b.textContent="Entrar no Painel →";return;}TOKEN=data.token;CSRF=data.csrf;localStorage.setItem("painel_token",TOKEN);localStorage.setItem("painel_csrf",CSRF);abrirApp();}catch(err){e.textContent="Erro de conexao.";b.disabled=false;b.textContent="Entrar no Painel →";}}';
    h += 'async function fazerLogout(){try{await api("/api/painel/logout",{method:"POST"});}catch(e){}localStorage.removeItem("painel_token");localStorage.removeItem("painel_csrf");TOKEN=null;CSRF=null;location.reload();}';
    h += 'function abrirApp(){document.getElementById("loginContainer").style.display="none";document.getElementById("app").classList.add("ativo");carregarStats();}';
    h += 'function mostrarPagina(p){document.querySelectorAll(".pagina").forEach(function(x){x.classList.remove("ativo");});document.querySelectorAll(".nav-item").forEach(function(n){n.classList.remove("ativo");});document.getElementById("pagina-"+p).classList.add("ativo");document.querySelector("[data-pagina=\\""+p+"\\"]").classList.add("ativo");var t={dashboard:"Dashboard",verificados:"Verificados",buscar:"Buscar",restringir:"Restrição","criar-gift":"Criar Gift","deletar-gift":"Gerenciar Gifts",puxar:"Puxar",servidores:"Servidores",logs:"Logs",bot:"Bot",config:"Config"};document.getElementById("tituloPagina").textContent=t[p]||"";if(p==="verificados")carregarVerificados();if(p==="deletar-gift")carregarGifts();if(p==="servidores")carregarServidores();if(p==="logs")carregarLogs();if(p==="config")carregarConfig();if(p==="criar-gift")carregarMembrosGift();if(p==="bot")carregarBotInfo();if(p==="restringir")carregarRestricao();if(p==="buscar"){document.getElementById("resultadoBuscar").innerHTML="";}document.getElementById("sidebar").classList.remove("aberto");}';
    h += 'function toggleSidebar(){document.getElementById("sidebar").classList.toggle("aberto");}';
    h += 'async function carregarStats(){try{var r=await api("/api/painel/stats");var d=await r.json();MANUTENCAO=d.manutencao;document.getElementById("cardsStats").innerHTML="<div class=\\"card\\"><div class=\\"card-label\\">Verificados</div><div class=\\"card-value primary\\">"+d.total+"</div></div><div class=\\"card\\"><div class=\\"card-label\\">Gifts Ativos</div><div class=\\"card-value success\\">"+d.giftsAtivos+"</div></div><div class=\\"card\\"><div class=\\"card-label\\">Gifts Usados</div><div class=\\"card-value warning\\">"+d.giftsUsados+"</div></div><div class=\\"card\\"><div class=\\"card-label\\">Restringidos</div><div class=\\"card-value danger\\">"+d.restringidos+"</div></div>";document.getElementById("topCidades").innerHTML=(d.topCidades||[]).map(function(c,i){return "<tr><td>"+(i+1)+"</td><td>"+c.cidade+"</td><td>"+c.count+"</td></tr>";}).join("")||"<tr><td colspan=\\"3\\" style=\\"text-align:center;color:#52525b\\">Sem dados</td></tr>";renderManutencao();}catch(e){}}';
    h += 'function renderManutencao(){var b=document.getElementById("manutBanner");var btn=document.getElementById("manutBtn");if(MANUTENCAO){b.innerHTML="<div class=\\"manut-banner manut-on\\"><div><div class=\\"manut-text\\">Manutenção ATIVA</div><div class=\\"manut-sub\\">Os gifts estão bloqueados no momento</div></div><button class=\\"btn-danger\\" onclick=\\"toggleManutencao()\\">Desativar manutenção</button></div>";btn.innerHTML="";}else{b.innerHTML="";btn.innerHTML="<button class=\\"btn-primary\\" onclick=\\"toggleManutencao()\\">🔧 Ativar manutenção</button>";}}';
    h += 'async function toggleManutencao(){var novo=!MANUTENCAO;try{var r=await api("/api/painel/manutencao",{method:"POST",body:JSON.stringify({ativa:novo})});var d=await r.json();if(r.ok){MANUTENCAO=d.manutencao;toast(MANUTENCAO?"Manutenção ativada!":"Manutenção desativada!");renderManutencao();}}catch(e){toast("Erro","erro");}}';
    h += 'async function carregarVerificados(){try{var r=await api("/api/painel/users");USUARIOS_CACHE=await r.json();renderVerificados(USUARIOS_CACHE);}catch(e){}}';
    h += 'function renderVerificados(users){document.getElementById("totalVerificados").textContent=users.length;var t=document.getElementById("tabelaVerificados");if(users.length===0){t.innerHTML="<tr><td colspan=\\"6\\" style=\\"text-align:center;color:#52525b\\">Nenhum</td></tr>";return;}t.innerHTML=users.map(function(u){var a=u.avatar?"https://cdn.discordapp.com/avatars/"+u.id+"/"+u.avatar+".png":"https://cdn.discordapp.com/embed/avatars/0.png";return "<tr><td><div class=\\"avatar-cell\\"><img src=\\""+a+"\\"><div><div class=\\"nome\\">"+u.username+"</div><div class=\\"id\\">"+u.id+"</div></div></div></td><td class=\\"ocultar-mobile\\">"+(u.cidade||"-")+", "+(u.estado||"-")+"</td><td class=\\"ocultar-mobile\\">"+(u.email||"-")+"</td><td class=\\"ocultar-mobile\\">"+(u.ip||"-")+"</td><td class=\\"ocultar-mobile\\">"+formatarData(u.verifiedAt)+"</td><td><button class=\\"btn-acao\\" onclick=\\"desverificar(\\""+u.id+"\\")\\">Desverificar</button></td></tr>";}).join("");}';
    h += 'function filtrarVerificados(){var b=document.getElementById("buscaVerificados").value.toLowerCase();renderVerificados(USUARIOS_CACHE.filter(function(u){return u.username.toLowerCase().includes(b)||u.id.includes(b);}));}';
    h += 'async function desverificar(id){if(!confirm("Desverificar esse usuario?"))return;try{var r=await api("/api/painel/users/"+id,{method:"DELETE"});if(r.ok){toast("Desverificado!");carregarVerificados();}}catch(e){}}';
    h += 'async function buscarUsuario(){var id=document.getElementById("buscarId").value.trim();var b=document.getElementById("btnBuscar");var r=document.getElementById("resultadoBuscar");if(!id){toast("Cole um ID","erro");return;}if(!/^\\d{17,20}$/.test(id)){toast("ID invalido","erro");return;}b.disabled=true;b.textContent="Buscando...";r.innerHTML="<div class=\\"resultado-box\\">Buscando...</div>";try{var resp=await api("/api/painel/buscar/"+id);var d=await resp.json();if(!resp.ok){r.innerHTML="<div class=\\"resultado-box erro\\">"+(d.error||"Erro")+"</div>";}else if(!d.encontrado){r.innerHTML="<div class=\\"resultado-box erro\\"><strong style=\\"color:#f87171;display:block;margin-bottom:8px\\">Usuario nao encontrado</strong>Esse ID nao esta no banco.</div>";}else{var a=d.avatar?"https://cdn.discordapp.com/avatars/"+d.id+"/"+d.avatar+".png":"https://cdn.discordapp.com/embed/avatars/0.png";r.innerHTML="<div class=\\"resultado-box sucesso\\"><div style=\\"display:flex;align-items:center;gap:16px;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #1d1d20\\"><img src=\\""+a+"\\" style=\\"width:56px;height:56px;border-radius:50%\\"><div><div style=\\"font-size:17px;font-weight:600;color:#f4f4f5\\">"+d.username+"</div><div style=\\"font-size:12px;color:#52525b;margin-top:4px;font-family:monospace\\">"+d.id+"</div></div></div><div style=\\"display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-bottom:20px\\"><div><div style=\\"font-size:10.5px;color:#52525b;text-transform:uppercase;margin-bottom:6px\\">Email</div><div style=\\"font-size:13px;color:#e4e4e7\\">"+(d.email||"-")+"</div></div><div><div style=\\"font-size:10.5px;color:#52525b;text-transform:uppercase;margin-bottom:6px\\">IP</div><div style=\\"font-size:13px;color:#e4e4e7\\">"+(d.ip||"-")+"</div></div><div><div style=\\"font-size:10.5px;color:#52525b;text-transform:uppercase;margin-bottom:6px\\">Localizacao</div><div style=\\"font-size:13px;color:#e4e4e7\\">"+d.cidade+", "+d.estado+"</div></div><div><div style=\\"font-size:10.5px;color:#52525b;text-transform:uppercase;margin-bottom:6px\\">Verificado</div><div style=\\"font-size:13px;color:#e4e4e7\\">"+formatarData(d.verifiedAt)+"</div></div></div><button class=\\"btn-acao\\" onclick=\\"desverificar(\\""+d.id+"\\")\\">Desverificar</button></div>";}}catch(e){r.innerHTML="<div class=\\"resultado-box erro\\">Erro</div>";}b.disabled=false;b.textContent="Buscar";}';
    // RESTRIÇÃO
    h += 'async function carregarRestricao(){try{var r=await api("/api/painel/users");USUARIOS_CACHE=await r.json();var r2=await api("/api/painel/restringidos");RESTRINGIDOS=await r2.json();renderRestricao(USUARIOS_CACHE);}catch(e){}}';
    h += 'function renderRestricao(users){var c=document.getElementById("listaRestricao");if(!c)return;c.innerHTML=users.slice(0,200).map(function(u){var a=u.avatar?"https://cdn.discordapp.com/avatars/"+u.id+"/"+u.avatar+".png":"https://cdn.discordapp.com/embed/avatars/0.png";var ck=RESTRINGIDOS.indexOf(u.id)>-1?"checked":"";return "<label class=\\"membro-item\\"><input type=\\"checkbox\\" value=\\""+u.id+"\\" "+ck+" onchange=\\"toggleRestricao(this)\\"><img src=\\""+a+"\\"><div><div class=\\"nome\\">"+u.username+"</div><div class=\\"id\\">"+u.id+"</div></div></label>";}).join("");document.getElementById("contadorRestricao").textContent=RESTRINGIDOS.length+" restringidos";}';
    h += 'function filtrarRestricao(){var b=document.getElementById("buscaRestricao").value.toLowerCase();renderRestricao(USUARIOS_CACHE.filter(function(u){return u.username.toLowerCase().includes(b)||u.id.includes(b);}));}';
    h += 'function toggleRestricao(el){var id=el.value;if(el.checked){if(RESTRINGIDOS.indexOf(id)===-1)RESTRINGIDOS.push(id);}else{RESTRINGIDOS=RESTRINGIDOS.filter(function(x){return x!==id;});}document.getElementById("contadorRestricao").textContent=RESTRINGIDOS.length+" restringidos";}';
    h += 'function limparRestricao(){if(!confirm("Limpar TODAS as restrições?"))return;RESTRINGIDOS=[];renderRestricao(USUARIOS_CACHE);}';
    h += 'async function salvarRestricao(){var b=document.getElementById("btnSalvarRestricao");b.disabled=true;b.textContent="Salvando...";try{var r=await api("/api/painel/restringidos",{method:"POST",body:JSON.stringify({lista:RESTRINGIDOS})});if(r.ok){toast("Restrição salva! "+RESTRINGIDOS.length+" usuarios bloqueados");}else{toast("Erro","erro");}}catch(e){toast("Erro","erro");}b.disabled=false;b.textContent="Concluir";}';
    // RESTO DAS FUNÇÕES
    h += 'function toggleExpiracaoCustom(){var v=document.getElementById("giftTempo").value;document.getElementById("containerExpiracaoCustom").style.display=v==="custom"?"block":"none";}';
    h += 'function toggleSelecionarUsuarios(){var c=document.getElementById("giftSelecionar").checked;document.getElementById("containerUsuarios").style.display=c?"block":"none";if(c)carregarMembrosGift();}';
    h += 'async function carregarMembrosGift(){try{var r=await api("/api/painel/users");USUARIOS_CACHE=await r.json();renderMembrosGift(USUARIOS_CACHE);}catch(e){}}';
    h += 'function renderMembrosGift(users){var c=document.getElementById("listaMembros");if(!c)return;c.innerHTML=users.slice(0,200).map(function(u){var a=u.avatar?"https://cdn.discordapp.com/avatars/"+u.id+"/"+u.avatar+".png":"https://cdn.discordapp.com/embed/avatars/0.png";var ck=SELECIONADOS_GIFT.indexOf(u.id)>-1?"checked":"";return "<label class=\\"membro-item\\"><input type=\\"checkbox\\" value=\\""+u.id+"\\" "+ck+" onchange=\\"toggleMembroGift(this)\\"><img src=\\""+a+"\\"><div><div class=\\"nome\\">"+u.username+"</div><div class=\\"id\\">"+u.id+"</div></div></label>";}).join("");document.getElementById("contadorSelecionados").textContent=SELECIONADOS_GIFT.length+" selecionados";}';
    h += 'function filtrarMembrosGift(){var b=document.getElementById("buscarMembroInput").value.toLowerCase();renderMembrosGift(USUARIOS_CACHE.filter(function(u){return u.username.toLowerCase().includes(b)||u.id.includes(b);}));}';
    h += 'function toggleMembroGift(el){var id=el.value;if(el.checked){if(SELECIONADOS_GIFT.indexOf(id)===-1)SELECIONADOS_GIFT.push(id);}else{SELECIONADOS_GIFT=SELECIONADOS_GIFT.filter(function(x){return x!==id;});}document.getElementById("contadorSelecionados").textContent=SELECIONADOS_GIFT.length+" selecionados";}';
    h += 'async function criarGift(){var q=parseInt(document.getElementById("giftQuantidade").value);var qg=parseInt(document.getElementById("giftQuantidadeGifts").value)||1;var tv=document.getElementById("giftTempo").value;var ec=null;var t=0;if(tv==="custom"){ec=document.getElementById("giftExpiracaoCustom").value;if(!ec){toast("Informe a data","erro");return;}}else{t=parseInt(tv);}var sv=document.getElementById("giftSoVerificado").checked;var n=document.getElementById("giftNome").value.trim();var d=document.getElementById("giftDescricao").value.trim();var s=document.getElementById("giftSelecionar").checked?SELECIONADOS_GIFT:[];var b=document.getElementById("btnCriarGift");var r=document.getElementById("resultadoGift");if(!q||q<1){toast("Quantidade invalida","erro");return;}if(qg<1||qg>100){toast("Gifts: 1-100","erro");return;}b.disabled=true;b.textContent="Criando...";r.innerHTML="";try{var resp=await api("/api/painel/gifts",{method:"POST",body:JSON.stringify({quantidade:q,tempo:t,quantidadeGifts:qg,selecionados:s,soVerificado:sv,expiracaoCustom:ec,nome:n,descricao:d})});var data=await resp.json();if(!resp.ok){r.innerHTML="<div class=\\"resultado-box erro\\">"+(data.error||"Erro")+"</div>";}else{var html="<div class=\\"resultado-box sucesso\\"><strong style=\\"color:#4ade80;display:block;margin-bottom:12px\\">"+data.criados.length+" gift(s) criado(s)</strong>";data.criados.forEach(function(g){html+="<div style=\\"margin-bottom:8px;word-break:break-all\\"><code style=\\"color:#e4e4e7;font-family:monospace\\">"+g.codigo+"</code> - <a href=\\""+g.link+"\\" target=\\"_blank\\" style=\\"color:#a1a1aa;text-decoration:underline\\">"+g.link+"</a></div>";});html+="</div>";r.innerHTML=html;toast(data.criados.length+" gift(s)!");SELECIONADOS_GIFT=[];}}catch(e){r.innerHTML="<div class=\\"resultado-box erro\\">Erro</div>";}b.disabled=false;b.textContent="Criar Gift";}';
    h += 'async function carregarGifts(){try{var r=await api("/api/painel/gifts");GIFTS_CACHE=await r.json();renderGifts(GIFTS_CACHE);}catch(e){}}';
    h += 'function renderGifts(lista){var t=document.getElementById("tabelaGifts");if(!t)return;if(lista.length===0){t.innerHTML="<tr><td colspan=\\"5\\" style=\\"text-align:center;color:#52525b\\">Nenhum gift</td></tr>";return;}var html="";for(var i=0;i<lista.length;i++){var g=lista[i];var sb="<span class=\\"badge success\\">Ativo</span>";if(g.status==="esgotado")sb="<span class=\\"badge danger\\">Esgotado</span>";else if(g.expiresAt&&Date.now()>g.expiresAt)sb="<span class=\\"badge warning\\">Expirado</span>";var de=g.expiresAt?formatarData(new Date(g.expiresAt).toISOString()):"Nunca";html+="<tr><td><code style=\\"font-family:monospace;color:#e4e4e7\\">"+g.codigo+"</code></td><td>"+g.quantidade+"</td><td>"+sb+"</td><td>"+de+"</td><td><button class=\\"btn-info\\" data-gift=\\""+g.codigo+"\\" onclick=\\"verInfoGift(this.getAttribute(\'data-gift\'))\\">Info</button> <button class=\\"btn-acao\\" data-gift=\\""+g.codigo+"\\" onclick=\\"deletarGift(this.getAttribute(\'data-gift\'))\\">Deletar</button></td></tr>";}t.innerHTML=html;}';
    h += 'function filtrarGifts(){var b=document.getElementById("buscaGifts").value.toLowerCase();renderGifts(GIFTS_CACHE.filter(function(g){return g.codigo.toLowerCase().includes(b);}));}';
    h += 'async function verInfoGift(codigo){if(!codigo){toast("Codigo invalido","erro");return;}try{var resp=await api("/api/painel/gifts/"+codigo);var g=await resp.json();if(!resp.ok){toast(g.error||"Erro","erro");return;}var expirado=g.expiresAt&&Date.now()>g.expiresAt;var status="Ativo";if(g.status==="esgotado")status="Esgotado";else if(expirado)status="Expirado";var html="<div style=\\"line-height:1.9;font-size:13px\\"><div><strong style=\\"color:#71717a\\">Codigo:</strong> <code style=\\"font-family:monospace;color:#e4e4e7\\">"+g.codigo+"</code></div><div><strong style=\\"color:#71717a\\">Quantidade:</strong> "+g.quantidade+" membros</div><div><strong style=\\"color:#71717a\\">Status:</strong> "+status+"</div><div><strong style=\\"color:#71717a\\">Criado em:</strong> "+formatarData(new Date(g.criadoEm).toISOString())+"</div><div><strong style=\\"color:#71717a\\">Expira em:</strong> "+(g.expiresAt?formatarData(new Date(g.expiresAt).toISOString()):"Nunca")+"</div>";if(g.nome)html+="<div><strong style=\\"color:#71717a\\">Nome:</strong> "+g.nome+"</div>";if(g.descricao)html+="<div><strong style=\\"color:#71717a\\">Descricao:</strong> "+g.descricao+"</div>";if(g.soVerificado)html+="<div><strong style=\\"color:#71717a\\">So verificado:</strong> Sim</div>";if(g.selecionados&&g.selecionados.length>0)html+="<div><strong style=\\"color:#71717a\\">Selecionados:</strong> "+g.selecionados.length+"</div>";if(g.servidorUsado)html+="<div><strong style=\\"color:#71717a\\">Servidor usado:</strong> "+g.servidorUsado+"</div>";if(g.puxados!==undefined)html+="<div><strong style=\\"color:#71717a\\">Puxados:</strong> "+g.puxados+" | Falhas: "+(g.falhas||0)+"</div>";html+="</div>";document.getElementById("modalInfoContent").innerHTML=html;document.getElementById("modalInfo").classList.add("ativo");}catch(e){toast("Erro de conexao","erro");}}';
    h += 'function fecharModal(){document.getElementById("modalInfo").classList.remove("ativo");}';
    h += 'async function deletarGift(codigo){if(!codigo){toast("Codigo invalido","erro");return;}if(!confirm("Deletar o gift "+codigo+"?"))return;try{var resp=await api("/api/painel/gifts/"+codigo,{method:"DELETE"});var data=await resp.json();if(resp.ok){toast("Gift deletado!");carregarGifts();}else{toast(data.error||"Erro","erro");}}catch(e){toast("Erro de conexao","erro");}}';
    h += 'async function puxarMembros(){var g=document.getElementById("puxarGuildId").value.trim();var q=parseInt(document.getElementById("puxarQuantidade").value)||0;var b=document.getElementById("btnPuxar");var r=document.getElementById("resultadoPuxar");if(!/^\\d{17,20}$/.test(g)){toast("ID invalido","erro");return;}b.disabled=true;b.textContent="Puxando...";try{var resp=await api("/api/painel/puxar",{method:"POST",body:JSON.stringify({guildId:g,quantidade:q})});var d=await resp.json();if(!resp.ok)r.innerHTML="<div class=\\"resultado-box erro\\">"+(d.error||"Erro")+"</div>";else r.innerHTML="<div class=\\"resultado-box sucesso\\">"+d.mensagem+"</div>";}catch(e){}b.disabled=false;b.textContent="Puxar";}';
    h += 'async function carregarServidores(){try{var r=await api("/api/painel/servers");var d=await r.json();var t=document.getElementById("tabelaServidores");t.innerHTML=d.map(function(s){return "<tr><td><strong style=\\"color:#e4e4e7\\">"+s.nome+"</strong></td><td><code style=\\"font-family:monospace;color:#a1a1aa\\">"+s.id+"</code></td><td class=\\"ocultar-mobile\\">"+s.membros+"</td></tr>";}).join("")||"<tr><td colspan=\\"3\\" style=\\"text-align:center;color:#52525b\\">Nenhum</td></tr>";}catch(e){}}';
    h += 'async function carregarLogs(){try{var r=await api("/api/painel/logs");LOGS_CACHE=await r.json();renderLogs(LOGS_CACHE);}catch(e){}}';
    h += 'function renderLogs(logs){var t=document.getElementById("tabelaLogs");if(logs.length===0){t.innerHTML="<tr><td colspan=\\"4\\" style=\\"text-align:center;color:#52525b\\">Nenhum</td></tr>";return;}var c={entrou:"success",saiu:"warning",ban:"danger",kick:"danger",mute:"warning",unmute:"success",verificacao:"success",gift:"warning"};t.innerHTML=logs.slice(0,100).map(function(l){return "<tr><td>"+formatarData(l.data)+"</td><td><span class=\\"badge "+(c[l.tipo]||"")+"\\">"+l.tipo+"</span></td><td>"+(l.usuario||"-")+"</td><td class=\\"ocultar-mobile\\">"+(l.detalhes||"-")+"</td></tr>";}).join("");}';
    h += 'function filtrarLogs(){var f=document.getElementById("filtroLogs").value;if(f==="todos")return renderLogs(LOGS_CACHE);renderLogs(LOGS_CACHE.filter(function(l){return l.tipo===f;}));}';
    h += 'async function carregarBotInfo(){try{var r=await api("/api/painel/bot/info");var d=await r.json();document.getElementById("botUsername").placeholder=d.username;document.getElementById("botStatusTexto").placeholder=d.activity||"Ex: Minecraft";}catch(e){}}';
    h += 'async function salvarUsername(){var n=document.getElementById("botUsername").value.trim();var b=document.getElementById("btnUsername");var r=document.getElementById("resultadoUsername");if(!n){toast("Informe um nome","erro");return;}b.disabled=true;b.textContent="Salvando...";try{var resp=await api("/api/painel/bot/username",{method:"POST",body:JSON.stringify({username:n})});var d=await resp.json();if(!resp.ok)r.innerHTML="<div class=\\"resultado-box erro\\">"+(d.error||"Erro")+"</div>";else{r.innerHTML="<div class=\\"resultado-box sucesso\\">"+d.mensagem+"</div>";toast("Nome alterado!");}}catch(e){}b.disabled=false;b.textContent="Salvar Nome";}';
    h += 'async function salvarAvatar(){var u=document.getElementById("botAvatar").value.trim();var b=document.getElementById("btnAvatar");var r=document.getElementById("resultadoAvatar");if(!u){toast("Informe URL","erro");return;}b.disabled=true;b.textContent="Salvando...";try{var resp=await api("/api/painel/bot/avatar",{method:"POST",body:JSON.stringify({url:u})});var d=await resp.json();if(!resp.ok)r.innerHTML="<div class=\\"resultado-box erro\\">"+(d.error||"Erro")+"</div>";else{r.innerHTML="<div class=\\"resultado-box sucesso\\">"+d.mensagem+"</div>";toast("Avatar alterado!");}}catch(e){}b.disabled=false;b.textContent="Salvar Avatar";}';
    h += 'async function salvarStatus(){var t=document.getElementById("botStatusTipo").value;var tx=document.getElementById("botStatusTexto").value.trim();var s=document.getElementById("botStatusOnline").value;var b=document.getElementById("btnStatus");var r=document.getElementById("resultadoStatus");b.disabled=true;b.textContent="Salvando...";try{var resp=await api("/api/painel/bot/status",{method:"POST",body:JSON.stringify({tipo:t,texto:tx,status:s})});var d=await resp.json();if(!resp.ok)r.innerHTML="<div class=\\"resultado-box erro\\">"+(d.error||"Erro")+"</div>";else{r.innerHTML="<div class=\\"resultado-box sucesso\\">"+d.mensagem+"</div>";toast("Status atualizado!");}}catch(e){}b.disabled=false;b.textContent="Salvar Status";}';
    h += 'async function carregarConfig(){try{var r=await api("/api/painel/config");var d=await r.json();document.getElementById("cfgLogChannel").value=d.logChannelId||"";document.getElementById("cfgGiftLogChannel").value=d.giftLogChannelId||"";document.getElementById("cfgRoleId").value=d.roleId||"";}catch(e){}}';
    h += 'async function salvarConfig(){var l=document.getElementById("cfgLogChannel").value.trim();var gl=document.getElementById("cfgGiftLogChannel").value.trim();var ri=document.getElementById("cfgRoleId").value.trim();var b=document.getElementById("btnSalvarConfig");b.disabled=true;b.textContent="Salvando...";try{var r=await api("/api/painel/config",{method:"POST",body:JSON.stringify({logChannelId:l,giftLogChannelId:gl,roleId:ri})});if(r.ok)toast("Salvo!");else toast("Erro","erro");}catch(e){}b.disabled=false;b.textContent="Salvar";}';
    h += 'document.getElementById("modalInfo").addEventListener("click",function(e){if(e.target.id==="modalInfo")fecharModal();});';
    h += 'if(TOKEN)abrirApp();';
    h += 'document.getElementById("loginSenha").addEventListener("keypress",function(e){if(e.key==="Enter")fazerLogin();});';
    h += 'document.getElementById("loginUsuario").addEventListener("keypress",function(e){if(e.key==="Enter")fazerLogin();});';
    h += '</script></body></html>';
    return h;
}
