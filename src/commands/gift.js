const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize
} = require('discord.js');
const { users, config } = require('../database');

function gerarCodigo() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codigo = '';
    for (let i = 0; i < 6; i++) {
        codigo += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return codigo;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gift')
        .setDescription('Gera um gift de membros')
        .setDefaultMemberPermissions(0),

    async execute(interaction, client) {
        const OWNER_ID = process.env.OWNER_ID;
        const admins = (await config.get('admins')) || [];
        const isAdmin = interaction.user.id === OWNER_ID || admins.includes(interaction.user.id);

        if (!isAdmin) {
            return interaction.reply({
                content: '🚫 Você não tem permissão.',
                flags: MessageFlags.Ephemeral
            });
        }

        let total = 0;
        try {
            const all = await users.all();
            total = Array.isArray(all) ? all.length : 0;
        } catch (err) {
            console.error('❌ [GIFT] erro ao contar:', err.message);
        }

        if (total === 0) {
            return interaction.reply({
                content: '❌ Ninguém se verificou ainda.',
                flags: MessageFlags.Ephemeral
            });
        }

        const modal = new ModalBuilder()
            .setCustomId('gift_modal')
            .setTitle('Gerar Gift');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('quantidade')
                    .setLabel(`Quantidade (máx: ${total})`)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder(`Disponíveis: ${total}`)
            )
        );

        await interaction.showModal(modal);
    },

    async handleInteraction(interaction, client) {
        if (interaction.isModalSubmit() && interaction.customId === 'gift_modal') {
            const quantidade = parseInt(interaction.fields.getTextInputValue('quantidade'));

            let total = 0;
            try {
                const all = await users.all();
                total = Array.isArray(all) ? all.length : 0;
            } catch (err) {
                console.error('❌ [GIFT] erro:', err.message);
            }

            if (isNaN(quantidade) || quantidade < 1) {
                return interaction.reply({
                    content: '❌ Quantidade inválida.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (quantidade > total) {
                return interaction.reply({
                    content: `❌ Você só tem **${total}** verificados. Não dá pra gerar gift de **${quantidade}**.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            let codigo;
            let tentativas = 0;
            let giftExistente;
            do {
                codigo = gerarCodigo();
                const gifts = (await config.get('gifts')) || {};
                giftExistente = gifts[codigo];
                tentativas++;
                if (tentativas > 20) {
                    return interaction.reply({
                        content: '❌ Erro ao gerar código.',
                        flags: MessageFlags.Ephemeral
                    });
                }
            } while (giftExistente);

            const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
            const gift = {
                codigo,
                quantidade,
                usados: 0,
                criadoPor: interaction.user.id,
                criadoEm: Date.now(),
                expiresAt,
                status: 'ativo',
                servidorUsado: null
            };

            const gifts = (await config.get('gifts')) || {};
            gifts[codigo] = gift;
            await config.set('gifts', gifts);

            const baseUrl = process.env.REDIRECT_URI
                ? process.env.REDIRECT_URI.replace('/oauth2/callback', '')
                : 'https://meubot-8p7l.onrender.com';
            const link = `${baseUrl}/gift/${codigo}`;

            const dataExpira = new Date(expiresAt).toLocaleString('pt-BR');

            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('# 🎁 Gift Gerado!')
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Quantidade:** \`${quantidade} membros\`\n` +
                        `**Código:** \`${codigo}\`\n` +
                        `**Expira em:** \`${dataExpira}\`\n\n` +
                        `**Link:**\n${link}`
                    )
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        '⚠️ **Como usar:**\n' +
                        '1. Abra o link\n' +
                        '2. Adicione o bot no servidor\n' +
                        '3. Cole o ID e clique em Iniciar'
                    )
                );

            return interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }
    }
};