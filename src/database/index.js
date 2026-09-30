const { MongoClient } = require('mongodb');

// ============================
// CONEXÃO COM MONGODB
// ============================
const uri = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'meubot';

if (!uri) {
    console.error('❌ MONGODB_URI não configurada! Os dados NÃO vão persistir.');
}

let mongoClient = null;
let mongoDb = null;
let conectado = false;

async function conectarMongo() {
    if (conectado && mongoDb) return mongoDb;
    if (!uri) throw new Error('MONGODB_URI não configurada');
    try {
        mongoClient = new MongoClient(uri);
        await mongoClient.connect();
        mongoDb = mongoClient.db(DB_NAME);
        conectado = true;
        console.log('✅ [MongoDB] conectado com sucesso!');
        return mongoDb;
    } catch (err) {
        console.error('❌ [MongoDB] erro de conexão:', err.message);
        conectado = false;
        throw err;
    }
}

// Conecta imediatamente ao ligar
conectarMongo().catch(err => console.error('Erro inicial MongoDB:', err.message));

// ============================
// WRAPPER COMPATÍVEL COM wio.db
// ============================
function criarColecao(nomeColecao) {
    return {
        // .set(key, value) → retorna Promise
        async set(key, value) {
            const db = await conectarMongo();
            const col = db.collection(nomeColecao);
            await col.updateOne(
                { _id: String(key) },
                { $set: { value } },
                { upsert: true }
            );
            return true;
        },

        // .get(key) → retorna Promise com o valor
        async get(key) {
            const db = await conectarMongo();
            const col = db.collection(nomeColecao);
            const doc = await col.findOne({ _id: String(key) });
            return doc ? doc.value : undefined;
        },

        // .all() → retorna Promise com array [{ID, data}]
        async all() {
            const db = await conectarMongo();
            const col = db.collection(nomeColecao);
            const docs = await col.find({}).toArray();
            return docs.map(d => ({
                ID: d._id,
                data: d.value
            }));
        },

        // .delete(key)
        async delete(key) {
            const db = await conectarMongo();
            const col = db.collection(nomeColecao);
            await col.deleteOne({ _id: String(key) });
            return true;
        },

        // .has(key)
        async has(key) {
            const db = await conectarMongo();
            const col = db.collection(nomeColecao);
            const doc = await col.findOne({ _id: String(key) });
            return !!doc;
        }
    };
}

// ============================
// EXPORTAÇÃO COMPATÍVEL
// ============================
const config = criarColecao('config');
const users = criarColecao('users');
const message = criarColecao('message');

module.exports = {
    config,
    users,
    message
};
