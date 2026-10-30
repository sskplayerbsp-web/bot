const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');
const http = require('http');

// ================= CONFIG =================
const SERVER_HOST = 'sleepyempire.levyathan.ch';
const SERVER_PORT = 19313; // Java port
const BOT_USERNAME = 'VoidReaper'; 
const BOT_PASSWORD = 'Streamersarenotcoolbeo'; // Change if needed
// ==========================================

// ================= HEALTH SERVER =================
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ok');
}).listen(PORT, () => console.log(`🌐 Health server on :${PORT}`));

const delay = (min = 1000, max = 4000) => new Promise(r => setTimeout(r, Math.random() * (max - min) + min));

// ================= AFK BEHAVIOR =================
async function doHumanAction(bot, mcData) {
  // Don't do anything if the bot is dead or not spawned
  if (!bot.entity) return;

  const action = Math.floor(Math.random() * 6);
  try {
    switch (action) {
      case 0: // Smoothly look around (like moving mouse)
        console.log('[Human] Looking around');
        const yaw = bot.entity.yaw + (Math.random() - 0.5) * 2;
        const pitch = (Math.random() - 0.5) * 1.5;
        await bot.look(yaw, pitch, false); // false = smooth movement
        break;

      case 1: // Walk to a random nearby spot safely
        console.log('[Human] Walking around');
        const movements = new Movements(bot, mcData);
        movements.canDig = false; // Don't destroy blocks
        bot.pathfinder.setMovements(movements);
        
        const currentPos = bot.entity.position;
        const randomX = currentPos.x + (Math.random() - 0.5) * 15;
        const randomZ = currentPos.z + (Math.random() - 0.5) * 15;
        
        // GoalNear(x, y, z, range)
        const goal = new goals.GoalNear(randomX, currentPos.y, randomZ, 2);
        await bot.pathfinder.goto(goal);
        break;

      case 2: // Jump
        console.log('[Human] Jumping');
        bot.setControlState('jump', true);
        await delay(200, 400);
        bot.setControlState('jump', false);
        break;

      case 3: // Swing arm (left/right click)
        console.log('[Human] Swinging arm');
        bot.swingArm('right');
        break;

      case 4: // Sneak (crouch)
        console.log('[Human] Sneaking');
        bot.setControlState('sneak', true);
        await delay(500, 1500);
        bot.setControlState('sneak', false);
        break;

      case 5: // Switch hotbar slot (like scrolling mouse wheel)
        console.log('[Human] Switching hotbar slot');
        const slot = Math.floor(Math.random() * 9);
        bot.setQuickBarSlot(slot);
        break;
    }
  } catch (e) {
    // Ignore pathfinding errors if it gets stuck
  }
}

// ================= BOT MAIN =================
function runBot() {
  const tag = `[${BOT_USERNAME}@${SERVER_HOST}]`;
  console.log(`${tag} connecting...`);

  const bot = mineflayer.createBot({
    host: SERVER_HOST,
    port: SERVER_PORT,
    username: BOT_USERNAME,
    auth: 'offline',
    version: false // Auto-detect version
  });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', async () => {
    console.log(`${tag} ✅ spawned and joined the game.`);
    
    // Wait 3 seconds for the world to load
    await delay(3000, 4000);

    // Attempt Login
    console.log(`[${BOT_USERNAME}] Attempting /login...`);
    bot.chat(`/login ${BOT_PASSWORD}`);

    const mcData = mcDataLoader(bot.version);
    
    // Start infinite loop
    console.log(`[${BOT_USERNAME}] Starting Human AFK Loop...`);
    while (bot.entity) {
      await doHumanAction(bot, mcData);
      // Wait 6 to 15 seconds between actions
      await delay(6000, 15000); 
    }
  });

  // Listen to chat to ensure login works or to auto-register if needed
  bot.on('message', (jsonMsg) => {
    const text = jsonMsg.toString();
    if (/login|register|password/i.test(text)) {
      console.log(`[Server Chat] ${text}`);
      // If it asks to register but we haven't, try registering
      if (/register/i.test(text)) {
        bot.chat(`/register ${BOT_PASSWORD} ${BOT_PASSWORD}`);
      }
    }
  });

  bot.on('error', (err) => console.log(`${tag} Error:`, err.message));
  
  bot.on('kicked', (reason) => {
    console.log(`[${BOT_USERNAME}] ❌ Kicked:`, reason);
  });
  
  // INFINITE RECONNECT LOGIC
  bot.on('end', () => {
    console.log(`[${BOT_USERNAME}] Disconnected. Reconnecting in 15 seconds...`);
    // Simply call runBot() again after 15 seconds. It will NEVER stop trying.
    setTimeout(runBot, 15000);
  });
}

// ================= START =================
runBot();
