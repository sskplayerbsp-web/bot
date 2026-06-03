const mineflayer = require('mineflayer');
const http = require('http');

function createBot() {
    console.log('Attempting connection directly to server address...');
    
    const bot = mineflayer.createBot({
        host: 'sleepyempire.minefort.com', 
        port: 25565,                         
        username: 'Minefort_247_Bot',
        checkTimeoutInterval: 60000
    });

    bot.on('login', () => {
        console.log('Bot logged into Minefort system successfully!');
    });

    bot.on('spawn', () => {
        console.log('Bot spawned in world!');
        setTimeout(() => {
            bot.chat('/gamemode creative'); 
        }, 5000);
    });
    
    // Jump routine to maintain activity state
    setInterval(() => {
        if (bot.entity) {
            bot.setControlState('jump', true);
            setTimeout(() => bot.setControlState('jump', false), 500);
        }
    }, 60000);

    bot.on('end', (reason) => {
        console.log(`Disconnected. Reason: ${reason}. Retrying in 10s...`);
        setTimeout(createBot, 10000);
    });
    
    bot.on('error', (err) => {
        console.log('Internal Network Error: ', err.message);
    });
}

createBot();

// Maintain container web binding
http.createServer((req, res) => {
    res.write("Bot container online.");
    res.end();
}).listen(process.env.PORT || 8080);
