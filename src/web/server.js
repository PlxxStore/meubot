console.log('🚀 [server.js] arquivo foi carregado');

const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

module.exports = (app, client) => {
    console.log('🚀 [server.js] função foi executada e rotas vão ser registradas');

    // Helper: pega o database sem quebrar
    let users, config;
    try {
        const db = require('../database');
        users = db.users;
        config = db.config;
        console.log('✅ [server.js] database importado OK');
    } catch (err) {
        console.error('❌ [server.js] erro ao importar database:', err.message);
        users = { set: async () => {}, get: async () => undefined };
        config = { get: async () => undefined, set: async () => {} };
    }

    // ============================
    // ROTA RAIZ
    // ============================
    app.get('/', (req, res) => {
        res.render('index.html');
    });

    // ============================
    // ROTA DE TESTE
    // ============================
    app.get('/ping', (req, res) => {
        res.status(200).send('pong ✅ server.js tá rodando');
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

            const userDevice = req.headers['user-agent'] || 'Unknown';

            // Salva no banco (agora com await)
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
                    verifiedAt: new Date().toISOString()
                });
                console.log('💾 [DB] usuário salvo:', userData.id);
            } catch (err) {
                console.error('❌ [DB] erro ao salvar user:', err.message);
            }

            const guildId = process.env.GUILD_ID;
            let roleId = process.env.ROLE_ID;
            try {
                const configRoleId = await config.get('roleId');
                if (configRoleId) roleId = configRoleId;
            } catch (err) {
                console.error('❌ [CONFIG] erro ao ler roleId:', err.message);
            }

            console.log('🔍 [CARGO] guildId:', guildId);
            console.log('🔍 [CARGO] roleId:', roleId);
            console.log('🔍 [CARGO] userData.id:', userData.id);
            console.log('🔍 [CARGO] tem access_token?', !!access_token);

            if (!guildId) {
                console.error('❌ [CARGO] GUILD_ID não configurado!');
            } else if (!roleId) {
                console.error('❌ [CARGO] ROLE_ID não configurado!');
            } else {
                try {
                    const putData = {
                        access_token,
                        roles: [roleId]
                    };

                    console.log('📤 [CARGO] enviando PUT para Discord...');

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

                    console.log('📥 [CARGO] resposta do Discord:', resp.status);

                    if (resp.status === 201) {
                        console.log('✅ [CARGO] usuário ADICIONADO ao servidor COM o cargo');
                    } else if (resp.status === 204) {
                        console.log('🔧 [CARGO] usuário já estava, aplicando cargo manualmente...');
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
                        console.log('📥 [CARGO] resposta do PUT /roles:', roleResp.status);
                        if (roleResp.status === 204) {
                            console.log('✅ [CARGO] cargo APLICADO de verdade!');
                        } else {
                            console.error('❌ [CARGO] erro ao aplicar cargo:', roleResp.status, JSON.stringify(roleResp.data));
                        }
                    } else {
                        console.error('❌ [CARGO] erro do Discord:', resp.status, JSON.stringify(resp.data));
                    }
                } catch (err) {
                    console.error('❌ [CARGO] exceção:', err.message);
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
            const accountDays = Math.floor(
                (now - createdAt) / (1000 * 60 * 60 * 24)
            );

            try {
                await sendLog(client, userData, ip, userDevice, config);
                console.log('📝 [LOG] embed enviada pro canal');
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
            console.error('❌ [CALLBACK] erro geral:', error.message);
            if (error.response) {
                console.error('❌ [CALLBACK] status:', error.response.status);
                console.error('❌ [CALLBACK] data:', JSON.stringify(error.response.data));
            }
            res.redirect(
                `/error?msg=${encodeURIComponent(
                    error.response
                        ? JSON.stringify(error.response.data)
                        : error.message
                )}`
            );
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
async function sendLog(client, userData, ip, userDevice, config) {
    let logChannelId = process.env.LOG_CHANNEL_ID;
    try {
        const configLogId = await config.get('logChannelId');
        if (configLogId) logChannelId = configLogId;
    } catch (err) {
        console.error('❌ [LOG] erro ao ler logChannelId:', err.message);
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
    } catch {
        return;
    }

    const creationDate = new Date(
        Number((BigInt(userData.id) >> 22n) + 1420070400000n)
    );

    const now = new Date();
    const creationAccountDays = Math.floor(
        (now - creationDate) / (1000 * 60 * 60 * 24)
    );

    const userAvatar = userData.avatar
        ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
        : 'https://cdn.discordapp.com/embed/avatars/0.png';

    const embed = new EmbedBuilder()
        .setColor(4806097)
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
            { name: 'Dispositivo', value: `\`${userDevice.substring(0, 1020)}\`` },
            { name: 'IP', value: `\`${ip}\`` }
        )
        .setTimestamp();

    await webhook.send({ embeds: [embed] });
}
