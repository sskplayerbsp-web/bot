const bedrock = require('bedrock-protocol');

// CONFIGURATION
const MINEFORT_LOBBY = 'play.minefort.com';
const BEDROCK_PORT = 19132;
const MICROSOFT_EMAIL = 'shravan.sktn20@gmail.com'; // Put your email here
const YOUR_SERVER_NAME = 'sleepyempire'; // Put your server name here

function startBot() {
    console.log(`Connecting to ${MINEFORT_LOBBY}:${BEDROCK_PORT}...`);

    const client = bedrock.createClient({
        host: MINEFORT_LOBBY,
        port: BEDROCK_PORT,
        username: MICROSOFT_EMAIL,
        offline: false,
        skipPing: true // Bypasses the initial ping check to avoid RakTimeout errors
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

    // CRITICAL: Prevents the script from crashing when network errors happen
    client.on('error', (err) => {
        console.error('[Bot Error Handled]:', err.message);
    });

    client.on('close', (reason) => {
        console.log(`Disconnected: ${reason}. Reconnecting in 30 seconds...`);
        setTimeout(startBot, 30000);
    });
}

startBot();
