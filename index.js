const mineflayer = require('mineflayer');
const http = require('http');

// 1. Create the Minecraft Bot Connection
function createBot() {
    const bot = mineflayer.createBot({
        host: 'sleepyempire.minefort.com', // Change to your Minefort IP
        port: 25565,                         // Change to your Minefort Port if different
        username: 'Minefort_247_Bot'
    });

    bot.on('login', () => console.log('Bot successfully joined the server!'));
    bot.on('spawn', () => bot.chat('/gamemode creative')); // Keeps bot safe if OPed

    // Anti-kick: Moves minorly or chats every 4 minutes to stay active
    setInterval(() => {
        if (bot.entity) bot.setControlState('jump', true);
        setTimeout(() => bot.setControlState('jump', false), 500);
    }, 240000);

    // Auto-reconnect if kicked or server restarts
    bot.on('end', () => {
        console.log('Disconnected. Reconnecting in 10 seconds...');
        setTimeout(createBot, 10000);
    });
    bot.on('error', (err) => console.log('Error:', err));
}

createBot();

// 2. Dummy Web Server (Keeps the free cloud hosting platform awake)
http.createServer((req, res) => {
    res.write("Bot is alive!");
    res.end();
}).listen(process.env.PORT || 8080);
