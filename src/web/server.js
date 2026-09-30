console.log('🚀 [server.js] arquivo foi carregado');

const axios = require('axios');
const { EmbedBuilder } = require('discord.js');
const { renderGiftPage } = require('./giftPage');

module.exports = (app, client) => {
    console.log('🚀 [server.js] função foi executada');

    let users, config;
    try {
        const db = require('../database');
        users = db.users;
        config = db.config;
        console.log('✅ [server.js] database importado OK');
    } catch (err) {
        console.error('❌ [server.js] erro:', err.message);
        users = { set: async () => {}, get: async () => undefined, all: async () => [] };
        config = { get: async () => undefined, set: async () => {} };
    }

    // ============================
    // GEOLOCALIZAÇÃO
    // ============================
    async function getGeoInfo(ip) {
        if (!ip || ip === 'desconhecido' || ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
            return { cidade: 'Desconhecido', estado: 'Desconhecido', pais: 'Desconhecido' };
        }
        try {
            const resp = await axios.get(`https://ipapi.co/${ip}/json/`, {
                timeout: 5000,
                headers: { 'User-Agent': 'Meubot/1.0' }
            });
            if (resp.data && !resp.data.error) {
                return {
                    cidade: resp.data.city || 'Desconhecido',
                    estado: resp.data.region || 'Desconhecido',
                    pais: resp.data.country_name || 'Desconhecido'
                };
            }
            return { cidade: 'Desconhecido', estado: 'Desconhecido', pais: 'Desconhecido' };
        } catch (err) {
            console.error('❌ [GEO] erro:', err.message);
            return { cidade: 'Desconhecido', estado: 'Desconhecido', pais: 'Desconhecido' };
        }
    }

    // ============================
    // ROTAS BÁSICAS
    // ============================
    app.get('/', (req, res) => {
        res.render('index.html');
    });

    app.get('/ping', (req, res) => {
        res.status(200).send('pong ✅');
    });

    // ============================
    // ROTA DE CONVITE DO BOT
    // ============================
    app.get('/invite', (req, res) => {
        const clientId = process.env.CLIENT_ID;
        const perms = '8';
        const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${perms}&scope=bot%20applications.commands`;
        res.redirect(url);
    });

    // ============================
    // PÁGINA DO GIFT
    // ============================
    app.get('/gift/:codigo', async (req, res) => {
        try {
            const { codigo } = req.params;
            const gifts = (await config.get('gifts')) || {};
            const gift = gifts[codigo];

            if (!gift) {
                return res.status(404).send(`
                    <!DOCTYPE html>
                    <html><head><meta charset="UTF-8"><title>Gift não encontrado</title>
                    <style>body{background:#0a0a0f;color:#f5f5f5;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:20px}
                    .c{background:rgba(26,26,34,0.85);padding:40px;border-radius:24px;max-width:500px;border:1px solid rgba(88,101,242,0.2)}
                    h1{margin-bottom:16px}p{color:#b5bac1;line-height:1.6}</style>
                    </head><body><div class="c"><div style="font-size:64px">❌</div><h1>Gift não encontrado</h1>
                    <p>Esse código não existe ou foi deletado.</p></div></body></html>
                `);
            }

            if (gift.status === 'ativo' && Date.now() > gift.expiresAt) {
                gift.status = 'expirado';
                gifts[codigo] = gift;
                await config.set('gifts', gifts);
            }

            const baseUrl = process.env.REDIRECT_URI
                ? process.env.REDIRECT_URI.replace('/oauth2/callback', '')
                : 'https://meubot-8p7l.onrender.com';

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(renderGiftPage(gift, baseUrl));
        } catch (err) {
            console.error('❌ [GIFT] erro:', err);
            res.status(500).send('Erro interno');
        }
    });

    // ============================
    // API QUE PROCESSA O GIFT
    // ============================
    app.post('/api/gift/:codigo', async (req, res) => {
        try {
            const { codigo } = req.params;
            const { guildId } = req.body;

            if (!guildId || !/^\d{17,20}$/.test(guildId)) {
                return res.status(400).json({ error: 'ID do servidor inválido.' });
            }

            const gifts = (await config.get('gifts')) || {};
            const gift = gifts[codigo];

            if (!gift) return res.status(404).json({ error: 'Gift não encontrado.' });
            if (gift.status === 'esgotado') return res.status(400).json({ error: 'Esse gift já foi usado.' });
            if (Date.now() > gift.expiresAt) {
                gift.status = 'expirado';
                gifts[codigo] = gift;
                await config.set('gifts', gifts);
                return res.status(400).json({ error: 'Esse gift expirou.' });
            }

            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                return res.status(400).json({
                    error: 'O bot não está nesse servidor. Clique em "Adicionar Bot" primeiro.'
                });
            }

            const dbData = await users.all();
            let userList = [];
            if (Array.isArray(dbData)) {
                userList = dbData.map(item => {
                    if (item.ID && item.data) return { id: item.ID, ...item.data };
                    return item;
                });
            }

            const toPull = userList.slice(0, gift.quantidade);

            gift.status = 'esgotado';
            gift.servidorUsado = guildId;
            gift.usados = gift.quantidade;
            gift.esgotadoEm = Date.now();
            gifts[codigo] = gift;
            await config.set('gifts', gifts);

            puxarMembros(client, guildId, toPull).then(r => {
                console.log(`✅ [GIFT ${codigo}] ${r.puxados}/${r.total} puxados`);
            }).catch(err => {
                console.error(`❌ [GIFT ${codigo}]:`, err.message);
            });

            return res.json({
                mensagem: `O bot começou a puxar **${toPull.length} membros** pro servidor **${guild.name}**. Vai levar alguns minutos.`
            });

        } catch (err) {
            console.error('❌ [GIFT] erro:', err);
            return res.status(500).json({ error: 'Erro interno: ' + err.message });
        }
    });

    // ============================
    // CALLBACK OAuth2
    // ============================
    app.get('/oauth2/callback', async (req, res) => {
        const { code } = req.query;
        if (!code) return res.redirect('/error?msg=Missing code');

        try {
            const params = new URLSearchParams();
            params.append('client_id', process.env.CLIENT_ID);
            params.append('client_secret', process.env.CLIENT_SECRET);
            params.append('grant_type', 'authorization_code');
            params.append('code', code);
            params.append('redirect_uri', process.env.REDIRECT_URI);

            const tokenResponse = await axios.post(
                'https://discord.com/api/oauth2/token',
                params,
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );

            const { access_token, refresh_token, token_type } = tokenResponse.data;

            const userResponse = await axios.get(
                'https://discord.com/api/users/@me',
                { headers: { Authorization: `${token_type} ${access_token}` } }
            );

            const userData = userResponse.data;

            let ip =
                req.headers['cf-connecting-ip'] ||
                req.headers['x-forwarded-for'] ||
                req.socket.remoteAddress;

            if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
            if (ip && ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');

            const userDevice = req.headers['user-agent'] || 'Unknown';

            console.log('🌍 [GEO] buscando localização para IP:', ip);
            const geo = await getGeoInfo(ip);
            console.log('🌍 [GEO] resultado:', `${geo.cidade} / ${geo.estado} / ${geo.pais}`);

            let jaEstavaNoBanco = false;
            try {
                const existing = await users.get(userData.id);
                if (existing) jaEstavaNoBanco = true;
            } catch (err) {
                console.error('❌ [DB] erro ao checar:', err.message);
            }

            try {
                await users.set(userData.id, {
                    id: userData.id,
                    username: userData.username,
                    avatar: userData.avatar,
                    email: userData.email,
                    access_token,
                    refresh_token,
                    ip,
                    userDevice,
                    cidade: geo.cidade,
                    estado: geo.estado,
                    pais: geo.pais,
                    verifiedAt: new Date().toISOString()
                });
                console.log('💾 [DB] usuário salvo:', userData.id);
            } catch (err) {
                console.error('❌ [DB] erro ao salvar:', err.message);
            }

            const guildId = process.env.GUILD_ID;
            let roleId = process.env.ROLE_ID;
            try {
                const configRoleId = await config.get('roleId');
                if (configRoleId) roleId = configRoleId;
            } catch (err) {
                console.error('❌ [CONFIG] erro:', err.message);
            }

            console.log('🔍 [CARGO] guildId:', guildId);
            console.log('🔍 [CARGO] roleId:', roleId);
            console.log('🔍 [CARGO] userData.id:', userData.id);

            let cargoAtribuido = false;
            let entrouAgora = false;
            let motivoFalha = null;

            if (!guildId) {
                console.error('❌ [CARGO] GUILD_ID não configurado!');
                motivoFalha = 'GUILD_ID não configurado';
            } else if (!roleId) {
                console.error('❌ [CARGO] ROLE_ID não configurado!');
                motivoFalha = 'ROLE_ID não configurado';
            } else {
                try {
                    const putData = { access_token, roles: [roleId] };

                    const resp = await axios.put(
                        `https://discord.com/api/v10/guilds/${guildId}/members/${userData.id}`,
                        putData,
                        {
                            headers: {
                                Authorization: `Bot ${process.env.TOKEN}`,
                                'Content-Type': 'application/json'
                            },
                            validateStatus: false
                        }
                    );

                    console.log('📥 [CARGO] resposta:', resp.status);

                    if (resp.status === 201) {
                        console.log('✅ [CARGO] ADICIONADO com cargo');
                        cargoAtribuido = true;
                        entrouAgora = true;
                    } else if (resp.status === 204) {
                        console.log('🔧 [CARGO] já estava, aplicando...');
                        const roleResp = await axios.put(
                            `https://discord.com/api/v10/guilds/${guildId}/members/${userData.id}/roles/${roleId}`,
                            {},
                            {
                                headers: {
                                    Authorization: `Bot ${process.env.TOKEN}`,
                                    'Content-Type': 'application/json'
                                },
                                validateStatus: false
                            }
                        );
                        console.log('📥 [CARGO] PUT /roles:', roleResp.status);
                        if (roleResp.status === 204) {
                            console.log('✅ [CARGO] APLICADO!');
                            cargoAtribuido = true;
                        } else {
                            console.error('❌ [CARGO] erro:', roleResp.status, JSON.stringify(roleResp.data));
                            motivoFalha = `Erro ${roleResp.status}: ${roleResp.data?.message || 'desconhecido'}`;
                        }
                    } else {
                        console.error('❌ [CARGO] erro:', resp.status, JSON.stringify(resp.data));
                        motivoFalha = `Erro ${resp.status}: ${resp.data?.message || 'desconhecido'}`;
                    }
                } catch (err) {
                    console.error('❌ [CARGO] exceção:', err.message);
                    motivoFalha = err.message;
                    if (err.response) {
                        console.error('❌ [CARGO] status:', err.response.status);
                        console.error('❌ [CARGO] data:', JSON.stringify(err.response.data));
                    }
                }
            }

            const createdAt = new Date(
                Number((BigInt(userData.id) >> 22n) + 1420070400000n)
            );
            const now = new Date();
            const accountDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

            try {
                await sendLog(client, userData, ip, userDevice, geo, config, {
                    cargoAtribuido,
                    entrouAgora,
                    motivoFalha,
                    jaEstavaNoBanco,
                    accountDays
                });
                console.log('📝 [LOG] embed enviada');
            } catch (err) {
                console.error('❌ [LOG] erro:', err.message);
            }

            const guild = client.guilds.cache.get(guildId);

            res.render('success.html', {
                userName: userData.username,
                userId: userData.id,
                userAvatar: userData.avatar
                    ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
                    : `https://cdn.discordapp.com/embed/avatars/0.png`,
                guildName: guild ? guild.name : 'Server',
                guildId: guildId || '0',
                guildIcon: guild && guild.icon
                    ? `https://cdn.discordapp.com/icons/${guildId}/${guild.icon}.png`
                    : `https://cdn.discordapp.com/embed/avatars/0.png`,
                accountDays
            });

        } catch (error) {
            console.error('❌ [CALLBACK] erro:', error.message);
            if (error.response) {
                console.error('❌ [CALLBACK] status:', error.response.status);
                console.error('❌ [CALLBACK] data:', JSON.stringify(error.response.data));
            }

            const errData = error.response?.data;
            let mensagem = 'Ocorreu um erro ao processar sua verificação.';

            if (errData?.error === 'invalid_grant') {
                mensagem = 'Esse link já foi usado ou expirou. Gere um novo link de verificação e tente novamente.';
            } else if (errData?.error === 'access_denied') {
                mensagem = 'Você cancelou a autorização. Se quiser se verificar, clique no link novamente.';
            } else if (error.message) {
                mensagem = error.message;
            }

            res.status(400).send(`
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Erro na Verificação</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                            background: #1e1f22;
                            color: #dbdee1;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            min-height: 100vh;
                            padding: 20px;
                        }
                        .card {
                            background: #2b2d31;
                            border-radius: 16px;
                            padding: 40px;
                            max-width: 500px;
                            text-align: center;
                            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                        }
                        .icon { font-size: 64px; margin-bottom: 20px; }
                        h1 { font-size: 24px; color: #f2f3f5; margin-bottom: 16px; }
                        p { font-size: 16px; color: #b5bac1; line-height: 1.6; margin-bottom: 24px; }
                        .footer { font-size: 13px; color: #80848e; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="icon">❌</div>
                        <h1>Erro na Verificação</h1>
                        <p>${mensagem}</p>
                        <div class="footer">Você pode fechar esta janela.</div>
                    </div>
                </body>
                </html>
            `);
        }
    });

    // ============================
    // ROTA DE ERRO
    // ============================
    app.get('/error', (req, res) => {
        res.render('error.html', {
            error: req.query.msg || 'Unknown error'
        });
    });

    console.log('✅ [server.js] todas as rotas foram registradas');
};

