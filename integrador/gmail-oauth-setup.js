/**
 * Gmail OAuth - Gerador de Refresh Token
 * 
 * Execute este script UMA VEZ para obter o refresh_token:
 * 1. node gmail-oauth-setup.js
 * 2. Acesse a URL no navegador
 * 3. Autorize o app
 * 4. Cole o código aqui
 * 5. Copie o refresh_token para as variáveis de ambiente
 */

const http = require('http');
const https = require('https');
const url = require('url');
const readline = require('readline');

const CLIENT_ID = '187165168994-luol5h03oepjcqjtseaadbih33aht560.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:3333/oauth2callback';
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

function getAuthUrl() {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: SCOPES.join(' '),
        access_type: 'offline',
        prompt: 'consent'
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCodeForTokens(code) {
    return new Promise((resolve, reject) => {
        const postData = new URLSearchParams({
            code: code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
        }).toString();

        const options = {
            hostname: 'oauth2.googleapis.com',
            path: '/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': postData.length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Failed to parse response: ' + data));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function main() {
    console.log('\n=== Gmail OAuth Setup ===\n');
    console.log('1. Acesse esta URL no navegador:\n');
    console.log(getAuthUrl());
    console.log('\n2. Autorize o aplicativo com a conta gamataurize@gmail.com');
    console.log('3. Você será redirecionado para localhost:3333');
    console.log('4. Copie o código da URL (parâmetro "code")\n');

    // Criar servidor temporário para capturar o código
    const server = http.createServer(async (req, res) => {
        const parsedUrl = url.parse(req.url, true);
        
        if (parsedUrl.pathname === '/oauth2callback' && parsedUrl.query.code) {
            const code = parsedUrl.query.code;
            
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Código recebido! Volte ao terminal.</h1>');
            
            console.log('\n✅ Código recebido! Trocando por tokens...\n');
            
            try {
                const tokens = await exchangeCodeForTokens(code);
                
                console.log('=== TOKENS OBTIDOS ===\n');
                console.log('ACCESS_TOKEN:', tokens.access_token?.substring(0, 50) + '...');
                console.log('\n🔑 REFRESH_TOKEN (GUARDE ESTE!):\n');
                console.log(tokens.refresh_token);
                console.log('\n=== Adicione ao .env ===');
                console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
                
                server.close();
                process.exit(0);
            } catch (error) {
                console.error('❌ Erro:', error.message);
                server.close();
                process.exit(1);
            }
        } else {
            res.writeHead(404);
            res.end('Not found');
        }
    });

    server.listen(3333, () => {
        console.log('Servidor OAuth aguardando em http://localhost:3333...\n');
    });
}

main().catch(console.error);
