console.log("====================================");
console.log("🚀 DEBUG BOT STARTING UP RIGHT NOW");
console.log("====================================");

const mineflayer = require('mineflayer');

const HOST = 'sleepyempire.levyathan.ch';
const PORT = 25565;
const USERNAME = 'SkyBot_99'; // Changed name to avoid ghost sessions
const PASSWORD = 'Streamersarenotcoolbeo'; 

console.log(`Attempting to connect to ${HOST}:${PORT} as ${USERNAME}...`);

const bot = mineflayer.createBot({
  host: HOST,
  port: PORT,
  username: USERNAME,
  auth: 'offline'
});

bot.on('login', () => {
  console.log("✅ Network login successful! (Server accepted the connection)");
});

bot.on('spawn', () => {
  console.log("✅ Bot has spawned in the world!");
  setTimeout(() => {
    console.log("Attempting to type /login...");
    bot.chat(`/login ${PASSWORD}`);
  }, 3000);
});

bot.on('message', (jsonMsg) => {
  console.log(`[CHAT] ${jsonMsg.toString()}`);
});

bot.on('error', (err) => {
  console.log("❌ ERROR:", err.message);
});

bot.on('kicked', (reason) => {
  console.log("❌ KICKED BY SERVER. Reason:", reason);
});

bot.on('end', () => {
  console.log("❌ Connection ended. (Disconnected)");
});
