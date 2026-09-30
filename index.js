require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
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
        const handler = client.commands.get('handler');
        if (handler && handler.handleInteraction) {
            await handler.handleInteraction(interaction, client);
        }

    } catch (err) {
        console.error('❌ Erro no interactionCreate:', err);
        try {
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Ocorreu um erro ao processar essa interação.',
                    flags: 64
                });
            }
        } catch {}
    }
});

// ============================
// Ready — Reagendar sorteios
// ============================
client.once('ready', async () => {
    try {
        const { config } = require('./src/database');
        const sorteio = client.commands.get('sorteio');
        const sorteios = (await config.get('sorteios')) || {};
        client.sorteioTimers = client.sorteioTimers || {};

        for (const [id, s] of Object.entries(sorteios)) {
            if (s.finalizado) continue;

            const tempoRestante = s.endsAt - Date.now();

            if (tempoRestante <= 0) {
                console.log(`⏰ Sorteio ${id} já expirou, finalizando...`);
                if (sorteio && sorteio.finalizarSorteio) {
                    await sorteio.finalizarSorteio(client, id);
                }
            } else {
                console.log(`⏰ Reagendando sorteio ${id} (${Math.round(tempoRestante / 1000)}s)`);
                client.sorteioTimers[id] = setTimeout(
                    () => {
                        if (sorteio && sorteio.finalizarSorteio) {
                            sorteio.finalizarSorteio(client, id);
                        }
                    },
                    tempoRestante
                );
            }
        }
    } catch (err) {
        console.error('❌ Erro ao reagendar sorteios:', err.message);
    }
});

// ============================
// Web Server
// ============================
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'src/web/public')));

// Engine HTML customizada
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

// Rotas web
require('./src/web/server')(app, client);

// ============================
// Inicialização
// ============================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server rodando na porta ${PORT}`);
});

client.login(process.env.TOKEN).catch(err => {
    console.error('❌ Falha ao logar:', err.message);
});