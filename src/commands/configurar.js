const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { users, config } = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Abre o painel de configuração do bot.'),

    async execute(interaction, client) {
        // Pega os dados com await
        let membersVerified = 0;
        let logChannelId = 'Não configurado';
        let roleId = 'Não configurado';
        let giftLogChannelId = 'Não configurado';

        try {
            const allUsers = await users.all();
            membersVerified = Array.isArray(allUsers) ? allUsers.length : 0;
        } catch (err) {
            console.error('❌ [PAINEL] erro users:', err.message);
        }

        try {
            const dbLogId = await config.get('logChannelId');
            logChannelId = dbLogId || process.env.LOG_CHANNEL_ID || 'Não configurado';
        } catch (err) {
            console.error('❌ [PAINEL] erro log:', err.message);
        }

        try {
            const dbRoleId = await config.get('roleId');
            roleId = dbRoleId || process.env.ROLE_ID || 'Não configurado';
        } catch (err) {
            console.error('❌ [PAINEL] erro role:', err.message);
        }

        try {
            const dbGiftLogId = await config.get('giftLogChannelId');
            giftLogChannelId = dbGiftLogId || 'Não configurado';
        } catch (err) {
            console.error('❌ [PAINEL] erro gift log:', err.message);
        }

        const ping = `${client.ws.ping}ms`;

        const clientId = process.env.CLIENT_ID;
        const redirectUri = encodeURIComponent(process.env.REDIRECT_URI);
        const scopes = encodeURIComponent('identify email guilds.join');
        const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}`;

        const roleDisplay = roleId !== 'Não configurado' ? `<@&${roleId}>` : '`Não configurado`';
        const logDisplay = logChannelId !== 'Não configurado' ? `<#${logChannelId}>` : '`Não configurado`';
        const giftLogDisplay = giftLogChannelId !== 'Não configurado' ? `<#${giftLogChannelId}>` : '`Não configurado`';

        const embed = new EmbedBuilder()
            .setColor('#26272F')
            .setThumbnail(client.user.displayAvatarURL())
            .setTitle('## Painel de Gerenciamento')
            .setDescription(`Latência do bot: \`${ping}\`\nCréditos: [hyo](https://discord.com/users/1447028236050759700)`)
            .addFields(
                { name: 'Cargo de Verificado', value: roleDisplay, inline: true },
                { name: 'Canal de Logs', value: logDisplay, inline: true },
                { name: 'Membros Verificados', value: `\`${membersVerified}\``, inline: true },
                { name: 'Canal de Logs de Gift', value: giftLogDisplay, inline: true }
            );

        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Primary)
                    .setLabel("Cargo")
                    .setEmoji({ id: "1470866627724705968" })
                    .setCustomId("config_role"),
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Primary)
                    .setLabel("Logs")
                    .setEmoji({ id: "1470866622414716999" })
                    .setCustomId("config_logs"),
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setLabel("Desenvolvedor")
                    .setEmoji({ id: "1470558970954383605" })
                    .setURL("https://discord.com/users/1447028236050759700"),
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Success)
                    .setLabel("Puxar Membros")
                    .setEmoji({ id: "1470866629700092110" })
                    .setCustomId("config_puxar"),
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Primary)
                    .setLabel("Logs de Gift")
                    .setEmoji('🎁')
                    .setCustomId("config_gift_logs"),
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setLabel("Testar Oauth2")
                    .setURL(oauthUrl),
            );

        await interaction.reply({
            embeds: [embed],
            components: [row1, row2],
            flags: 64
        });
    },
};