const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { config } = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gift-list')
        .setDescription('Lista todos os gifts criados')
        .setDefaultMemberPermissions(0),

    async execute(interaction, client) {
        const OWNER_ID = process.env.OWNER_ID;
        const admins = (await config.get('admins')) || [];
        const isAdmin = interaction.user.id === OWNER_ID || admins.includes(interaction.user.id);

        if (!isAdmin) {
            return interaction.reply({ content: '🚫 Você não tem permissão.', flags: 64 });
        }

        const gifts = (await config.get('gifts')) || {};
        const lista = Object.values(gifts).sort((a, b) => b.criadoEm - a.criadoEm);

        if (lista.length === 0) {
            return interaction.reply({
                content: '📭 Nenhum gift foi criado ainda.',
                flags: 64
            });
        }

        let descricao = '';
        let ativos = 0, esgotados = 0, expirados = 0;

        for (const g of lista.slice(0, 25)) {
            const expirado = Date.now() > g.expiresAt;
            let status = '⏰ Ativo';

            if (g.status === 'esgotado') {
                status = '✅ Esgotado';
                esgotados++;
            } else if (expirado) {
                status = '❌ Expirado';
                expirados++;
            } else {
                ativos++;
            }

            descricao += `\`${g.codigo}\` — **${g.quantidade} membros** — ${status}\n`;
        }

        if (lista.length > 25) {
            descricao += `\n_... e mais ${lista.length - 25} gifts_`;
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`🎁 Gifts (${lista.length})`)
            .setDescription(descricao)
            .addFields(
                { name: '⏰ Ativos', value: `\`${ativos}\``, inline: true },
                { name: '✅ Esgotados', value: `\`${esgotados}\``, inline: true },
                { name: '❌ Expirados', value: `\`${expirados}\``, inline: true }
            )
            .setFooter({ text: 'Use /gift-info CODIGO pra ver detalhes' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed], flags: 64 });
    }
};