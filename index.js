const mineflayer = require('mineflayer');
const http = require('http');

function createBot() {
    const bot = mineflayer.createBot({
        // 1. We connect directly to the main Minefort network hub
        host: 'play.minefort.com', 
        port: 25565,                         
        username: 'Minefort_247_Bot'
    });

    bot.on('login', () => {
        console.log('Connected to Minefort Lobby! Sending jump request...');
    });

    bot.on('spawn', () => {
        // 2. Once the bot lands in the lobby, it will automatically run your join command
        setTimeout(() => {
            bot.chat('/join sleepyempire'); // <-- Automatically sends bot to your server
            console.log('Join command executed.');
        }, 3000); // 3-second delay to ensure lobby chunks load safely

        // 3. Make sure it stays in creative mode once it arrives on your server
        setTimeout(() => {
            bot.chat('/gamemode creative'); 
        }, 8000);
    } );
    
    // Anti-kick: Jump cycle to stay active
    setInterval(() => {
        if (bot.entity) bot.setControlState('jump', true);
        setTimeout(() => bot.setControlState('jump', false), 500);
    }, 240000);

    // Auto-reconnect safety net
    bot.on('end', () => {
        console.log('Disconnected from proxy. Reconnecting in 15 seconds...');
        setTimeout(createBot, 15000);
    });
    
    bot.on('error', (err) => console.log('Network Error:', err));
}

createBot();

// Dummy Web Server for Render hosting uptime
http.createServer((req, res) => {
    res.write("Bot is alive!");
    res.end();
}).listen(process.env.PORT || 8080);
