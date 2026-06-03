const bedrock = require('bedrock-protocol');
const express = require('express'); // Import the web server library

// CONFIGURATION
const MINEFORT_LOBBY = '://minefort.com';
const BEDROCK_PORT = 19132;
const MICROSOFT_EMAIL = 'shravan.sktn20@gmail.com'; 
const YOUR_SERVER_NAME = 'sleepyempire'; 

function startBot() {
    console.log(`Connecting to ${MINEFORT_LOBBY}:${BEDROCK_PORT}...`);

    const client = bedrock.createClient({
        host: MINEFORT_LOBBY,
        port: BEDROCK_PORT,
        username: MICROSOFT_EMAIL,
        offline: false,
        skipPing: true 
    });

    client.on('spawn', () => {
        console.log('Bot logged in safely!');
        setTimeout(() => {
            client.queue('text', {
                type: 'chat',
                needs_translation: false,
                source_name: client.username,
                xuid: '',
                platform_chat_id: '',
                message: `/join ${YOUR_SERVER_NAME}`
            });
            console.log(`Sent server wake-up command for: ${YOUR_SERVER_NAME}`);
        }, 5000);
    });

    client.on('error', (err) => {
        console.error('[Bot Error Handled]:', err.message);
    });

    client.on('close', (reason) => {
        console.log(`Disconnected: ${reason}. Reconnecting in 30 seconds...`);
        setTimeout(startBot, 30000);
    });
}

// Start the Minecraft Bot
startBot();

// FIX FOR RENDER: Fake web page to stop the "No open HTTP ports" error
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is Alive!'));
app.listen(PORT, () => console.log(`[Web Server] Listening on port ${PORT}`));
