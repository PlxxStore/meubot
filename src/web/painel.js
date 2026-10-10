console.log('🚀 [painel.js] arquivo carregado');

module.exports = function(app, client, config, users) {
    console.log('🚀 [painel.js] função executada');

    app.get('/painel', (req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send('<!DOCTYPE html><html><head><title>Painel</title></head><body><h1>Painel OK</h1></body></html>');
    });

    console.log('✅ [painel.js] rotas registradas');
};
