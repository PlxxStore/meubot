const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags
} = require('discord.js');
const { users, config } = require('../database');

// ============================
// UTILITÁRIOS
// ============================
function parseTempo(str) {
    // Aceita "1d 2h 30m", "1d2h30m", "30m", etc.
    const regex = /(\d+)\s*(d|dia|dias|h|hora|horas|m|min|minuto|minutos)/gi;
    let total = 0;
    let match;
    while ((match = regex.exec(str)) !== null) {
        const valor = parseInt(match[1]);
        const unidade = match[2].toLowerCase();
        if (unidade.startsWith('d')) total += valor * 24 * 60 * 60 * 1000;
        else if (unidade.startsWith('h')) total += valor * 60 * 60 * 1000;
        else if (unidade.startsWith('m')) total += valor * 60 * 1000;
    }
    return total;
}

function formatarTempo(ms) {
    if (ms <= 0) return 'encerrado';
    const dias = Math.floor(ms / (24 * 60 * 60 * 1000));
    const horas = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutos = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    const partes = [];
    if (dias > 0) partes.push(`${dias}d`);
    if (horas > 0) partes.push(`${horas}h`);
    if (minutos > 0) partes.push(`${minutos}m`);
    return partes.join(' ') || 'menos de 1min';
}

// ============================
// CRIA A CONTAINER V2 DO SORTEIO
// ============================
function criarContainerSorteio(sorteio, totalParticipantes = 0) {
    const tempoRestante = sorteio.endsAt - Date.now();

    const container = new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# 🎉 ${sorteio.titulo}`)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(sorteio.descricao || '_Sem descrição_')
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `⏰ **Termina em:** ${formatarTempo(tempoRestante)}\n` +
                `🏆 **Ganhadores:** ${sorteio.ganhadores}\n` +
                `👥 **Participantes:** ${totalParticipantes}`
            )
        )
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`sorteio_participar_${sorteio.id}`)
                    .setLabel(sorteio.nomeBotao || 'Participar')
                    .setEmoji('🎟️')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`sorteio_verify_${sorteio.id}`)
                    .setLabel('Verify')
                    .setEmoji('✅')
                    .setStyle(ButtonStyle.Success)
            )
        );

    return container;
}