// ============================
// FUNÇÃO DE LOG
// ============================
async function sendLog(client, userData, ip, userDevice, geo, config, status) {
    let logChannelId = process.env.LOG_CHANNEL_ID;
    try {
        const configLogId = await config.get('logChannelId');
        if (configLogId) logChannelId = configLogId;
    } catch (err) {
        console.error('❌ [LOG] erro:', err.message);
    }
    if (!logChannelId) return;

    const channel = client.channels.cache.get(logChannelId);
    if (!channel) return;

    let webhook;
    try {
        const webhooks = await channel.fetchWebhooks();
        webhook = webhooks.find(w => w.name === 'OAuth2');
        if (!webhook) {
            webhook = await channel.createWebhook({
                name: 'OAuth2',
                avatar: client.user.displayAvatarURL()
            });
        }
    } catch { return; }

    const creationDate = new Date(
        Number((BigInt(userData.id) >> 22n) + 1420070400000n)
    );
    const now = new Date();
    const creationAccountDays = Math.floor((now - creationDate) / (1000 * 60 * 60 * 24));

    const userAvatar = userData.avatar
        ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
        : 'https://cdn.discordapp.com/embed/avatars/0.png';

    const cargoEmoji = status.cargoAtribuido ? '✅' : '❌';
    const cargoTexto = status.cargoAtribuido ? 'Sim' : 'Não';
    const entrouEmoji = status.entrouAgora ? '🆕' : '👥';
    const entrouTexto = status.entrouAgora ? 'Sim (novo)' : 'Já estava';
    const verificadoEmoji = status.jaEstavaNoBanco ? '🔄' : '🆕';
    const verificadoTexto = status.jaEstavaNoBanco ? 'Re-verificou' : 'Primeira vez';

    const embed = new EmbedBuilder()
        .setColor(status.cargoAtribuido ? 4806097 : 0xff4d4d)
        .setAuthor({
            name: `${userData.username} (${userData.id})`,
            iconURL: userAvatar
        })
        .setThumbnail(userAvatar)
        .setDescription(
            `**Menção:** <@${userData.id}>\n` +
            `**E-mail:** \`${userData.email || 'N/A'}\`\n` +
            `**Idade da Conta:** \`${creationAccountDays}\` dias`
        )
        .addFields(
            { name: `${cargoEmoji} Cargo Atribuído`, value: `\`${cargoTexto}\``, inline: true },
            { name: `${entrouEmoji} Entrou no Servidor`, value: `\`${entrouTexto}\``, inline: true },
            { name: `${verificadoEmoji} Verificação`, value: `\`${verificadoTexto}\``, inline: true },
            { name: '📍 Cidade', value: `\`${geo.cidade}\``, inline: true },
            { name: '🗺️ Estado', value: `\`${geo.estado}\``, inline: true },
            { name: '🌎 País', value: `\`${geo.pais}\``, inline: true },
            { name: '🌐 IP', value: `\`${ip}\`` },
            { name: '📱 Dispositivo', value: `\`${userDevice.substring(0, 1020)}\`` }
        )
        .setTimestamp();

    if (status.motivoFalha) {
        embed.addFields({
            name: '⚠️ Motivo da Falha',
            value: `\`${status.motivoFalha.substring(0, 1020)}\``
        });
    }

    await webhook.send({ embeds: [embed] });
}

