console.log("🚀 STARTING HUMAN BOTS (Stable Connection)...");

// 🛑 PREVENT THE WHOLE APP FROM CRASHING ON NETWORK ERRORS
process.on('uncaughtException', (err) => {
  console.log('❌ Caught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.log('❌ Unhandled Promise Rejection:', reason);
});

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');

// ================= CONFIG =================
const BOT_PASSWORD = 'Streamersarenotcoolbeo'; 

// 🛑 TRY A STABLE VERSION FIRST
const MINECRAFT_VERSION = '1.21.1'; 

const SERVERS = [
  // 🛑 NEW, SIMPLE USERNAMES
  { host: 'sleepyempire.levyathan.ch', port: 25565, username: 'BotAlpha01' },
  { host: 'sleepy.levyathan.ch',       port: 25565, username: 'BotBeta02' } 
];

const CHAT_MESSAGES = [ /* ... your chat messages ... */ ];
// ==========================================

const delay = (min = 1000, max = 4000) => new Promise(r => setTimeout(r, Math.random() * (max - min) + min));

// ... (Your doHumanAction function remains exactly the same) ...
async function doHumanAction(bot, mcData) {
    // ... your existing logic ...
}

function startBot(config) {
  let isConnecting = false;
  let connectionTimeout = null;
  let isKicked = false;
  const tag = `[${config.username}@${config.host}]`;

  const run = () => {
    if (isConnecting) return;
    isConnecting = true;
    isKicked = false;

    console.log(`\n🎯 INITIALIZING ${tag}...`);

    let bot;
    try {
      bot = mineflayer.createBot({
        host: config.host,
        port: config.port,
        username: config.username,
        auth: 'offline',
        version: MINECRAFT_VERSION,
        // 🛑 INCREASE CONNECTION TIMEOUT
        checkTimeoutInterval: 300 * 1000 // 5 minutes
      });
    } catch (err) {
      console.log(`❌ ${tag} Failed to create bot instance (Possibly wrong version?):`, err.message);
      isConnecting = false;
      setTimeout(run, 30000);
      return;
    }

    bot.loadPlugin(pathfinder);

    // This is a separate, hard timeout to force a retry
    connectionTimeout = setTimeout(() => {
      if (isConnecting) {
        console.log(`❌ ${tag} Hard timeout after 60s. Forcing retry...`);
        bot.end(); 
      }
    }, 60000);

    // ... (The rest of your event handlers: spawn, message, error, kicked, end) ...
    // ... remain exactly the same ...
  };

  run(); 
}

// ================= START ALL BOTS =================
console.log(`Starting ${SERVERS.length} independent bots...`);
SERVERS.forEach((server, index) => {
  setTimeout(() => startBot(server), index * 5000);
});
