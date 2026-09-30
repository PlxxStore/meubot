const { SlashCommandBuilder } = require('discord.js');
const { config } = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gift-delete')
        .setDescription('Deleta um gift')
        .setDefaultMemberPermissions(0)
        .addStringOption(opt =>
            opt.setName('codigo')
                .setDescription('Código do gift')
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
            return interaction.reply({ content: `❌ Gift \`${codigo}\` não encontrado.`, flags: 64 });
        }

        delete gifts[codigo];
        await config.set('gifts', gifts);

        // Tenta enviar log (se a função existir)
        try {
            const { enviarLogGift } = require('./gift');
            if (enviarLogGift) {
                await enviarLogGift(client, 'deletado', {
                    codigo,
                    quantidade: gift.quantidade,
                    deletadoPor: interaction.user.id
                });
            }
        } catch (err) {
            console.error('❌ [GIFT-DELETE] erro no log:', err.message);
        }

        return interaction.reply({
            content: `🗑️ Gift \`${codigo}\` deletado com sucesso.`,
            flags: 64
        });
    }
};