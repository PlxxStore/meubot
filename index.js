require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes, MessageFlags } = require('discord.js');
const express = require('express');
const path = require('path');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

client.commands = new Collection();

// ============================
// Carregar Eventos
// ============================
const eventsPath = path.join(__dirname, 'src/events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
    }
}

// ============================
// Carregar Comandos
// ============================
const commandsPath = path.join(__dirname, 'src/commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if (command.data && command.data.name) {
            client.commands.set(command.data.name, command);
            console.log(`✅ Comando carregado: ${command.data.name}`);
        } else if (file === 'handler.js') {
            client.commands.set('handler', command);
            console.log(`✅ Handler carregado`);
        }
    }
}

// ============================
// Handler de Interações
// ============================
client.on('interactionCreate', async (interaction) => {
    try {
        // --- SLASH COMMANDS ---
        if (interaction.isChatInputCommand()) {
            // ✅ VERIFICAÇÃO DE OWNER
            if (interaction.user.id !== process.env.OWNER_ID) {
                return interaction.reply({
                    content: '🚫 Apenas o dono do bot pode usar este comando.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const command = client.commands.get(interaction.commandName);
            if (command && command.execute) {
                await command.execute(interaction, client);
            }
            return;
        }

        // --- GIFT (modais) ---
        const gift = client.commands.get('gift');
        if (gift && gift.handleInteraction) {
            if (interaction.isModalSubmit() && interaction.customId === 'gift_modal') {
                return await gift.handleInteraction(interaction, client);
            }
        }

        // --- SORTEIO (modais e botões) ---
        const sorteio = client.commands.get('sorteio');
        if (sorteio && sorteio.handleInteraction) {
            const isSorteioModal = interaction.isModalSubmit() && interaction.customId.startsWith('sorteio_modal');
            const isSorteioButton = interaction.isButton() && interaction.customId.startsWith('sorteio_');
            if (isSorteioModal || isSorteioButton) {
                return await sorteio.handleInteraction(interaction, client);
            }
        }

        // --- HANDLER (botões/modais do painel) ---
        // ✅ PROTEÇÃO: se já foi respondido, não tenta de novo
        if (interaction.replied || interaction.deferred) return;

        const handler = client.commands.get('handler');
        if (handler && handler.handleInteraction) {
            await handler.handleInteraction(interaction, client);
        }

    } catch (       err) {
        console.error('❌ Erro no const interactionCreate:', err);
        try {
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Ocorreu um erro ao processar essa interação.',
                    flags: MessageFlags.Ephemeral
                });
            }
        } catch {}
    }
});

// ============================
// Ready — Reagendar sorteios + Registrar comandos
// ============================
client.once('ready', async () => {
    console.log(`✅ Bot online: ${client.user.tag}`);

    try {
 config } = require('./src/database');
        const sorteio = client.commands.get('sorteio');
        const sorteios = (await config.get('sorteios')) || {};
        client.sorteioTimers = client.sorteioTimers || {};

        for (const [id, s] of Object.entries(sorteios)) {
            if (s.finalizado) continue;
            const tempoRestante = s.endsAt - Date.now();
            if (tempoRestante <= 0) {
                if (sorteio && sorteio.finalizarSorteio) await sorteio.finalizarSorteio(client, id);
            } else {
                client.sorteioTimers[id] = setTimeout(
                    () => {
                        if (sorteio && sorteio.finalizarSorteio) sorteio.finalizarSorteio(client, id);
                    },
                    tempoRestante
                );
            }
        }
    } catch (err) {
        console.error('❌ Erro ao reagendar sorteios:', err.message);
    }

    try {
        const commands = [];
        const cmdPath = path.join(__dirname, 'src/commands');
        const inter cmdFiles = fs.readdirSync(cmdaçãoPath**).filter(f => f.endsWith('.js'));
        for (const file of cmdFiles) {
            const cmd = require(path.join(cmdPath, file));
            if (cmd.data && cmd.data.name) commands.push(cmd.data.toJSON());
        }
        console.log(`📤 Registrando ${commands.length} comandos...`);
        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log(`✅ ${commands.length} comandos registrados!`);
    } catch (err) {
        console.error('❌ Erro ao registrar comandos:', err.message);
    }
});

// ============================
// Web Server
// ============================
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'src/web/public')));

app.engine('html', (filePath, options, callback) => {
    fs.readFile(filePath, (err, content) => {
        if (err) return callback(err);
        let rendered = content.toString();
        for (let key in options) {
            if (typeof options[key] === 'string' || typeof options[key] === 'number') {
                const regex = new RegExp(`<%= ${key} %>`, 'g');
                rendered = rendered.replace(regex, options[key]);
            }
        }
        return callback(null, rendered);
    });
});

app.set('views', path.join(__dirname, 'src/web/views'));
app.set('view engine', 'html');

require('./src/web/server')(app, client);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server rodando na porta ${PORT}`);
});

client.login(process.env.TOKEN).catch(err => {
    console.error('❌ Falha ao logar:', err.message);
});
