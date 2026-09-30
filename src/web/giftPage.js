function renderGiftPage(gift, baseUrl) {
    const status = gift.status;
    const expirado = Date.now() > gift.expiresAt;
    const dataExpira = new Date(gift.expiresAt).toLocaleString('pt-BR');

    let conteudoPrincipal = '';

    if (status === 'esgotado') {
        conteudoPrincipal = `
            <div class="status-icon">✓</div>
            <h1>Gift já utilizado</h1>
            <p>Este gift já foi resgatado e não está mais disponível.</p>
        `;
    } else if (expirado) {
        conteudoPrincipal = `
            <div class="status-icon">×</div>
            <h1>Gift expirado</h1>
            <p>Este gift expirou em ${dataExpira}.</p>
        `;
    } else {
        conteudoPrincipal = `
            <div class="status-icon">◆</div>
            <h1>Gift de Membros</h1>
            <p>Você tem direito a puxar <strong>${gift.quantidade} membros</strong> para um servidor.</p>

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
                    <span class="info-value status-active">Ativo</span>
                </div>
            </div>

            <div class="step">
                <div class="step-number">1</div>
                <div class="step-content">
                    <h3>Adicione o bot no servidor</h3>
                    <p>Clique no botão abaixo para convidar o bot com as permissões necessárias.</p>
                    <a href="${baseUrl}/invite" target="_blank" class="btn btn-primary">
                        Adicionar Bot
                    </a>
                </div>
            </div>

            <div class="step">
                <div class="step-number">2</div>
                <div class="step-content">
                    <h3>Informe o ID do servidor</h3>
                    <p>Ative o modo desenvolvedor no Discord e copie o ID do servidor de destino.</p>
                    <input type="text" id="guildId" placeholder="000000000000000000" maxlength="20" />
                </div>
            </div>

            <div class="step">
                <div class="step-number">3</div>
                <div class="step-content">
                    <h3>Iniciar puxada</h3>
                    <p>O bot vai puxar ${gift.quantidade} membros para o servidor informado.</p>
                    <button id="btnIniciar" class="btn btn-success" onclick="iniciarGift()">
                        Iniciar
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
    <title>Gift de Membros</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #0b0b0d;
            color: #e6e6e8;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            padding: 0;
            -webkit-font-smoothing: antialiased;
        }

        /* Header */
        .header {
            padding: 20px 32px;
            border-bottom: 1px solid #1c1c1f;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #0b0b0d;
        }

        .logo {
            font-size: 16px;
            font-weight: 600;
            color: #e6e6e8;
            letter-spacing: -0.2px;
        }

        .credits {
            font-size: 13px;
            color: #6b6b70;
        }

        .credits span {
            color: #a0a0a5;
            font-weight: 500;
        }

        /* Main */
        .main {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 60px 20px;
        }

        .container {
            background: #131316;
            border: 1px solid #1c1c1f;
            border-radius: 12px;
            padding: 40px;
            max-width: 520px;
            width: 100%;
        }

        .status-icon {
            font-size: 28px;
            color: #5865F2;
            text-align: center;
            margin-bottom: 20px;
            font-weight: 300;
            line-height: 1;
        }

        h1 {
            font-size: 22px;
            text-align: center;
            margin-bottom: 8px;
            color: #ffffff;
            font-weight: 600;
            letter-spacing: -0.3px;
        }

        .container > p {
            text-align: center;
            color: #8a8a90;
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 28px;
        }

        .info-box {
            background: #0b0b0d;
            border: 1px solid #1c1c1f;
            border-radius: 8px;
            padding: 4px 16px;
            margin-bottom: 32px;
        }

        .info-item {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #1c1c1f;
        }

        .info-item:last-child {
            border-bottom: none;
        }

        .info-label {
            color: #6b6b70;
            font-size: 13px;
        }

        .info-value {
            color: #e6e6e8;
            font-size: 13px;
            font-weight: 500;
        }

        .status-active {
            color: #3ba55d;
        }

        .step {
            display: flex;
            gap: 14px;
            margin-bottom: 24px;
            align-items: flex-start;
        }

        .step-number {
            width: 24px;
            height: 24px;
            border-radius: 6px;
            background: #1c1c1f;
            color: #8a8a90;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            flex-shrink: 0;
            margin-top: 2px;
        }

        .step-content {
            flex: 1;
        }

        .step-content h3 {
            font-size: 14px;
            font-weight: 600;
            color: #e6e6e8;
            margin-bottom: 4px;
        }

        .step-content p {
            font-size: 13px;
            color: #6b6b70;
            line-height: 1.5;
            margin-bottom: 10px;
        }

        /* Botões */
        .btn {
            display: inline-block;
            padding: 9px 16px;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            text-decoration: none;
            font-family: inherit;
            transition: background 0.15s;
        }

        .btn-primary {
            background: #5865F2;
            color: #ffffff;
        }

        .btn-primary:hover {
            background: #4752c4;
        }

        .btn-success {
            background: #3ba55d;
            color: #ffffff;
        }

        .btn-success:hover {
            background: #2d8049;
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        /* Input */
        input[type="text"] {
            width: 100%;
            padding: 10px 12px;
            background: #0b0b0d;
            border: 1px solid #1c1c1f;
            border-radius: 6px;
            color: #e6e6e8;
            font-size: 13px;
            font-family: inherit;
            outline: none;
            transition: border-color 0.15s;
        }

        input[type="text"]:focus {
            border-color: #5865F2;
        }

        input[type="text"]::placeholder {
            color: #4a4a4f;
        }

        /* Status box */
        .status-box {
            background: #0b0b0d;
            border: 1px solid #1c1c1f;
            border-radius: 8px;
            padding: 14px 16px;
            margin-top: 20px;
            font-size: 13px;
            line-height: 1.5;
        }

        .status-box.success {
            border-color: #3ba55d;
            color: #3ba55d;
        }

        .status-box.error {
            border-color: #ed4245;
            color: #ed4245;
        }

        .status-box.info {
            color: #8a8a90;
        }

        /* Footer */
        .footer {
            padding: 20px 32px;
            border-top: 1px solid #1c1c1f;
            text-align: center;
            font-size: 12px;
            color: #4a4a4f;
        }

        @media (max-width: 600px) {
            .header {
                padding: 16px 20px;
            }

            .main {
                padding: 32px 16px;
            }

            .container {
                padding: 28px 24px;
                border-radius: 10px;
            }

            h1 {
                font-size: 20px;
            }

            .footer {
                padding: 16px 20px;
            }
        }
    </style>
</head>
<body>
    <header class="header">
        <div class="logo">Gift de Membros</div>
        <div class="credits">Por <span>Kauã / Polar</span></div>
    </header>

    <main class="main">
        <div class="container">
            ${conteudoPrincipal}
        </div>
    </main>

    <footer class="footer">
        Sistema de gifts
    </footer>

    <script>
        const codigoGift = '${gift.codigo}';

        async function iniciarGift() {
            const guildId = document.getElementById('guildId').value.trim();
            const btn = document.getElementById('btnIniciar');
            const statusBox = document.getElementById('statusBox');

            if (!guildId) {
                statusBox.style.display = 'block';
                statusBox.className = 'status-box error';
                statusBox.textContent = 'Informe o ID do servidor.';
                return;
            }

            if (!/^\\d{17,20}$/.test(guildId)) {
                statusBox.style.display = 'block';
                statusBox.className = 'status-box error';
                statusBox.textContent = 'ID inválido. O ID tem entre 17 e 20 dígitos.';
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Iniciando...';
            statusBox.style.display = 'block';
            statusBox.className = 'status-box info';
            statusBox.textContent = 'Verificando servidor...';

            try {
                const resp = await fetch('/api/gift/' + codigoGift, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ guildId })
                });

                const data = await resp.json();

                if (!resp.ok) {
                    statusBox.className = 'status-box error';
                    statusBox.textContent = data.error || 'Erro desconhecido.';
                    btn.disabled = false;
                    btn.textContent = 'Iniciar';
                    return;
                }

                statusBox.className = 'status-box success';
                statusBox.textContent = data.mensagem;
                btn.textContent = 'Concluído';

            } catch (err) {
                statusBox.className = 'status-box error';
                statusBox.textContent = 'Erro de conexão. Tente novamente.';
                btn.disabled = false;
                btn.textContent = 'Iniciar';
            }
        }
    </script>
</body>
</html>`;
}

module.exports = { renderGiftPage };