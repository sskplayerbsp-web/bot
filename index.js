console.log("🚀 STARTING HUMAN BOTS...");

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');

// ================= CONFIG =================
const BOT_PASSWORD = 'Streamersarenotcoolbeo'; 

const SERVERS = [
  { host: 'sleepyempire.levyathan.ch', port: 25565, username: 'SkyBot_1' },
  { host: 'sleepy.levyathan.ch',       port: 25565, username: 'SkyBot_2' } 
];

// Things the bot will randomly say
const CHAT_MESSAGES = [
  "gg", "lol", "where is everyone?", "just got here", 
  "anyone wanna build?", "im bored", "hi", "bruh moment", 
  "this server is cool", "whats up"
];
// ==========================================

const delay = (min = 1000, max = 4000) => new Promise(r => setTimeout(r, Math.random() * (max - min) + min));

// ================= HUMAN ACTIONS =================
async function doHumanAction(bot, mcData) {
  if (!bot.entity || !bot.entity.position) return;

  const action = Math.floor(Math.random() * 8); // 8 different actions now
  try {
    switch (action) {
      case 0: // Smoothly look around
        const yaw = bot.entity.yaw + (Math.random() - 0.5) * 2;
        const pitch = (Math.random() - 0.5) * 1.5;
        await bot.look(yaw, pitch, false);
        break;
        
      case 1: // Walk safely to a random nearby spot
        const movements = new Movements(bot, mcData);
        movements.canDig = false; 
        bot.pathfinder.setMovements(movements);
        
        const pos = bot.entity.position;
        const randomX = pos.x + (Math.random() - 0.5) * 15;
        const randomZ = pos.z + (Math.random() - 0.5) * 15;
        
        const goal = new goals.GoalNear(randomX, pos.y, randomZ, 2);
        // Give up walking if it takes more than 5 seconds
        await Promise.race([ bot.pathfinder.goto(goal), delay(4000, 5000) ]);
        break;

      case 2: // Jump
        bot.setControlState('jump', true);
        await delay(200, 400);
        bot.setControlState('jump', false);
        break;

      case 3: // Swing arm
        bot.swingArm('right');
        break;

      case 4: // Sneak (crouch)
        bot.setControlState('sneak', true);
        await delay(500, 1500);
        bot.setControlState('sneak', false);
        break;

      case 5: // Switch hotbar slot
        bot.setQuickBarSlot(Math.floor(Math.random() * 9));
        break;
        
      case 6: // Just stand still and look (AFK for a moment)
        await delay(1000, 3000);
        break;
        
      case 7: // Chat randomly (20% chance so it doesn't spam)
        if (Math.random() < 0.2) {
          const msg = CHAT_MESSAGES[Math.floor(Math.random() * CHAT_MESSAGES.length)];
          bot.chat(msg);
          console.log(`[${bot.username}] Sent chat: ${msg}`);
        }
        break;
    }
  } catch (e) {}
}

// ================= BOT LOGIC =================
function startBot(config) {
  let isConnecting = false;
  let connectionTimeout = null;
  let isKicked = false;
  const tag = `[${config.username}@${config.host}]`;

  const run = () => {
    if (isConnecting) return;
    isConnecting = true;
    isKicked = false;

    console.log(`\n${tag} Attempting to connect...`);

    const bot = mineflayer.createBot({
      host: config.host,
      port: config.port,
      username: config.username,
      auth: 'offline',
      version: false 
    });

    bot.loadPlugin(pathfinder);

    // Force a timeout if the bot takes more than 45 seconds to spawn
    connectionTimeout = setTimeout(() => {
      if (isConnecting) {
        console.log(`${tag} ❌ Connection timed out. Forcing retry...`);
        bot.end(); 
      }
    }, 45000);

    bot.once('spawn', async () => {
      isConnecting = false;
      clearTimeout(connectionTimeout); 
      console.log(`${tag} ✅ spawned and joined the game.`);
      
      await delay(3000, 4000); // Wait for chunks to load

      console.log(`${tag} Attempting /login...`);
      bot.chat(`/login ${BOT_PASSWORD}`);

      const mcData = mcDataLoader(bot.version);
      
      // Action Loop
      while (bot.entity) {
        await doHumanAction(bot, mcData);
        // Wait 5 to 12 seconds between actions so it looks natural
        await delay(5000, 12000); 
      }
    });

    // Auto-register if the server asks
    bot.on('message', (jsonMsg) => {
      const text = jsonMsg.toString();
      if (/register/i.test(text)) {
        console.log(`[Server Chat - ${config.username}] Registering...`);
        bot.chat(`/register ${BOT_PASSWORD} ${BOT_PASSWORD}`);
      }
    });

    bot.on('error', (err) => {
      if (!err.message.includes('ECONNRESET')) {
        console.log(`${tag} Error:`, err.message);
      }
    });

    // Handle Kicks
    bot.on('kicked', (reason) => {
      isKicked = true;
      const reasonStr = JSON.stringify(reason);
      isConnecting = true; 
      clearTimeout(connectionTimeout);
      bot.removeAllListeners(); 
      
      if (reasonStr.includes('already playing') || reasonStr.includes('already connected')) {
        console.log(`${tag} ⚠️ Kicked: Ghost session detected. Waiting 5 minutes...`);
        setTimeout(() => { isConnecting = false; run(); }, 300000); 
      } else {
        console.log(`${tag} ❌ Kicked: ${reasonStr}. Reconnecting in 30s...`);
        setTimeout(() => { isConnecting = false; run(); }, 30000);
      }
    });

    // Handle Disconnects / Crashes
    bot.on('end', () => {
      clearTimeout(connectionTimeout);
      bot.removeAllListeners(); 
      
      // Only reconnect if we weren't explicitly kicked (to avoid double-triggering)
      if (!isKicked && !isConnecting) {
        isConnecting = true;
        console.log(`${tag} Disconnected unexpectedly. Reconnecting in 30s...`);
        setTimeout(() => { isConnecting = false; run(); }, 30000);
      }
    });
  };

  run(); 
}

// ================= START ALL BOTS =================
console.log(`Starting ${SERVERS.length} independent bots...`);
SERVERS.forEach((server, index) => {
  // Stagger the connections so they don't login at the exact same millisecond
  setTimeout(() => startBot(server), index * 5000);
});
