function renderGiftPage(gift, baseUrl) {
    const status = gift.status;
    const expirado = gift.expiresAt ? Date.now() > gift.expiresAt : false;
    const dataExpira = gift.expiresAt ? new Date(gift.expiresAt).toLocaleString('pt-BR') : 'Nunca';

    let conteudoPrincipal = '';

    if (status === 'esgotado') {
        conteudoPrincipal = '<div class="result-box"><div class="result-icon success">✓</div><h1>Gift já utilizado</h1><p>Este gift já foi resgatado e não está mais disponível.</p></div>';
    } else if (expirado) {
        conteudoPrincipal = '<div class="result-box"><div class="result-icon danger">×</div><h1>Gift expirado</h1><p>Este gift expirou em ' + dataExpira + '.</p></div>';
    } else {
        conteudoPrincipal = '<div class="gift-header">';
        conteudoPrincipal += '<div class="gift-icon">🎁</div>';
        conteudoPrincipal += '<div class="gift-header-info">';
        conteudoPrincipal += '<h1>Gift de Membros</h1>';
        conteudoPrincipal += '<p>Servidor de destino</p>';
        conteudoPrincipal += '</div>';
        conteudoPrincipal += '<div class="gift-badge">Ativo</div>';
        conteudoPrincipal += '</div>';

        conteudoPrincipal += '<div class="info-grid">';
        conteudoPrincipal += '<div class="info-card"><div class="info-icon">👥</div><div class="info-value">' + gift.quantidade + '</div><div class="info-label">Membros</div></div>';
        conteudoPrincipal += '<div class="info-card"><div class="info-icon">⏰</div><div class="info-value">' + (gift.expiresAt ? '7d' : '∞') + '</div><div class="info-label">Expira em</div></div>';
        conteudoPrincipal += '<div class="info-card"><div class="info-icon">🔒</div><div class="info-value">' + (gift.soVerificado ? 'Sim' : 'Não') + '</div><div class="info-label">Só verificado</div></div>';
        conteudoPrincipal += '</div>';

        conteudoPrincipal += '<div class="steps">';
        conteudoPrincipal += '<div class="step"><div class="step-num">1</div><div class="step-content"><h3>Adicionar o bot</h3><p>Clique no botão abaixo pra convidar o bot com as permissões necessárias.</p><a href="' + baseUrl + '/invite" target="_blank" class="btn btn-primary">Adicionar Bot</a></div></div>';
        conteudoPrincipal += '<div class="step"><div class="step-num">2</div><div class="step-content"><h3>Informar o ID do servidor</h3><p>Ative o modo desenvolvedor no Discord e copie o ID do servidor.</p><input type="text" id="guildId" placeholder="000000000000000000" maxlength="20" /></div></div>';
        conteudoPrincipal += '<div class="step"><div class="step-num">3</div><div class="step-content"><h3>Iniciar puxada</h3><p>O bot vai puxar ' + gift.quantidade + ' membros pro servidor informado.</p><button id="btnIniciar" class="btn btn-success" onclick="iniciarGift()">Iniciar Puxada</button></div></div>';
        conteudoPrincipal += '</div>';

        conteudoPrincipal += '<div id="statusBox" class="status-box" style="display:none"></div>';

        // PROGRESSO
        conteudoPrincipal += '<div id="progressContainer" class="progress-container" style="display:none">';
        conteudoPrincipal += '<div class="progress-header"><div class="progress-header-left"><div class="progress-avatar">🎁</div><div><div class="progress-title">Puxando Membros</div><div class="progress-subtitle" id="progressGuild">Servidor: -</div></div></div><div class="progress-badge" id="progressBadge"><span class="dot"></span> Em andamento</div></div>';
        conteudoPrincipal += '<div class="progress-bar-label"><span>Progresso</span><span id="progressPercent">0%</span></div>';
        conteudoPrincipal += '<div class="progress-bar-wrapper"><div class="progress-bar" id="progressBar"></div></div>';
        conteudoPrincipal += '<div class="stats-grid">';
        conteudoPrincipal += '<div class="stat-card"><div class="stat-icon">👥</div><div class="stat-value" id="statPuxados">0</div><div class="stat-label">Puxados</div></div>';
        conteudoPrincipal += '<div class="stat-card"><div class="stat-icon">📊</div><div class="stat-value" id="statTotal">0</div><div class="stat-label">Total</div></div>';
        conteudoPrincipal += '<div class="stat-card"><div class="stat-icon">⚡</div><div class="stat-value" id="statVelocidade">~0.00/s</div><div class="stat-label">Velocidade</div></div>';
        conteudoPrincipal += '<div class="stat-card"><div class="stat-icon">⏱️</div><div class="stat-value" id="statRestante">0s</div><div class="stat-label">Restante</div></div>';
        conteudoPrincipal += '</div>';
        conteudoPrincipal += '</div>';

        // LOGS
        conteudoPrincipal += '<div id="logContainer" class="log-container" style="display:none">';
        conteudoPrincipal += '<div class="log-header"><span class="log-header-icon">📡</span><span class="log-header-title">Log em Tempo Real</span></div>';
        conteudoPrincipal += '<div class="log-content" id="logContent"></div>';
        conteudoPrincipal += '</div>';

        conteudoPrincipal += '<div id="conclusao" class="conclusao" style="display:none">';
        conteudoPrincipal += '<div class="conclusao-icon">✓</div>';
        conteudoPrincipal += '<div class="conclusao-text" id="conclusaoText">Todos os membros foram puxados com sucesso!</div>';
        conteudoPrincipal += '</div>';
    }

    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Gift de Membros</title><style>' +
    '*{margin:0;padding:0;box-sizing:border-box}' +
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:rgb(10,10,12);color:rgb(212,212,216);min-height:100vh;-webkit-font-smoothing:antialiased;padding:40px 20px;display:flex;justify-content:center;align-items:flex-start}' +
    'body::before{content:"";position:fixed;top:0;left:0;right:0;bottom:0;background-image:linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px);background-size:80px 80px;pointer-events:none;z-index:0}' +
    '.container{max-width:760px;width:100%;background:rgb(15,15,18);border:1px solid rgb(28,28,32);border-radius:14px;padding:32px;position:relative;z-index:1;box-shadow:0 20px 60px rgba(0,0,0,0.4)}' +

    // GIFT HEADER
    '.gift-header{display:flex;align-items:center;gap:16px;padding-bottom:24px;border-bottom:1px solid rgb(28,28,32);margin-bottom:24px}' +
    '.gift-icon{width:56px;height:56px;background:linear-gradient(135deg,rgb(88,101,242),rgb(71,82,196));border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0}' +
    '.gift-header-info{flex:1}' +
    '.gift-header-info h1{font-size:22px;color:rgb(244,244,245);font-weight:700;letter-spacing:-0.5px;margin-bottom:4px}' +
    '.gift-header-info p{font-size:13px;color:rgb(113,113,122)}' +
    '.gift-badge{background:rgb(15,40,25);color:rgb(74,222,128);font-size:11px;font-weight:700;padding:6px 14px;border-radius:20px;text-transform:uppercase;letter-spacing:1px}' +

    // INFO GRID
    '.info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px}' +
    '.info-card{background:rgb(10,10,12);border:1px solid rgb(28,28,32);border-radius:10px;padding:18px;text-align:center;transition:all 0.2s}' +
    '.info-card:hover{border-color:rgb(40,40,45);transform:translateY(-2px)}' +
    '.info-icon{font-size:20px;margin-bottom:8px;opacity:0.8}' +
    '.info-value{font-size:20px;font-weight:700;color:rgb(228,228,231);margin-bottom:4px}' +
    '.info-label{font-size:11px;color:rgb(82,82,91);text-transform:uppercase;letter-spacing:0.6px;font-weight:500}' +

    // STEPS
    '.steps{margin-bottom:24px}' +
    '.step{display:flex;gap:16px;padding:16px 0;border-bottom:1px solid rgb(22,22,26)}' +
    '.step:last-child{border-bottom:none}' +
    '.step-num{width:28px;height:28px;background:rgb(26,26,30);border:1px solid rgb(38,38,43);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:rgb(161,161,170);flex-shrink:0}' +
    '.step-content{flex:1}' +
    '.step-content h3{font-size:14.5px;color:rgb(228,228,231);font-weight:600;margin-bottom:4px}' +
    '.step-content p{font-size:13px;color:rgb(113,113,122);margin-bottom:12px;line-height:1.5}' +
    '.step-content input{width:100%;padding:11px 14px;background:rgb(10,10,12);border:1px solid rgb(28,28,32);border-radius:8px;color:rgb(228,228,231);font-size:13px;font-family:inherit;outline:none;transition:border-color 0.2s}' +
    '.step-content input:focus{border-color:rgb(88,101,242)}' +
    '.step-content input::placeholder{color:rgb(63,63,70)}' +

    // BOTÕES
    '.btn{display:inline-flex;align-items:center;gap:8px;padding:11px 20px;border-radius:8px;border:none;cursor:pointer;font-size:13.5px;font-weight:600;text-decoration:none;font-family:inherit;transition:all 0.2s}' +
    '.btn-primary{background:rgb(88,101,242);color:white}' +
    '.btn-primary:hover{background:rgb(71,82,196);transform:translateY(-1px)}' +
    '.btn-success{background:rgb(59,165,93);color:white}' +
    '.btn-success:hover{background:rgb(45,128,73);transform:translateY(-1px)}' +
    '.btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}' +

    // STATUS
    '.status-box{padding:14px 18px;border-radius:9px;font-size:13px;margin-bottom:16px;border:1px solid rgb(28,28,32);background:rgb(10,10,12);line-height:1.5}' +
    '.status-box.success{border-color:rgb(31,58,38);color:rgb(74,222,128)}' +
    '.status-box.error{border-color:rgb(63,31,31);color:rgb(248,113,113)}' +
    '.status-box.info{color:rgb(161,161,170)}' +

    // PROGRESSO
    '.progress-container{background:rgb(10,10,12);border:1px solid rgb(28,28,32);border-radius:12px;padding:24px;margin-bottom:16px;animation:fadeIn 0.4s ease}' +
    '.progress-header{display:flex;justify-content:space-between;align-items:center;padding-bottom:20px;border-bottom:1px solid rgb(22,22,26);margin-bottom:20px}' +
    '.progress-header-left{display:flex;align-items:center;gap:12px}' +
    '.progress-avatar{width:44px;height:44px;background:linear-gradient(135deg,rgb(88,101,242),rgb(71,82,196));border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px}' +
    '.progress-title{font-size:16px;font-weight:700;color:rgb(244,244,245);margin-bottom:2px}' +
    '.progress-subtitle{font-size:12px;color:rgb(82,82,91);font-family:monospace}' +
    '.progress-badge{display:flex;align-items:center;gap:6px;background:rgb(15,40,25);color:rgb(74,222,128);font-size:11px;font-weight:700;padding:6px 14px;border-radius:20px;text-transform:uppercase;letter-spacing:0.8px}' +
    '.progress-badge .dot{width:7px;height:7px;background:rgb(74,222,128);border-radius:50%;animation:pulse 1.5s ease-in-out infinite}' +
    '@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.85)}}' +
    '.progress-bar-label{display:flex;justify-content:space-between;font-size:12.5px;color:rgb(161,161,170);margin-bottom:10px}' +
    '.progress-bar-label span:last-child{color:rgb(228,228,231);font-weight:600}' +
    '.progress-bar-wrapper{height:8px;background:rgb(26,26,30);border-radius:4px;overflow:hidden;margin-bottom:20px}' +
    '.progress-bar{height:100%;width:0%;background:linear-gradient(90deg,rgb(96,165,250),rgb(59,130,246));border-radius:4px;transition:width 0.4s ease}' +
    '.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}' +
    '.stat-card{background:rgb(15,15,18);border:1px solid rgb(28,28,32);border-radius:9px;padding:14px 10px;text-align:center}' +
    '.stat-icon{font-size:16px;margin-bottom:6px;opacity:0.7}' +
    '.stat-value{font-size:20px;font-weight:700;color:rgb(228,228,231);margin-bottom:2px;letter-spacing:-0.5px}' +
    '.stat-label{font-size:10.5px;color:rgb(82,82,91);text-transform:uppercase;letter-spacing:0.5px}' +

    // LOG
    '.log-container{background:rgb(5,5,7);border:1px solid rgb(28,28,32);border-radius:12px;padding:18px;margin-bottom:16px;animation:fadeIn 0.4s ease}' +
    '.log-header{display:flex;align-items:center;gap:8px;padding-bottom:12px;border-bottom:1px solid rgb(22,22,26);margin-bottom:14px}' +
    '.log-header-icon{font-size:16px}' +
    '.log-header-title{font-size:13px;font-weight:600;color:rgb(228,228,231)}' +
    '.log-content{font-family:"Courier New",monospace;font-size:12.5px;line-height:1.9;max-height:280px;overflow-y:auto;color:rgb(74,222,128);padding-right:8px}' +
    '.log-content::-webkit-scrollbar{width:8px}' +
    '.log-content::-webkit-scrollbar-track{background:rgb(10,10,12);border-radius:4px}' +
    '.log-content::-webkit-scrollbar-thumb{background:rgb(45,45,51);border-radius:4px}' +
    '.log-content::-webkit-scrollbar-thumb:hover{background:rgb(63,63,70)}' +
    '.log-line{padding:2px 0;word-break:break-all}' +
    '.log-line.erro{color:rgb(248,113,113)}' +
    '.log-line.sucesso{color:rgb(74,222,128);font-weight:600}' +
    '.log-line.destaque{color:rgb(96,165,250);font-weight:700}' +

    // CONCLUSÃO
    '.conclusao{display:flex;align-items:center;justify-content:center;gap:10px;background:rgb(10,10,12);border:1px solid rgb(31,58,38);border-radius:10px;padding:16px 24px;animation:fadeIn 0.5s ease}' +
    '.conclusao-icon{width:22px;height:22px;background:rgb(59,165,93);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0}' +
    '.conclusao-text{font-size:13.5px;color:rgb(74,222,128);font-weight:600}' +

    // RESULT BOX
    '.result-box{text-align:center;padding:32px 20px}' +
    '.result-icon{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 20px;font-weight:300}' +
    '.result-icon.success{background:rgb(15,40,25);color:rgb(74,222,128)}' +
    '.result-icon.danger{background:rgb(40,15,15);color:rgb(248,113,113)}' +
    '.result-box h1{font-size:22px;color:rgb(244,244,245);margin-bottom:8px;font-weight:700}' +
    '.result-box p{font-size:14px;color:rgb(113,113,122);line-height:1.6}' +

    '@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}' +
    '@media(max-width:600px){body{padding:20px 12px}.container{padding:20px}.info-grid{grid-template-columns:repeat(3,1fr)}.stats-grid{grid-template-columns:repeat(2,1fr)}.gift-icon{width:48px;height:48px;font-size:24px}.gift-header-info h1{font-size:18px}}' +
    '</style></head><body>' +
    '<div class="container">' + conteudoPrincipal + '</div>' +
    '<script>' +
    'var codigoGift="' + gift.codigo + '";var ultimoLogIndex=0;var logInterval=null;var startTime=0;var totalEstimado=0;var processados=0;' +
    'async function iniciarGift(){' +
    'var guildId=document.getElementById("guildId").value.trim();' +
    'var btn=document.getElementById("btnIniciar");' +
    'var statusBox=document.getElementById("statusBox");' +
    'if(!guildId){statusBox.style.display="block";statusBox.className="status-box error";statusBox.textContent="Informe o ID do servidor.";return;}' +
    'if(!/^\\d{17,20}$/.test(guildId)){statusBox.style.display="block";statusBox.className="status-box error";statusBox.textContent="ID invalido. Use 17-20 digitos.";return;}' +
    'btn.disabled=true;btn.textContent="Iniciando...";' +
    'statusBox.style.display="block";statusBox.className="status-box info";statusBox.textContent="Verificando servidor...";' +
    'try{' +
    'var resp=await fetch("/api/gift/"+codigoGift,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({guildId:guildId})});' +
    'var data=await resp.json();' +
    'if(!resp.ok){statusBox.className="status-box error";statusBox.textContent=data.error||"Erro.";btn.disabled=false;btn.textContent="Iniciar Puxada";return;}' +
    'statusBox.style.display="none";btn.textContent="Concluido";' +
    'document.getElementById("progressContainer").style.display="block";' +
    'document.getElementById("logContainer").style.display="block";' +
    'document.getElementById("progressGuild").textContent="Servidor: "+guildId;' +
    'startTime=Date.now();' +
    'iniciarPolling();' +
    '}catch(err){statusBox.className="status-box error";statusBox.textContent="Erro de conexao.";btn.disabled=false;btn.textContent="Iniciar Puxada";}' +
    '}' +
    'function iniciarPolling(){' +
    'if(logInterval)clearInterval(logInterval);' +
    'logInterval=setInterval(async function(){' +
    'try{' +
    'var resp=await fetch("/api/gift/"+codigoGift+"/logs");' +
    'var logs=await resp.json();' +
    'atualizarLogs(logs);' +
    'atualizarStats(logs);' +
    '}catch(e){}' +
    '},1500);' +
    '}' +
    'function atualizarLogs(logs){' +
    'if(logs.length>ultimoLogIndex){' +
    'var novos=logs.slice(ultimoLogIndex);' +
    'var content=document.getElementById("logContent");' +
    'novos.forEach(function(log){' +
    'var div=document.createElement("div");' +
    'div.className="log-line";' +
    'if(log.erro)div.className+=" erro";' +
    'if(log.sucesso)div.className+=" sucesso";' +
    'if(log.destaque)div.className+=" destaque";' +
    'div.textContent="["+log.hora+"] "+log.texto;' +
    'content.appendChild(div);' +
    '});' +
    'content.scrollTop=content.scrollHeight;' +
    'ultimoLogIndex=logs.length;' +
    '}' +
    '}' +
    'function atualizarStats(logs){' +
    'var puxados=0;var total=0;var finalizado=false;' +
    'for(var i=0;i<logs.length;i++){' +
    'var t=logs[i].texto;' +
    'if(t.indexOf("puxado com sucesso")>-1)puxados++;' +
    'var m=t.match(/de (\\d+) membros/);' +
    'if(m)total=parseInt(m[1]);' +
    'if(t.indexOf("Finalizado")>-1)finalizado=true;' +
    '}' +
    'if(total===0){' +
    'var m2=logs[0]?logs[0].texto.match(/de (\\d+) membros/):null;' +
    'if(m2)total=parseInt(m2[1]);' +
    '}' +
    'var percent=total>0?Math.min(Math.round((puxados/total)*100),100):0;' +
    'document.getElementById("progressBar").style.width=percent+"%";' +
    'document.getElementById("progressPercent").textContent=percent+"%";' +
    'document.getElementById("statPuxados").textContent=puxados;' +
    'document.getElementById("statTotal").textContent=total;' +
    'var elapsed=(Date.now()-startTime)/1000;' +
    'var vel=puxados>0?(puxados/elapsed).toFixed(2):"0.00";' +
    'document.getElementById("statVelocidade").textContent="~"+vel+"/s";' +
    'var restante=total>puxados?Math.ceil((total-puxados)/(parseFloat(vel)||0.5)):0;' +
    'document.getElementById("statRestante").textContent=restante+"s";' +
    'if(finalizado){' +
    'document.getElementById("progressBadge").innerHTML="<span class=\\"dot\\"></span> Concluido";' +
    'document.getElementById("progressBadge").style.background="rgb(15,40,25)";' +
    'document.getElementById("progressBadge").style.color="rgb(74,222,128)";' +
    'document.getElementById("conclusao").style.display="flex";' +
    'document.getElementById("conclusaoText").textContent="Todos os "+total+" membros foram puxados com sucesso!";' +
    'if(logInterval){clearInterval(logInterval);logInterval=null;}' +
    '}' +
    '}' +
    '</script></body></html>';
}

module.exports = { renderGiftPage };