// ============================
// COMANDO
// ============================
module.exports = {
    data: new SlashCommandBuilder()
        .setName('sorteio')
        .setDescription('Cria um sorteio no canal')
        .setDefaultMemberPermissions(0), // esconde pra não-admins

    async execute(interaction, client) {
        // 🔒 Checagem de admin
        const OWNER_ID = process.env.OWNER_ID;
        const admins = config.get('admins') || [];
        const isAdmin = interaction.user.id === OWNER_ID || admins.includes(interaction.user.id);

        if (!isAdmin) {
            return interaction.reply({
                content: '🚫 Você não tem permissão pra usar esse comando.',
                flags: MessageFlags.Ephemeral
            });
        }

        // ============================
        // MODAL 1 — Configuração básica
        // ============================
        const modal1 = new ModalBuilder()
            .setCustomId('sorteio_modal1')
            .setTitle('Configurar Sorteio (1/2)');

        modal1.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('titulo')
                    .setLabel('Título')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(100)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('descricao')
                    .setLabel('Descrição')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false)
                    .setMaxLength(1000)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('nomeBotao')
                    .setLabel('Nome do botão de participar')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(80)
                    .setValue('Participar')
            )
        );

        await interaction.showModal(modal1);
    },

    // ============================
    // HANDLER DE MODAL E BOTÕES
    // ============================
    async handleInteraction(interaction, client) {
        // --- MODAL 1 SUBMIT ---
        if (interaction.isModalSubmit() && interaction.customId === 'sorteio_modal1') {
            const titulo = interaction.fields.getTextInputValue('titulo');
            const descricao = interaction.fields.getTextInputValue('descricao');
            const nomeBotao = interaction.fields.getTextInputValue('nomeBotao');

            // Salva temporariamente pra usar no modal 2
            const tempId = `temp_${interaction.user.id}_${Date.now()}`;
            const sorteioTemp = { titulo, descricao, nomeBotao };
            config.set(tempId, sorteioTemp);

            // Abre o modal 2
            const modal2 = new ModalBuilder()
                .setCustomId(`sorteio_modal2_${tempId}`)
                .setTitle('Configurar Sorteio (2/2)');

            modal2.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('ganhadores')
                        .setLabel('Quantidade de ganhadores')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setValue('1')
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('tempo')
                        .setLabel('Tempo (ex: 1d 2h 30m)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setPlaceholder('1d 2h 30m ou 30m ou 12h')
                )
            );

            return interaction.showModal(modal2);
        }

        // --- MODAL 2 SUBMIT ---
        if (interaction.isModalSubmit() && interaction.customId.startsWith('sorteio_modal2_')) {
            const tempId = interaction.customId.replace('sorteio_modal2_', '');
            const sorteioTemp = config.get(tempId);
            config.delete(tempId);

            if (!sorteioTemp) {
                return interaction.reply({
                    content: '❌ Sessão expirou. Recomece com `/sorteio`.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const ganhadores = parseInt(interaction.fields.getTextInputValue('ganhadores'));
            const tempoStr = interaction.fields.getTextInputValue('tempo');

            if (isNaN(ganhadores) || ganhadores < 1 || ganhadores > 100) {
                return interaction.reply({
                    content: '❌ Quantidade de ganhadores inválida (1-100).',
                    flags: MessageFlags.Ephemeral
                });
            }

            const duracaoMs = parseTempo(tempoStr);
            if (duracaoMs <= 0) {
                return interaction.reply({
                    content: '❌ Tempo inválido. Use formato tipo `1d 2h 30m`.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Cria o sorteio
            const sorteioId = `sorteio_${Date.now()}`;
            const sorteio = {
                id: sorteioId,
                titulo: sorteioTemp.titulo,
                descricao: sorteioTemp.descricao,
                nomeBotao: sorteioTemp.nomeBotao,
                ganhadores: ganhadores,
                canalId: interaction.channel.id,
                guildId: interaction.guild.id,
                hostId: interaction.user.id,
                messageId: null,
                participantes: [],
                endsAt: Date.now() + duracaoMs,
                finalizado: false
            };

            // Envia a mensagem do sorteio
            const container = criarContainerSorteio(sorteio, 0);
            const msg = await interaction.channel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

            sorteio.messageId = msg.id;

            // Salva no banco
            const sorteios = config.get('sorteios') || {};
            sorteios[sorteioId] = sorteio;
            config.set('sorteios', sorteios);

            // Agenda o término
            client.sorteioTimers = client.sorteioTimers || {};
            client.sorteioTimers[sorteioId] = setTimeout(
                () => finalizarSorteio(client, sorteioId),
                duracaoMs
            );

            return interaction.reply({
                content: `✅ Sorteio criado! Termina em ${formatarTempo(duracaoMs)}.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // --- BOTÃO PARTICIPAR ---
        if (interaction.isButton() && interaction.customId.startsWith('sorteio_participar_')) {
            const sorteioId = interaction.customId.replace('sorteio_participar_', '');
            const sorteios = config.get('sorteios') || {};
            const sorteio = sorteios[sorteioId];

            if (!sorteio) {
                return interaction.reply({
                    content: '❌ Esse sorteio não existe mais.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (sorteio.finalizado || Date.now() >= sorteio.endsAt) {
                return interaction.reply({
                    content: '❌ Esse sorteio já foi encerrado.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // 🔒 Checa se o usuário tá verificado
            const userData = users.get(interaction.user.id);

            if (!userData) {
                // Não tá verificado → manda efêmera com botão de verificar
                const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&response_type=code&scope=identify%20guilds.join`;

                const containerNaoVerificado = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent('## ❌ Você precisa se verificar')
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            'Pra participar do sorteio, você precisa passar pela **verificação** primeiro. É rapidinho!'
                        )
                    )
                    .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                    )
                    .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setLabel('🔗 Verificar agora')
                                .setStyle(ButtonStyle.Link)
                                .setURL(oauthUrl)
                        )
                    );

                return interaction.reply({
                    components: [containerNaoVerificado],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                });
            }

            // Já tá participando?
            if (sorteio.participantes.includes(interaction.user.id)) {
                return interaction.reply({
                    content: 'ℹ️ Você já tá participando desse sorteio!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Adiciona na lista
            sorteio.participantes.push(interaction.user.id);
            sorteios[sorteioId] = sorteio;
            config.set('sorteios', sorteios);

            // Atualiza a mensagem
            try {
                const canal = await client.channels.fetch(sorteio.canalId);
                const msg = await canal.messages.fetch(sorteio.messageId);
                const containerAtualizado = criarContainerSorteio(sorteio, sorteio.participantes.length);
                await msg.edit({
                    components: [containerAtualizado],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch (err) {
                console.error('Erro ao atualizar sorteio:', err.message);
            }

            return interaction.reply({
                content: '✅ Você entrou no sorteio! Boa sorte! 🍀',
                flags: MessageFlags.Ephemeral
            });
        }

        // --- BOTÃO VERIFY ---
        if (interaction.isButton() && interaction.customId.startsWith('sorteio_verify_')) {
            const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&response_type=code&scope=identify%20guilds.join`;

            // Já tá verificado?
            const userData = users.get(interaction.user.id);
            if (userData) {
                return interaction.reply({
                    content: '✅ Você já tá verificado! Pode participar do sorteio.',
                    flags: MessageFlags.Ephemeral
                });
            }

            return interaction.reply({
                content: `🔗 **Clique no link abaixo pra se verificar:**\n${oauthUrl}`,
                flags: MessageFlags.Ephemeral
            });
        }
    }
};

// ============================
// FINALIZA SORTEIO
// ============================
async function finalizarSorteio(client, sorteioId) {
    try {
        const sorteios = config.get('sorteios') || {};
        const sorteio = sorteios[sorteioId];

        if (!sorteio || sorteio.finalizado) return;

        sorteio.finalizado = true;
        sorteios[sorteioId] = sorteio;
        config.set('sorteios', sorteios);

        const canal = await client.channels.fetch(sorteio.canalId);
        const msg = await canal.messages.fetch(sorteio.messageId);

        if (sorteio.participantes.length === 0) {
            // Ninguém participou
            const containerVazio = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`# 🎉 ${sorteio.titulo}`)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('❌ **Sorteio encerrado — ninguém participou.**')
                );

            await msg.edit({
                components: [containerVazio],
                flags: MessageFlags.IsComponentsV2
            });

            return canal.send('❌ O sorteio terminou e ninguém participou!');
        }

        // Sorteia ganhadores
        const ganhadoresQtd = Math.min(sorteio.ganhadores, sorteio.participantes.length);
        const embaralhado = [...sorteio.participantes].sort(() => Math.random() - 0.5);
        const vencedores = embaralhado.slice(0, ganhadoresQtd);

        // Edita a mensagem original
        const containerFinal = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`# 🎉 ${sorteio.titulo}`)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(sorteio.descricao || '_Sem descrição_')
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `🏆 **Ganhadores:**\n${vencedores.map(id => `<@${id}>`).join('\n')}`
                )
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `👥 **Total de participantes:** ${sorteio.participantes.length}`
                )
            );

        await msg.edit({
            components: [containerFinal],
            flags: MessageFlags.IsComponentsV2
        });

        // Marca no canal
        await canal.send({
            content: `🎉 **Parabéns aos ganhadores do sorteio \`${sorteio.titulo}\`!**\n${vencedores.map(id => `<@${id}>`).join(' ')}`
        });

        // Manda DM pros ganhadores
        for (const id of vencedores) {
            try {
                const user = await client.users.fetch(id);
                await user.send(`🎉 **Você ganhou o sorteio \`${sorteio.titulo}\`!**\nParabéns!`);
            } catch (err) {
                console.error(`Erro ao mandar DM pra ${id}:`, err.message);
            }
        }
    } catch (err) {
        console.error('Erro ao finalizar sorteio:', err.message);
    }
}

// Exporta a função pra ser usada no on_ready (reagendar timers)
module.exports.finalizarSorteio = finalizarSorteio;
