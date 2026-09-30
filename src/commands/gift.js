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
    SeparatorSpacingSize,
    EmbedBuilder
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

// ============================
// FUNÇÃO: Envia log de gift
// ============================
async function enviarLogGift(client, tipo, dados) {
    try {
        const logChannelId = await config.get('giftLogChannelId');
        if (!logChannelId) return;

        const channel = client.channels.cache.get(logChannelId);
        if (!channel) return;

        let embed;

        if (tipo === 'criado') {
            embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('🎁 Gift Criado')
                .addFields(
                    { name: 'Código', value: `\`${dados.codigo}\``, inline: true },
                    { name: 'Quantidade', value: `\`${dados.quantidade} membros\``, inline: true },
                    { name: 'Criado por', value: `<@${dados.criadoPor}>`, inline: true },
                    { name: 'Expira em', value: `<t:${Math.floor(dados.expiresAt / 1000)}:R>`, inline: true },
                    { name: 'Link', value: `${dados.link}` }
                )
                .setTimestamp();
        } else if (tipo === 'usado') {
            embed = new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle('🎁 Gift Usado')
                .addFields(
                    { name: 'Código', value: `\`${dados.codigo}\``, inline: true },
                    { name: 'Quantidade', value: `\`${dados.quantidade} membros\``, inline: true },
                    { name: 'Servidor', value: `${dados.guildName} (\`${dados.guildId}\`)`, inline: false },
                    { name: 'Status', value: '🔄 Puxando membros...', inline: false }
                )
                .setTimestamp();
        } else if (tipo === 'finalizado') {
            const cor = dados.parado ? 0xffa500 : (dados.puxados > 0 ? 0x57F287 : 0xED4245);
            embed = new EmbedBuilder()
                .setColor(cor)
                .setTitle(dados.parado ? '🛑 Gift Cancelado' : '✅ Gift Finalizado')
                .addFields(
                    { name: 'Código', value: `\`${dados.codigo}\``, inline: true },
                    { name: 'Servidor', value: `${dados.guildName}`, inline: true },
                    { name: '✅ Puxados', value: `\`${dados.puxados}\``, inline: true },
                    { name: '❌ Falhas', value: `\`${dados.falhas}\``, inline: true },
                    { name: '📊 Total', value: `\`${dados.total}\``, inline: true },
                    { name: 'Status', value: dados.parado ? '🛑 Cancelado pelo usuário' : '✅ Completado', inline: true }
                )
                .setTimestamp();
        } else if (tipo === 'deletado') {
            embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('🗑️ Gift Deletado')
                .addFields(
                    { name: 'Código', value: `\`${dados.codigo}\``, inline: true },
                    { name: 'Quantidade', value: `\`${dados.quantidade} membros\``, inline: true },
                    { name: 'Deletado por', value: `<@${dados.deletadoPor}>`, inline: true }
                )
                .setTimestamp();
        }

        if (embed) await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('❌ [GIFT LOG] erro:', err.message);
    }
}

module.exports = {
    enviarLogGift,

    data: new SlashCommandBuilder()
        .setName('gift')
        .setDescription('Gera um gift de membros')
        .setDefaultMemberPermissions(0),

    async execute(interaction, client) {
        const OWNER_ID = process.env.OWNER_ID;
        const admins = (await config.get('admins')) || [];
        const isAdmin = interaction.user.id === OWNER_ID || admins.includes(interaction.user.id);

        if (!isAdmin) {
            return interaction.reply({ content: '🚫 Você não tem permissão.', flags: 64 });
        }

        let total = 0;
        try {
            const all = await users.all();
            total = Array.isArray(all) ? all.length : 0;
        } catch (err) {
            console.error('❌ [GIFT] erro:', err.message);
        }

        if (total === 0) {
            return interaction.reply({ content: '❌ Ninguém se verificou ainda.', flags: 64 });
        }

        const modal = new ModalBuilder().setCustomId('gift_modal').setTitle('Gerar Gift');
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
            } catch (err) {}

            if (isNaN(quantidade) || quantidade < 1) {
                return interaction.reply({ content: '❌ Quantidade inválida.', flags: 64 });
            }

            if (quantidade > total) {
                return interaction.reply({
                    content: `❌ Você só tem **${total}** verificados.`,
                    flags: 64
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
                    return interaction.reply({ content: '❌ Erro ao gerar código.', flags: 64 });
                }
            } while (giftExistente);

            const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
            const baseUrl = process.env.REDIRECT_URI
                ? process.env.REDIRECT_URI.replace('/oauth2/callback', '')
                : 'https://meubot-8p7l.onrender.com';
            const link = `${baseUrl}/gift/${codigo}`;

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

            // Envia log
            await enviarLogGift(client, 'criado', { ...gift, link });

            const dataExpira = new Date(expiresAt).toLocaleString('pt-BR');

            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent('# 🎁 Gift Gerado!'))
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
                        '⚠️ **Como usar:**\n1. Abra o link\n2. Adicione o bot\n3. Cole o ID e clique em Iniciar'
                    )
                );

            return interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | 64
            });
        }
    }
};