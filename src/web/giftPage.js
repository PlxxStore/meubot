function renderGiftPage(gift, baseUrl) {
    const status = gift.status;
    const expirado = gift.expiresAt ? Date.now() > gift.expiresAt : false;
    const dataExpira = gift.expiresAt ? new Date(gift.expiresAt).toLocaleString('pt-BR') : 'Nunca';

    // Link OAuth2 pra verificar
    const clientId = process.env.CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.REDIRECT_URI);
    const scopes = encodeURIComponent('identify email guilds.join');
    const oauthUrl = 'https://discord.com/api/oauth2/authorize?client_id=' + clientId + '&redirect_uri=' + redirectUri + '&response_type=code&scope=' + scopes;

    let conteudo = '';

    if (status === 'esgotado') {
        conteudo = '<div class="top">';
        conteudo += '<div><h1>Gift utilizado</h1><p class="muted">Este gift já foi resgatado.</p></div>';
        conteudo += '<div class="top-actions">';
        conteudo += '<a class="btn-verificar" href="' + oauthUrl + '" target="_blank">Verificar</a>';
        conteudo += '<span class="pill">Usado</span>';
        conteudo += '</div>';
        conteudo += '</div>';
    } else if (expirado) {
        conteudo = '<div class="top">';
        conteudo += '<div><h1>Gift expirado</h1><p class="muted">Expirou em ' + dataExpira + '.</p></div>';
        conteudo += '<div class="top-actions">';
        conteudo += '<a class="btn-verificar" href="' + oauthUrl + '" target="_blank">Verificar</a>';
        conteudo += '<span class="pill pill-red">Expirado</span>';
        conteudo += '</div>';
        conteudo += '</div>';
    } else {
        conteudo += '<div class="top">';
        conteudo += '<div><h1>Gift de membros</h1><p class="muted">' + gift.quantidade + ' membros disponíveis</p></div>';
        conteudo += '<div class="top-actions">';
        conteudo += '<a class="btn-verificar" href="' + oauthUrl + '" target="_blank">Verificar</a>';
        conteudo += '<span class="pill">Ativo</span>';
        conteudo += '</div>';
        conteudo += '</div>';

        conteudo += '<div class="rows">';
        conteudo += '<div class="row"><span>Quantidade</span><span>' + gift.quantidade + ' membros</span></div>';
        conteudo += '<div class="row"><span>Expira</span><span>' + dataExpira + '</span></div>';
        conteudo += '<div class="row"><span>Só verificado</span><span>' + (gift.soVerificado ? 'Sim' : 'Não') + '</span></div>';
        conteudo += '</div>';

        conteudo += '<div class="steps">';
        conteudo += '<div class="step"><span class="num">01</span><div><h3>Adicione o bot</h3><p class="muted">O bot precisa estar no servidor de destino.</p><a class="link" href="' + baseUrl + '/invite" target="_blank">Adicionar bot →</a></div></div>';
        conteudo += '<div class="step"><span class="num">02</span><div><h3>Informe o ID do servidor</h3><p class="muted">Ative o modo desenvolvedor no Discord e copie o ID.</p><input type="text" id="guildId" placeholder="000000000000000000" maxlength="20"></div></div>';
        conteudo += '<div class="step"><span class="num">03</span><div><h3>Iniciar</h3><p class="muted">O bot vai puxar ' + gift.quantidade + ' membros pro servidor informado.</p><button id="btnIniciar" onclick="iniciarGift()">Iniciar puxada</button></div></div>';
        conteudo += '</div>';

        conteudo += '<div id="statusBox" class="msg" style="display:none"></div>';

        conteudo += '<div id="prog" class="prog" style="display:none">';
        conteudo += '<div class="prog-head"><div><div class="prog-title">Puxando membros</div><div class="prog-sub" id="progGuild">Servidor —</div></div><span class="pill pill-live" id="progBadge">Em andamento</span></div>';
        conteudo += '<div class="prog-bar-wrap"><div class="prog-bar" id="progBar"></div></div>';
        conteudo += '<div class="prog-info"><span id="progPercent">0%</span><span id="progCount">0 / 0</span></div>';
        conteudo += '<div class="stats">';
        conteudo += '<div class="stat"><span>Puxados</span><b id="statPuxados">0</b></div>';
        conteudo += '<div class="stat"><span>Total</span><b id="statTotal">0</b></div>';
        conteudo += '<div class="stat"><span>Velocidade</span><b id="statVel">0.00/s</b></div>';
        conteudo += '<div class="stat"><span>Restante</span><b id="statRest">—</b></div>';
        conteudo += '</div>';
        conteudo += '</div>';

        conteudo += '<div id="log" class="log" style="display:none">';
        conteudo += '<div class="log-head">Log em tempo real</div>';
        conteudo += '<div class="log-body" id="logBody"></div>';
        conteudo += '</div>';

        conteudo += '<div id="done" class="done" style="display:none"><span class="check">✓</span><span id="doneText">Concluído.</span></div>';
    }

    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gift</title><style>' +
    '*{margin:0;padding:0;box-sizing:border-box}' +
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0c;color:#d4d4d8;min-height:100vh;padding:60px 20px;display:flex;justify-content:center;align-items:flex-start;-webkit-font-smoothing:antialiased}' +
    'body::before{content:"";position:fixed;inset:0;background-image:linear-gradient(rgba(255,255,255,0.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.012) 1px,transparent 1px);background-size:80px 80px;pointer-events:none;z-index:0}' +
    '.wrap{max-width:620px;width:100%;position:relative;z-index:1}' +

    'h1{font-size:24px;color:#f4f4f5;font-weight:600;letter-spacing:-0.4px;margin-bottom:6px}' +
    '.muted{font-size:13.5px;color:#71717a;line-height:1.55}' +

    '.top{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:1px solid #1a1a1e;margin-bottom:28px;gap:16px;flex-wrap:wrap}' +
    '.top-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}' +
    '.pill{font-size:11px;color:#4ade80;background:#0f1f14;border:1px solid #1a3524;padding:5px 11px;border-radius:4px;font-weight:500;letter-spacing:0.2px;white-space:nowrap}' +
    '.pill-red{color:#f87171;background:#1f0f0f;border-color:#3f1f1f}' +
    '.pill-live{position:relative;padding-left:18px}' +
    '.pill-live::before{content:"";position:absolute;left:8px;top:50%;transform:translateY(-50%);width:5px;height:5px;background:#4ade80;border-radius:50%;animation:p 2s infinite}' +
    '@keyframes p{0%,100%{opacity:1}50%{opacity:0.3}}' +

    '.btn-verificar{font-size:12.5px;color:#e4e4e7;background:#18181b;border:1px solid #27272a;padding:6px 14px;border-radius:6px;text-decoration:none;font-weight:500;transition:all 0.2s;white-space:nowrap}' +
    '.btn-verificar:hover{background:#1f1f23;border-color:#3f3f46;color:#fff}' +

    '.rows{border-top:1px solid #1a1a1e;border-bottom:1px solid #1a1a1e;margin-bottom:32px}' +
    '.row{display:flex;justify-content:space-between;padding:14px 0;font-size:13.5px;border-bottom:1px solid #1a1a1e}' +
    '.row:last-child{border-bottom:none}' +
    '.row span:first-child{color:#71717a}' +
    '.row span:last-child{color:#e4e4e7;font-weight:500}' +

    '.steps{margin-bottom:28px}' +
    '.step{display:flex;gap:20px;padding:22px 0;border-bottom:1px solid #1a1a1e}' +
    '.step:last-child{border-bottom:none}' +
    '.num{color:#52525b;font-size:12px;font-weight:600;font-family:monospace;padding-top:3px;flex-shrink:0}' +
    '.step h3{font-size:14px;color:#e4e4e7;font-weight:500;margin-bottom:6px}' +
    '.step input{width:100%;margin-top:10px;padding:11px 14px;background:#0d0d10;border:1px solid #1f1f24;border-radius:6px;color:#e4e4e7;font-size:13.5px;font-family:inherit;outline:none;transition:border-color 0.2s}' +
    '.step input:focus{border-color:#3f3f46}' +
    '.step input::placeholder{color:#3f3f46}' +
    '.link{display:inline-block;margin-top:10px;color:#a1a1aa;font-size:13px;text-decoration:none;border-bottom:1px solid #3f3f46;padding-bottom:1px;transition:all 0.2s}' +
    '.link:hover{color:#e4e4e7;border-color:#71717a}' +

    'button{padding:11px 22px;background:#18181b;color:#e4e4e7;border:1px solid #27272a;border-radius:7px;font-size:13.5px;font-weight:500;cursor:pointer;font-family:inherit;transition:all 0.2s;margin-top:10px}' +
    'button:hover{background:#1f1f23;border-color:#3f3f46}' +
    'button:disabled{opacity:0.4;cursor:not-allowed}' +

    '.msg{padding:12px 16px;border-radius:6px;font-size:13px;margin-bottom:16px;border:1px solid #27272a;background:#0d0d10;color:#a1a1aa}' +
    '.msg.error{border-color:#3f1f1f;color:#f87171}' +
    '.msg.success{border-color:#1f3a26;color:#4ade80}' +

    '.prog{background:#0d0d10;border:1px solid #1a1a1e;border-radius:9px;padding:22px;margin-bottom:14px}' +
    '.prog-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}' +
    '.prog-title{font-size:14px;color:#e4e4e7;font-weight:500;margin-bottom:3px}' +
    '.prog-sub{font-size:11.5px;color:#52525b;font-family:monospace}' +
    '.prog-bar-wrap{height:6px;background:#18181b;border-radius:3px;overflow:hidden;margin-bottom:10px}' +
    '.prog-bar{height:100%;width:0%;background:#3b82f6;border-radius:3px;transition:width 0.5s ease}' +
    '.prog-info{display:flex;justify-content:space-between;font-size:11.5px;color:#71717a;margin-bottom:20px;font-family:monospace}' +
    '.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-top:1px solid #1a1a1e;padding-top:18px}' +
    '.stat{text-align:center;padding:0 8px;border-right:1px solid #1a1a1e}' +
    '.stat:last-child{border-right:none}' +
    '.stat span{display:block;font-size:10.5px;color:#52525b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px}' +
    '.stat b{font-size:17px;color:#e4e4e7;font-weight:600;letter-spacing:-0.3px}' +

    '.log{background:#050507;border:1px solid #1a1a1e;border-radius:9px;overflow:hidden;margin-bottom:14px}' +
    '.log-head{padding:11px 16px;font-size:11.5px;color:#71717a;border-bottom:1px solid #1a1a1e;text-transform:uppercase;letter-spacing:0.8px;font-weight:500}' +
    '.log-body{font-family:"Courier New",monospace;font-size:12.5px;line-height:1.75;color:#4ade80;padding:14px 16px;max-height:260px;overflow-y:auto}' +
    '.log-body::-webkit-scrollbar{width:6px}' +
    '.log-body::-webkit-scrollbar-track{background:transparent}' +
    '.log-body::-webkit-scrollbar-thumb{background:#27272a;border-radius:3px}' +
    '.log-line{padding:1px 0;word-break:break-all}' +
    '.log-line.erro{color:#f87171}' +
    '.log-line.sucesso{color:#4ade80;font-weight:600}' +

    '.done{display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;border:1px solid #1f3a26;border-radius:8px;background:#0a0f0b;font-size:13px;color:#4ade80}' +
    '.check{width:18px;height:18px;background:#4ade80;color:#0a0a0c;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700}' +

    '@media(max-width:600px){body{padding:32px 16px}.top{flex-direction:column;gap:12px}.stats{grid-template-columns:repeat(2,1fr);gap:14px 0}.stat:nth-child(2){border-right:none}.stat:nth-child(3),.stat:nth-child(4){border-top:1px solid #1a1a1e;padding-top:14px}}' +
    '</style></head><body><div class="wrap">' + conteudo + '</div><script>' +
    'var codigoGift="' + gift.codigo + '";var ultimoLogIndex=0;var logInterval=null;var startTime=0;' +
    'async function iniciarGift(){' +
    'var g=document.getElementById("guildId").value.trim();' +
    'var b=document.getElementById("btnIniciar");' +
    'var s=document.getElementById("statusBox");' +
    'if(!g){s.style.display="block";s.className="msg error";s.textContent="Informe o ID do servidor.";return;}' +
    'if(!/^\\d{17,20}$/.test(g)){s.style.display="block";s.className="msg error";s.textContent="ID invalido.";return;}' +
    'b.disabled=true;b.textContent="Iniciando...";' +
    's.style.display="block";s.className="msg";s.textContent="Verificando servidor...";' +
    'try{' +
    'var r=await fetch("/api/gift/"+codigoGift,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({guildId:g})});' +
    'var d=await r.json();' +
    'if(!r.ok){s.className="msg error";s.textContent=d.error||"Erro.";b.disabled=false;b.textContent="Iniciar puxada";return;}' +
    's.style.display="none";b.textContent="Concluido";' +
    'document.getElementById("prog").style.display="block";' +
    'document.getElementById("log").style.display="block";' +
    'document.getElementById("progGuild").textContent="Servidor — "+g;' +
    'startTime=Date.now();' +
    'iniciarPolling();' +
    '}catch(e){s.className="msg error";s.textContent="Erro de conexao.";b.disabled=false;b.textContent="Iniciar puxada";}' +
    '}' +
    'function iniciarPolling(){' +
    'if(logInterval)clearInterval(logInterval);' +
    'logInterval=setInterval(async function(){' +
    'try{' +
    'var r=await fetch("/api/gift/"+codigoGift+"/logs");' +
    'var logs=await r.json();' +
    'atualizarLogs(logs);' +
    'atualizarStats(logs);' +
    '}catch(e){}' +
    '},1500);' +
    '}' +
    'function atualizarLogs(logs){' +
    'if(logs.length>ultimoLogIndex){' +
    'var novos=logs.slice(ultimoLogIndex);' +
    'var c=document.getElementById("logBody");' +
    'novos.forEach(function(l){' +
    'var d=document.createElement("div");' +
    'd.className="log-line";' +
    'if(l.erro)d.className+=" erro";' +
    'if(l.sucesso)d.className+=" sucesso";' +
    'd.textContent="["+l.hora+"] "+l.texto;' +
    'c.appendChild(d);' +
    '});' +
    'c.scrollTop=c.scrollHeight;' +
    'ultimoLogIndex=logs.length;' +
    '}' +
    '}' +
    'function atualizarStats(logs){' +
    'var puxados=0;var total=0;var fim=false;' +
    'for(var i=0;i<logs.length;i++){' +
    'var t=logs[i].texto;' +
    'if(t.indexOf("puxado com sucesso")>-1)puxados++;' +
    'var m=t.match(/de (\\d+) membros/);' +
    'if(m)total=parseInt(m[1]);' +
    'if(t.indexOf("Finalizado")>-1)fim=true;' +
    '}' +
    'var pct=total>0?Math.min(Math.round((puxados/total)*100),100):0;' +
    'document.getElementById("progBar").style.width=pct+"%";' +
    'document.getElementById("progPercent").textContent=pct+"%";' +
    'document.getElementById("progCount").textContent=puxados+" / "+total;' +
    'document.getElementById("statPuxados").textContent=puxados;' +
    'document.getElementById("statTotal").textContent=total;' +
    'var el=(Date.now()-startTime)/1000;' +
    'var v=puxados>0?(puxados/el).toFixed(2):"0.00";' +
    'document.getElementById("statVel").textContent=v+"/s";' +
    'var rest=total>puxados?Math.ceil((total-puxados)/(parseFloat(v)||0.5)):0;' +
    'document.getElementById("statRest").textContent=rest>0?rest+"s":"—";' +
    'if(fim){' +
    'document.getElementById("progBadge").textContent="Concluido";' +
    'document.getElementById("progBadge").className="pill";' +
    'document.getElementById("done").style.display="flex";' +
    'document.getElementById("doneText").textContent="Todos os "+total+" membros foram puxados com sucesso.";' +
    'if(logInterval){clearInterval(logInterval);logInterval=null;}' +
    '}' +
    '}' +
    '</script></body></html>';
}

module.exports = { renderGiftPage };
