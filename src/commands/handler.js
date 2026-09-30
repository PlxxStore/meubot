const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const { users, config } = require('../database');
const axios = require('axios');

// ============================
// REFRESH TOKEN
// ============================
async function refreshAccessToken(refreshToken) {
    try {
        const params = new URLSearchParams();
        params.append('client_id', process.env.CLIENT_ID);
        params.append('client_secret', process.env.CLIENT_SECRET);
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', refreshToken);

        const resp = await axios.post(
            'https://discord.com/api/v10/oauth2/token',
            params,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        return {
            access_token: resp.data.access_token,
            refresh_token: resp.data.refresh_token,
            expires_in: resp.data.expires_in
        };
    } catch (err) {
        console.error('❌ [REFRESH] erro:', err.response?.data || err.message);
        return null;
    }
}

// ============================
// PULL WITH REFRESH
// ============================
async function pullWithRefresh(guildId, userId, accessToken, refreshToken, userData) {
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

    if (resp.status === 201 || resp.status === 204) {
        return { status: resp.status, refreshed: false };
    }

    const errCode = resp.data?.code;
    const isInvalidToken = errCode === 50025 || resp.data?.message?.includes('Invalid OAuth2 access token');

    if (isInvalidToken && refreshToken) {
        console.log(`🔄 [REFRESH] token expirado para ${userId}`);
        const newTokens = await refreshAccessToken(refreshToken);

        if (newTokens) {
            try {
                await users.set(userId, {
                    ...userData,
                    access_token: newTokens.access_token,
                    refresh_token: newTokens.refresh_token,
                    refreshedAt: new Date().toISOString()
                });
                console.log(`✅ [REFRESH] tokens salvos para ${userId}`);
            } catch (err) {
                console.error(`❌ [REFRESH] erro salvar:`, err.message);
            }

            resp = await axios.put(
                `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
                { access_token: newTokens.access_token },
                {
                    headers: {
                        Authorization: `Bot ${process.env.TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    validateStatus: false
                }
            );

            return { status: resp.status, refreshed: true, data: resp.data };
        }
    }

    return { status: resp.status, refreshed: false, data: resp.data };
}

// ============================
// MÓDULO PRINCIPAL
// ============================
module.exports = {
    async handleInteraction(interaction, client) {

        // ============================
        // BOTÕES
        // ============================
        if (interaction.isButton()) {

            // Ignora botões do sorteio
            if (interaction.customId.startsWith('sorteio_')) return;

            // Ignora botões do gift (parar)
            if (interaction.customId.startsWith('gift_')) return;

            if (interaction.customId === 'verify_button') {
                const clientId = process.env.CLIENT_ID;
                const redirectUri = encodeURIComponent(process.env.REDIRECT_URI);
                const scopes = encodeURIComponent('identify email guilds.join');
                const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}`;

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel('Clique aqui para verificar')
                            .setEmoji('1470325466828374077')
                            .setStyle(ButtonStyle.Link)
                            .setURL(oauthUrl),
                    );

                await interaction.reply({
                    components: [row],
                    flags: 64
                });
            }

            else if (interaction.customId === 'config_role') {
                const modal = new ModalBuilder().setCustomId('modal_role').setTitle('Configurar Cargo');
                const input = new TextInputBuilder().setCustomId('role_id').setLabel('ID do Cargo').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await interaction.showModal(modal);
            }

            else if (interaction.customId === 'config_logs') {
                const modal = new ModalBuilder().setCustomId('modal_logs').setTitle('Configurar Logs');
                const input = new TextInputBuilder().setCustomId('log_id').setLabel('ID do Canal de Logs').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await interaction.showModal(modal);
            }

            else if (interaction.customId === 'config_gift_logs') {
                const modal = new ModalBuilder().setCustomId('modal_gift_logs').setTitle('Configurar Logs de Gift');
                const input = new TextInputBuilder().setCustomId('gift_log_id').setLabel('ID do Canal de Logs de Gift').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await interaction.showModal(modal);
            }

            else if (interaction.customId === 'config_puxar') {
                const command = client.commands.get('puxar');
                if (command) await command.execute(interaction, client);
            }
        }

        // ============================
        // MODAIS
        // ============================
        else if (interaction.isModalSubmit()) {

            // Ignora modais do sorteio
            if (interaction.customId.startsWith('sorteio_modal')) return;

            // Ignora modais do gift
            if (interaction.customId === 'gift_modal') return;

            if (interaction.customId === 'modal_role') {
                const roleId = interaction.fields.getTextInputValue('role_id');
                await config.set('roleId', roleId);
                await interaction.reply({ content: `✅ Cargo atualizado para <@&${roleId}>`, flags: 64 });
            }

            else if (interaction.customId === 'modal_logs') {
                const logId = interaction.fields.getTextInputValue('log_id');
                await config.set('logChannelId', logId);
                await interaction.reply({ content: `✅ Canal de logs atualizado para <#${logId}>`, flags: 64 });
            }

            else if (interaction.customId === 'modal_gift_logs') {
                const giftLogId = interaction.fields.getTextInputValue('gift_log_id');
                await config.set('giftLogChannelId', giftLogId);
                await interaction.reply({ content: `🎁 Canal de logs de gift atualizado para <#${giftLogId}>`, flags: 64 });
            }

            else if (interaction.customId === 'puxar_modal') {
                const amount = parseInt(interaction.fields.getTextInputValue('amount'));
                const targetGuildId = interaction.fields.getTextInputValue('target_guild');

                const dbData = await users.all();
                let userList = [];

                if (Array.isArray(dbData)) {
                    userList = dbData.map(item => {
                        if (item.ID && item.data) return { id: item.ID, ...item.data };
                        return item;
                    });
                } else if (typeof dbData === 'object' && dbData !== null) {
                    userList = Object.keys(dbData).map(key => ({
                        id: key,
                        ...dbData[key]
                    }));
                }

                const toPull = userList.slice(0, amount);

                await interaction.reply({
                    content: `Powered by **[hyo](https://discord.com/users/1447028236050759700)**\n## -# Progresso: 0/${toPull.length}\n## -# Puxados: 0\n## -# Já estão: 0\n## -# Falhas: 0`,
                    flags: 64
                });

                let pulled = 0, alreadyIn = 0, failed = 0, processed = 0, refreshedCount = 0;

                for (const userData of toPull) {
                    const userId = userData.id;
                    const accessToken = userData.access_token;
                    const refreshToken = userData.refresh_token;

                    if (!accessToken || !userId || userId === "0") {
                        failed++;
                        processed++;
                        continue;
                    }

                    try {
                        const result = await pullWithRefresh(targetGuildId, userId, accessToken, refreshToken, userData);
                        if (result.refreshed) refreshedCount++;
                        if (result.status === 201) pulled++;
                        else if (result.status === 204) alreadyIn++;
                        else failed++;
                    } catch (err) {
                        failed++;
                    }
                    processed++;

                    if (processed % 5 === 0 || processed === toPull.length) {
                        await interaction.editReply({
                            content: `Powered by **[hyo](https://discord.com/users/1447028236050759700)**\n## -# Progresso: ${processed}/${toPull.length}\n## -# Puxados: ${pulled}\n## -# Já estão: ${alreadyIn}\n## -# Falhas: ${failed}`
                        });
                    }
                }

                await interaction.editReply({
                    content: `# Ação completa!\n## -# Membros puxados: ${pulled}\n## -# Já estavam no servidor: ${alreadyIn}\n## -# Falhas: ${failed}\n## -# Tokens renovados: ${refreshedCount}`
                });
            }
        }
    }
};