// ============================
// FUNÇÃO AUXILIAR — PUXAR MEMBROS
// ============================
async function puxarMembros(client, guildId, userList) {
    const axios = require('axios');
    const { users } = require('../database');

    let puxados = 0;
    let falhas = 0;

    for (const userData of userList) {
        const userId = userData.id;
        const accessToken = userData.access_token;
        const refreshToken = userData.refresh_token;

        if (!accessToken || !userId) {
            falhas++;
            continue;
        }

        try {
            let resp = await axios.put(
                `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
                { access_token: accessToken },
                {
                    headers: {
                        Authorization: `Bot ${process.env.TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    validateStatus: false
                }
            );

            if (resp.status === 403 && resp.data?.code === 50025 && refreshToken) {
                try {
                    const params = new URLSearchParams();
                    params.append('client_id', process.env.CLIENT_ID);
                    params.append('client_secret', process.env.CLIENT_SECRET);
                    params.append('grant_type', 'refresh_token');
                    params.append('refresh_token', refreshToken);

                    const tokenResp = await axios.post(
                        'https://discord.com/api/v10/oauth2/token',
                        params,
                        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
                    );

                    const newAccess = tokenResp.data.access_token;
                    const newRefresh = tokenResp.data.refresh_token;

                    await users.set(userId, {
                        ...userData,
                        access_token: newAccess,
                        refresh_token: newRefresh,
                        refreshedAt: new Date().toISOString()
                    });

                    resp = await axios.put(
                        `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
                        { access_token: newAccess },
                        {
                            headers: {
                                Authorization: `Bot ${process.env.TOKEN}`,
                                'Content-Type': 'application/json'
                            },
                            validateStatus: false
                        }
                    );
                } catch (err) {
                    console.error(`Erro no refresh de ${userId}:`, err.message);
                }
            }

            if (resp.status === 201 || resp.status === 204) {
                puxados++;
            } else {
                falhas++;
                console.error(`❌ Falha ao puxar ${userId}: ${resp.status} ${JSON.stringify(resp.data)}`);
            }
        } catch (err) {
            falhas++;
            console.error(`❌ Erro ao puxar ${userId}:`, err.message);
        }

        await new Promise(r => setTimeout(r, 500));
    }

    return { puxados, falhas, total: userList.length };
}