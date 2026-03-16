const http = require('http');

const data = JSON.stringify({
    tipo: 'admin',
    username: 'admin',
    password: 'b0alo'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

console.log('Probando login con:', JSON.parse(data));

const req = http.request(options, (res) => {
    console.log('\nStatus Code:', res.statusCode);
    console.log('Headers:', res.headers);
    
    let body = '';
    
    res.on('data', (chunk) => {
        body += chunk;
    });
    
    res.on('end', () => {
        console.log('\nRespuesta:');
        try {
            console.log(JSON.parse(body));
        } catch (e) {
            console.log(body);
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.write(data);
req.end();
