function renderGiftPage(gift, baseUrl) {
    const status = gift.status;
    const expirado = Date.now() > gift.expiresAt;
    const dataExpira = new Date(gift.expiresAt).toLocaleString('pt-BR');

    let conteudoPrincipal = '';

    if (status === 'esgotado') {
        conteudoPrincipal = `
            <div class="status-icon">✅</div>
            <h1>Gift Esgotado</h1>
            <p>Esse gift já foi usado. Não é possível usá-lo novamente.</p>
        `;
    } else if (expirado) {
        conteudoPrincipal = `
            <div class="status-icon">⏰</div>
            <h1>Gift Expirado</h1>
            <p>Esse gift expirou em ${dataExpira}.</p>
        `;
    } else {
        conteudoPrincipal = `
            <div class="status-icon">🎁</div>
            <h1>Gift de Membros</h1>
            <p>Esse gift dá direito a puxar <strong>${gift.quantidade} membros</strong> para o seu servidor.</p>

            <div class="info-box">
                <div class="info-item">
                    <span class="info-label">Quantidade</span>
                    <span class="info-value">${gift.quantidade} membros</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Expira em</span>
                    <span class="info-value">${dataExpira}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Status</span>
                    <span class="info-value success">● Ativo</span>
                </div>
            </div>

            <div class="step">
                <div class="step-number">1</div>
                <div class="step-content">
                    <h3>Adicione o bot no servidor</h3>
                    <p>Clique no botão abaixo pra adicionar o bot com as permissões necessárias.</p>
                    <a href="${baseUrl}/invite" target="_blank" class="btn btn-primary">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                        </svg>
                        Adicionar Bot
                    </a>
                </div>
            </div>

            <div class="step">
                <div class="step-number">2</div>
                <div class="step-content">
                    <h3>Cole o ID do servidor</h3>
                    <p>Ative o modo desenvolvedor no Discord, clique com botão direito no servidor → Copiar ID.</p>
                    <input type="text" id="guildId" placeholder="Ex: 1234567890123456789" maxlength="20" />
                </div>
            </div>

            <div class="step">
                <div class="step-number">3</div>
                <div class="step-content">
                    <h3>Inicie a puxada</h3>
                    <p>Clique no botão abaixo. O bot vai puxar ${gift.quantidade} membros pro seu servidor.</p>
                    <button id="btnIniciar" class="btn btn-success" onclick="iniciarGift()">
                        🚀 Iniciar
                    </button>
                </div>
            </div>

            <div id="statusBox" class="status-box" style="display: none;"></div>
        `;
    }

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fuzion Gifts</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0a0a0f;
            color: #f5f5f5;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 80px 20px 20px;
            overflow-x: hidden;
            position: relative;
        }

        body::before {
            content: '';
            position: fixed;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle at 20% 30%, rgba(88, 101, 242, 0.15) 0%, transparent 50%),
                        radial-gradient(circle at 80% 70%, rgba(87, 242, 135, 0.1) 0%, transparent 50%),
                        radial-gradient(circle at 50% 50%, rgba(235, 69, 158, 0.08) 0%, transparent 50%);
            animation: rotate 30s linear infinite;
            z-index: 0;
            pointer-events: none;
        }

        @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        .particles {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            pointer-events: none;
            z-index: 1;
            overflow: hidden;
        }

        .particle {
            position: absolute;
            background: rgba(255, 255, 255, 0.6);
            border-radius: 50%;
            animation: floatUp linear infinite;
        }

        @keyframes floatUp {
            0% {
                transform: translateY(100vh) scale(0);
                opacity: 0;
            }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% {
                transform: translateY(-100px) scale(1);
                opacity: 0;
            }
        }

        .header {
            position: fixed;
            top: 0; left: 0; right: 0;
            padding: 20px 32px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 10;
            background: linear-gradient(180deg, rgba(10, 10, 15, 0.95), transparent);
            backdrop-filter: blur(10px);
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 22px;
            font-weight: 800;
            background: linear-gradient(135deg, #5865F2 0%, #EB459E 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            letter-spacing: -0.5px;
            animation: glow 3s ease-in-out infinite alternate;
        }

        @keyframes glow {
            from { filter: drop-shadow(0 0 8px rgba(88, 101, 242, 0.4)); }
            to { filter: drop-shadow(0 0 16px rgba(235, 69, 158, 0.6)); }
        }

        .logo-icon {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            background: linear-gradient(135deg, #5865F2, #EB459E);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            box-shadow: 0 4px 20px rgba(88, 101, 242, 0.4);
        }

        .credits {
            font-size: 13px;
            color: #80848e;
            font-weight: 500;
        }

        .credits strong {
            background: linear-gradient(135deg, #5865F2, #EB459E);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-weight: 700;
        }

        .container {
            background: rgba(26, 26, 34, 0.85);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            padding: 48px 40px;
            max-width: 560px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(88, 101, 242, 0.2);
            position: relative;
            z-index: 5;
            animation: fadeInUp 0.6s ease-out;
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .status-icon {
            font-size: 72px;
            text-align: center;
            margin-bottom: 20px;
            animation: bounce 2s ease-in-out infinite;
        }

        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }

        h1 {
            font-size: 32px;
            text-align: center;
            margin-bottom: 12px;
            background: linear-gradient(135deg, #fff 0%, #b5bac1 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-weight: 800;
        }

        .container > p {
            text-align: center;
            color: #b5bac1;
            line-height: 1.6;
            margin-bottom: 32px;
        }

        .info-box {
            background: rgba(10, 10, 15, 0.6);
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 32px;
            border: 1px solid rgba(88, 101, 242, 0.15);
        }

        .info-item {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .info-item:last-child { border-bottom: none; }
        .info-label { color: #80848e; font-size: 14px; }
        .info-value { color: #f5f5f5; font-weight: 600; font-size: 14px; }
        .info-value.success { color: #57F287; }

        .step {
            display: flex;
            gap: 16px;
            margin-bottom: 28px;
            align-items: flex-start;
            animation: fadeInUp 0.6s ease-out backwards;
        }

        .step:nth-child(3) { animation-delay: 0.1s; }
        .step:nth-child(4) { animation-delay: 0.2s; }
        .step:nth-child(5) { animation-delay: 0.3s; }

        .step-number {
            background: linear-gradient(135deg, #5865F2, #4752C4);
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            flex-shrink: 0;
            box-shadow: 0 4px 12px rgba(88, 101, 242, 0.4);
        }

        .step-content { flex: 1; }
        .step-content h3 {
            font-size: 16px;
            margin-bottom: 6px;
            color: #fff;
        }
        .step-content p {
            color: #b5bac1;
            font-size: 14px;
            line-height: 1.5;
            margin-bottom: 12px;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 12px 24px;
            border-radius: 12px;
            border: none;
            cursor: pointer;
            font-size: 15px;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.3s;
            font-family: inherit;
        }

        .btn-primary {
            background: linear-gradient(135deg, #5865F2, #4752C4);
            color: white;
            box-shadow: 0 4px 20px rgba(88, 101, 242, 0.4);
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 30px rgba(88, 101, 242, 0.6);
        }

        .btn-success {
            background: linear-gradient(135deg, #57F287, #3BA55D);
            color: #0a0a0f;
            box-shadow: 0 4px 20px rgba(87, 242, 135, 0.4);
        }

        .btn-success:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 30px rgba(87, 242, 135, 0.6);
        }

        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }

        input[type="text"] {
            width: 100%;
            padding: 14px 18px;
            background: rgba(10, 10, 15, 0.8);
            border: 1px solid rgba(88, 101, 242, 0.2);
            border-radius: 12px;
            color: #f5f5f5;
            font-size: 15px;
            outline: none;
            transition: all 0.3s;
            font-family: inherit;
        }

        input[type="text"]:focus {
            border-color: #5865F2;
            box-shadow: 0 0 0 4px rgba(88, 101, 242, 0.15);
        }

        input[type="text"]::placeholder { color: #555; }

        .status-box {
            background: rgba(10, 10, 15, 0.8);
            border-radius: 12px;
            padding: 20px;
            margin-top: 24px;
            border: 1px solid rgba(88, 101, 242, 0.2);
            font-size: 14px;
            line-height: 1.6;
            animation: fadeInUp 0.4s ease-out;
        }

        .status-box.success {
            border-color: #57F287;
            color: #57F287;
            background: rgba(87, 242, 135, 0.05);
        }

        .status-box.error {
            border-color: #ED4245;
            color: #ED4245;
            background: rgba(237, 66, 69, 0.05);
        }

        .status-box.info {
            border-color: #5865F2;
            color: #b5bac1;
        }

        @media (max-width: 600px) {
            .header { padding: 16px 20px; }
            .logo { font-size: 18px; }
            .credits { font-size: 11px; }
            .container { padding: 32px 24px; margin-top: 60px; }
            h1 { font-size: 24px; }
            .status-icon { font-size: 56px; }
        }
    </style>
</head>
<body>
    <div class="particles" id="particles"></div>

    <header class="header">
        <div class="logo">
            <div class="logo-icon">🎁</div>
            <span>Fuzion Gifts</span>
        </div>
        <div class="credits">Criado por <strong>Kauã/Polar</strong></div>
    </header>

    <div class="container">
        ${conteudoPrincipal}
    </div>

    <script>
        const particlesContainer = document.getElementById('particles');
        for (let i = 0; i < 30; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            const size = Math.random() * 4 + 1;
            p.style.width = size + 'px';
            p.style.height = size + 'px';
            p.style.left = Math.random() * 100 + '%';
            p.style.animationDuration = (Math.random() * 10 + 10) + 's';
            p.style.animationDelay = (Math.random() * 10) + 's';
            p.style.opacity = Math.random() * 0.5 + 0.2;
            particlesContainer.appendChild(p);
        }

        const codigoGift = '${gift.codigo}';

        async function iniciarGift() {
            const guildId = document.getElementById('guildId').value.trim();
            const btn = document.getElementById('btnIniciar');
            const statusBox = document.getElementById('statusBox');

            if (!guildId) {
                statusBox.style.display = 'block';
                statusBox.className = 'status-box error';
                statusBox.innerHTML = '❌ Cole o ID do servidor primeiro.';
                return;
            }

            if (!/^\\d{17,20}$/.test(guildId)) {
                statusBox.style.display = 'block';
                statusBox.className = 'status-box error';
                statusBox.innerHTML = '❌ ID inválido. O ID tem entre 17 e 20 dígitos.';
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '⏳ Iniciando...';
            statusBox.style.display = 'block';
            statusBox.className = 'status-box info';
            statusBox.innerHTML = '⏳ Verificando servidor...';

            try {
                const resp = await fetch('/api/gift/' + codigoGift, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ guildId })
                });

                const data = await resp.json();

                if (!resp.ok) {
                    statusBox.className = 'status-box error';
                    statusBox.innerHTML = '❌ ' + (data.error || 'Erro desconhecido');
                    btn.disabled = false;
                    btn.innerHTML = '🚀 Iniciar';
                    return;
                }

                statusBox.className = 'status-box success';
                statusBox.innerHTML = '✅ <strong>Iniciado!</strong><br>' + data.mensagem;
                btn.innerHTML = '✅ Concluído';

            } catch (err) {
                statusBox.className = 'status-box error';
                statusBox.innerHTML = '❌ Erro de conexão.';
                btn.disabled = false;
                btn.innerHTML = '🚀 Iniciar';
            }
        }
    </script>
</body>
</html>`;
}

module.exports = { renderGiftPage };