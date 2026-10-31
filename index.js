const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');

// ================= CONFIG =================
const SERVER_HOST = 'sleepyempire.levyathan.ch';
const SERVER_PORT = 25565; 
const BOT_USERNAME = 'VoidReaper'; 
const BOT_PASSWORD = 'Streamersarenotcoolbeo'; 
// ==========================================

const delay = (min = 1000, max = 4000) => new Promise(r => setTimeout(r, Math.random() * (max - min) + min));

// Global flag to prevent overlapping connection attempts
let isConnecting = false;
let connectionTimeout = null;

// ================= AFK BEHAVIOR =================
async function doHumanAction(bot, mcData) {
  if (!bot.entity || !bot.entity.position) return;

  const action = Math.floor(Math.random() * 6);
  try {
    switch (action) {
      case 0: // Smoothly look around
        const yaw = bot.entity.yaw + (Math.random() - 0.5) * 2;
        const pitch = (Math.random() - 0.5) * 1.5;
        await bot.look(yaw, pitch, false);
        break;
        
      case 1: // Walk to a random nearby spot safely
        const movements = new Movements(bot, mcData);
        movements.canDig = false; 
        bot.pathfinder.setMovements(movements);
        
        const currentPos = bot.entity.position;
        const randomX = currentPos.x + (Math.random() - 0.5) * 15;
        const randomZ = currentPos.z + (Math.random() - 0.5) * 15;
        
        const goal = new goals.GoalNear(randomX, currentPos.y, randomZ, 2);
        await Promise.race([
          bot.pathfinder.goto(goal),
          delay(4000, 5000)
        ]);
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
    }
  } catch (e) {}
}

// ================= BOT MAIN =================
function runBot() {
  if (isConnecting) return; 
  isConnecting = true;

  const tag = `[${BOT_USERNAME}]`;
  console.log(`\n${tag} Attempting to connect to ${SERVER_HOST}:${SERVER_PORT}...`);

  const bot = mineflayer.createBot({
    host: SERVER_HOST,
    port: SERVER_PORT,
    username: BOT_USERNAME,
    auth: 'offline',
    version: false 
  });

  bot.loadPlugin(pathfinder);

  // Force a timeout if the bot takes more than 45 seconds to join
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
    
    await delay(3000, 4000);

    console.log(`${tag} Attempting /login...`);
    bot.chat(`/login ${BOT_PASSWORD}`);

    const mcData = mcDataLoader(bot.version);
    
    while (bot.entity) {
      await doHumanAction(bot, mcData);
      await delay(6000, 12000); 
    }
  });

  bot.on('message', (jsonMsg) => {
    const text = jsonMsg.toString();
    if (/register/i.test(text)) {
      console.log(`[Server Chat] ${text}`);
      bot.chat(`/register ${BOT_PASSWORD} ${BOT_PASSWORD}`);
    }
  });

  bot.on('error', (err) => {
    if (!err.message.includes('ECONNRESET')) {
      console.log(`${tag} Error:`, err.message);
    }
  });

  bot.on('kicked', (reason) => {
    const reasonStr = JSON.stringify(reason);
    isConnecting = true; 
    clearTimeout(connectionTimeout);
    bot.removeAllListeners(); 
    
    if (reasonStr.includes('already playing') || reasonStr.includes('already connected')) {
      console.log(`${tag} ⚠️ Kicked: Server thinks we are still online. Waiting 60s...`);
      setTimeout(() => {
        isConnecting = false;
        runBot();
      }, 60000); 
    } else {
      console.log(`${tag} ❌ Kicked: ${reasonStr}. Reconnecting in 15s...`);
      setTimeout(() => {
        isConnecting = false;
        runBot();
      }, 15000);
    }
  });

  bot.on('end', () => {
    clearTimeout(connectionTimeout);
    bot.removeAllListeners(); 
    if (!isConnecting) {
      isConnecting = true;
      console.log(`${tag} Disconnected. Reconnecting in 15s...`);
      setTimeout(() => {
        isConnecting = false;
        runBot();
      }, 15000);
    }
  });
}

// ================= START =================
runBot();
