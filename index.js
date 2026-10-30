const mineflayer = require('mineflayer');
const http = require('http');

// ================= CONFIG =================
const SERVER_HOST = 'sleepyempire.levyathan.ch';
const SERVER_PORT = 19313; // Make sure this is the Java port, not the Bedrock port!
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
async function doAFKAction(bot) {
  const action = Math.floor(Math.random() * 5);
  try {
    switch (action) {
      case 0: // Look around
        console.log('[AFK] Looking around');
        await bot.look((Math.random() - 0.5) * 2 * Math.PI, (Math.random() - 0.5) * Math.PI / 3, false);
        break;
      case 1: // Jump
        console.log('[AFK] Jumping');
        bot.setControlState('jump', true);
        await delay(200, 400);
        bot.setControlState('jump', false);
        break;
      case 2: // Swing arm (left click)
        console.log('[AFK] Swinging arm');
        bot.swingArm();
        break;
      case 3: // Walk forward slightly
        console.log('[AFK] Walking forward');
        bot.setControlState('forward', true);
        await delay(500, 1500);
        bot.setControlState('forward', false);
        break;
      case 4: // Crouch (sneak)
        console.log('[AFK] Sneaking');
        bot.setControlState('sneak', true);
        await delay(1000, 2000);
        bot.setControlState('sneak', false);
        break;
    }
  } catch (e) {
    // Ignore errors if the bot is loading the world
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
    version: false // Auto-detects server version
  });

  bot.once('spawn', async () => {
    console.log(`${tag} ✅ spawned and joined the game.`);
    
    // Wait 3 seconds for the world to load
    await delay(3000, 4000);

    // Try to login if the server uses a login plugin
    console.log(`[${BOT_USERNAME}] Attempting /login...`);
    bot.chat(`/login ${BOT_PASSWORD}`);
    
    // Start infinite AFK loop
    console.log(`[${BOT_USERNAME}] Starting AFK Loop...`);
    while (bot.entity) {
      await doAFKAction(bot);
      await delay(5000, 12000); // Wait 5 to 12 seconds between actions
    }
  });

  bot.on('message', (jsonMsg) => {
    const text = jsonMsg.toString();
    // Print important server messages to the console
    if (/login|register|welcome|kick|error/i.test(text)) {
      console.log(`[Chat] ${text}`);
    }
  });

  bot.on('error', (err) => console.log(`${tag} Error:`, err.message));
  bot.on('kicked', (reason) => console.log(`${tag} Kicked:`, reason));
  
  bot.on('end', () => {
    console.log(`${tag} Disconnected. Reconnecting in 15 seconds...`);
    setTimeout(runBot, 15000);
  });
}

// ================= START =================
runBot();
