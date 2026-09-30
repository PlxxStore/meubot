const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { config } = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gift-info')
        .setDescription('Mostra informações de um gift')
        .setDefaultMemberPermissions(0)
        .addStringOption(opt =>
            opt.setName('codigo')
                .setDescription('Código do gift (ex: A7K9X2)')
                .setRequired(true)
        ),

    async execute(interaction, client) {
        const OWNER_ID = process.env.OWNER_ID;
        const admins = (await config.get('admins')) || [];
        const isAdmin = interaction.user.id === OWNER_ID || admins.includes(interaction.user.id);

        if (!isAdmin) {
            return interaction.reply({ content: '🚫 Você não tem permissão.', flags: 64 });
        }

        const codigo = interaction.options.getString('codigo').toUpperCase().trim();
        const gifts = (await config.get('gifts')) || {};
        const gift = gifts[codigo];

        if (!gift) {
            return interaction.reply({
                content: `❌ Gift \`${codigo}\` não encontrado.`,
                flags: 64
            });
        }

        const expirado = Date.now() > gift.expiresAt;
        let status, cor;

        if (gift.status === 'esgotado') {
            status = '✅ Esgotado';
            cor = 0x57F287;
        } else if (expirado) {
            status = '❌ Expirado';
            cor = 0xED4245;
        } else {
            status = '⏰ Ativo';
            cor = 0xFEE75C;
        }

        const embed = new EmbedBuilder()
            .setColor(cor)
            .setTitle(`🎁 Gift \`${gift.codigo}\``)
            .addFields(
                { name: '📦 Quantidade', value: `\`${gift.quantidade} membros\``, inline: true },
                { name: '📊 Status', value: `\`${status}\``, inline: true },
                { name: '👤 Criado por', value: `<@${gift.criadoPor}>`, inline: true },
                { name: '📅 Criado em', value: `<t:${Math.floor(gift.criadoEm / 1000)}:F>`, inline: true },
                { name: '⏰ Expira em', value: `<t:${Math.floor(gift.expiresAt / 1000)}:F>`, inline: true }
            )
            .setTimestamp();

        if (gift.servidorUsado) {
            embed.addFields(
                { name: '🏠 Servidor usado', value: `\`${gift.servidorUsado}\``, inline: false }
            );
        }

        if (gift.esgotadoEm) {
            embed.addFields(
                { name: '📅 Usado em', value: `<t:${Math.floor(gift.esgotadoEm / 1000)}:F>`, inline: true }
            );
        }

        if (gift.puxados !== undefined) {
            embed.addFields(
                { name: '✅ Puxados', value: `\`${gift.puxados}\``, inline: true },
                { name: '❌ Falhas', value: `\`${gift.falhas || 0}\``, inline: true }
            );
        }

        return interaction.reply({ embeds: [embed], flags: 64 });
    }
};