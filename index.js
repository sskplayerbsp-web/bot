console.log("🚀 STARTING HUMAN BOTS (Version 26.1)...");

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

// 🛑 EXACT VERSION 26.1 AS REQUESTED
const MINECRAFT_VERSION = '26.1'; 

const SERVERS = [
  { host: 'sleepyempire.levyathan.ch', port: 25565, username: 'SkyBot_1' },
  { host: 'sleepy.levyathan.ch',       port: 25565, username: 'SkyBot_2' } 
];

const CHAT_MESSAGES = [
  "gg", "lol", "where is everyone?", "just got here", 
  "anyone wanna build?", "im bored", "hi", "bruh moment", 
  "this server is cool", "whats up"
];
// ==========================================

const delay = (min = 1000, max = 4000) => new Promise(r => setTimeout(r, Math.random() * (max - min) + min));

async function doHumanAction(bot, mcData) {
  if (!bot.entity || !bot.entity.position) return;

  const action = Math.floor(Math.random() * 8); 
  try {
    switch (action) {
      case 0: 
        // Look around smoothly
        const yaw = bot.entity.yaw + (Math.random() - 0.5) * 2;
        const pitch = (Math.random() - 0.5) * 1.5;
        await bot.look(yaw, pitch, false);
        break;
      case 1: 
        // Walk to a nearby spot
        if (mcData) {
          const movements = new Movements(bot, mcData);
          movements.canDig = false; 
          bot.pathfinder.setMovements(movements);
          const pos = bot.entity.position;
          const randomX = pos.x + (Math.random() - 0.5) * 15;
          const randomZ = pos.z + (Math.random() - 0.5) * 15;
          const goal = new goals.GoalNear(randomX, pos.y, randomZ, 2);
          await Promise.race([ bot.pathfinder.goto(goal), delay(4000, 5000) ]);
        }
        break;
      case 2: 
        // Jump
        bot.setControlState('jump', true);
        await delay(200, 400);
        bot.setControlState('jump', false);
        break;
      case 3: 
        // Swing arm
        bot.swingArm('right');
        break;
      case 4: 
        // Sneak
        bot.setControlState('sneak', true);
        await delay(500, 1500);
        bot.setControlState('sneak', false);
        break;
      case 5: 
        // Switch hotbar
        bot.setQuickBarSlot(Math.floor(Math.random() * 9));
        break;
      case 6: 
        // Stand still and look
        await delay(1000, 3000);
        break;
      case 7: 
        // Chat only if someone else is online
        const playerCount = Object.keys(bot.players).length;
        if (playerCount > 1 && Math.random() < 0.3) { 
          const msg = CHAT_MESSAGES[Math.floor(Math.random() * CHAT_MESSAGES.length)];
          bot.chat(msg);
          console.log(`[${bot.username}] Sent chat (${playerCount} players online): ${msg}`);
        }
        break;
    }
  } catch (e) {}
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
        version: MINECRAFT_VERSION // 🛑 Using 26.1
      });
    } catch (err) {
      console.log(`❌ ${tag} Failed to create bot instance (Possibly wrong version?):`, err.message);
      isConnecting = false;
      setTimeout(run, 30000);
      return;
    }

    bot.loadPlugin(pathfinder);

    connectionTimeout = setTimeout(() => {
      if (isConnecting) {
        console.log(`❌ ${tag} Connection timed out after 45s. Forcing retry...`);
        bot.end(); 
      }
    }, 45000);

    bot.once('spawn', async () => {
      isConnecting = false;
      clearTimeout(connectionTimeout); 
      console.log(`✅ ${tag} spawned and joined the game.`);
      
      await delay(3000, 4000); 

      console.log(`🔑 ${tag} Attempting /login...`);
      bot.chat(`/login ${BOT_PASSWORD}`);

      let mcData;
      try {
        mcData = mcDataLoader(bot.version);
      } catch (e) {
        console.log(`⚠️ Could not load pathfinding data for version ${bot.version}. Basic actions only.`);
        mcData = null;
      }
      
      while (bot.entity) {
        await doHumanAction(bot, mcData);
        await delay(5000, 12000); 
      }
    });

    bot.on('message', (jsonMsg) => {
      const text = jsonMsg.toString();
      if (/register/i.test(text)) {
        console.log(`📝 ${tag} Registering...`);
        bot.chat(`/register ${BOT_PASSWORD} ${BOT_PASSWORD}`);
      }
    });

    bot.on('error', (err) => {
      if (!err.message.includes('ECONNRESET') && !err.message.includes('ETIMEDOUT')) {
        console.log(`⚠️ ${tag} Error:`, err.message);
      }
    });

    bot.on('kicked', (reason) => {
      isKicked = true;
      const reasonStr = JSON.stringify(reason);
      isConnecting = true; 
      clearTimeout(connectionTimeout);
      bot.removeAllListeners(); 
      
      if (reasonStr.includes('already playing') || reasonStr.includes('already connected')) {
        console.log(`⚠️ ${tag} Kicked: Ghost session detected. Waiting 5 minutes...`);
        setTimeout(() => { isConnecting = false; run(); }, 300000); 
      } else {
        console.log(`❌ ${tag} Kicked: ${reasonStr}. Reconnecting in 30s...`);
        setTimeout(() => { isConnecting = false; run(); }, 30000);
      }
    });

    bot.on('end', () => {
      clearTimeout(connectionTimeout);
      bot.removeAllListeners(); 
      
      if (!isKicked && !isConnecting) {
        isConnecting = true;
        console.log(`🔌 ${tag} Disconnected. Reconnecting in 30s...`);
        setTimeout(() => { isConnecting = false; run(); }, 30000);
      }
    });
  };

  run(); 
}

// ================= START ALL BOTS =================
console.log(`Starting ${SERVERS.length} independent bots...`);
SERVERS.forEach((server, index) => {
  setTimeout(() => startBot(server), index * 5000);
});
