const bedrock = require('bedrock-protocol');
const { Authflow } = require('prismarine-auth');
const fetch = require('node-fetch');
const http = require('http');

// ================= CONFIG =================
const SERVER_HOST = 'sleepyempire.levyathan.ch';
const SERVER_PORT = 19313;
const BOT_EMAIL = 'shravav.sktn20@gmail.com'; // The Microsoft account for the bot

const CHECK_INTERVAL_MS = 30000; // Check for new friends every 30 seconds
const SESSION_MINUTES = 6000;
// ==========================================

// ================= HEALTH SERVER =================
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ok');
}).listen(PORT, () => console.log(`🌐 Health server on :${PORT}`));

const delay = (min = 1000, max = 4000) => new Promise(r => setTimeout(r, Math.random() * (max - min) + min));

// ================= FRIENDS & INVITE LOGIC =================
const knownFriendXuids = new Set();

async function getXboxToken(authflow, relyingParty) {
  // relyingParty: 'http://xboxlive.com' for peoplehub, 'https://multiplayer.minecraft.net/' for invites
  return await authflow.getXboxToken(relyingParty);
}

async function fetchFollowers(authflow) {
  try {
    const token = await getXboxToken(authflow, 'http://xboxlive.com');
    const res = await fetch('https://peoplehub.xboxlive.com/users/me/people/followers?maxItems=100', {
      headers: {
        'Authorization': `XBL3.0 x=${token.userHash};${token.XSTSToken}`,
        'x-xbl-contract-version': '2',
        'Accept': 'application/json'
      }
    });
    const data = await res.json();
    return data.people || []; // Returns array of { xuid, gamertag, ... }
  } catch (err) {
    console.error('❌ Failed to fetch followers:', err.message);
    return [];
  }
}

async function sendInvite(authflow, xuid, gamertag, host, port) {
  try {
    const token = await getXboxToken(authflow, 'https://multiplayer.minecraft.net/');
    console.log(`[Invite] Sending invite to ${gamertag} (XUID: ${xuid})...`);
    
    const res = await fetch(`https://multiplayer.minecraft.net/api/v1/users/${xuid}/invite`, {
      method: 'POST',
      headers: {
        'Authorization': `XBL3.0 x=${token.userHash};${token.XSTSToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        connectionString: `${host}:${port}`
      })
    });

    if (res.ok) {
      console.log(`✅ Successfully invited ${gamertag}!`);
    } else {
      const text = await res.text();
      console.log(`❌ Invite failed for ${gamertag}. Status: ${res.status} - ${text}`);
    }
  } catch (err) {
    console.error(`❌ Invite error for ${gamertag}:`, err.message);
  }
}

async function watchForNewFriends(authflow, serverHost, serverPort) {
  console.log('[Friends] Starting friend watcher loop...');
  
  // Initial population of the set so we don't invite existing friends on startup
  const initialFollowers = await fetchFollowers(authflow);
  initialFollowers.forEach(f => knownFriendXuids.add(f.xuid));
  console.log(`[Friends] Loaded ${knownFriendXuids.size} existing followers. Watching for new ones...`);

  while (true) {
    await delay(CHECK_INTERVAL_MS, CHECK_INTERVAL_MS + 5000);
    const currentFollowers = await fetchFollowers(authflow);

    for (const follower of currentFollowers) {
      if (!knownFriendXuids.has(follower.xuid)) {
        // New friend detected!
        console.log(`👋 New friend detected: ${follower.gamertag || follower.displayName} (${follower.xuid})`);
        knownFriendXuids.add(follower.xuid);
        await sendInvite(authflow, follower.xuid, follower.gamertag || follower.displayName, serverHost, serverPort);
      }
    }
  }
}

// ================= AFK BEHAVIOR =================
async function doAFKAction(client) {
  const action = Math.floor(Math.random() * 5);
  try {
    switch (action) {
      case 0: if (client.entity) console.log('[AFK] Looking around'); break;
      case 1: console.log('[AFK] Jumping'); break;
      case 2: console.log('[AFK] Swinging arm'); break;
      default: break;
    }
  } catch (e) {}
}

// ================= BOT MAIN =================
function runBedrockBot(email, host, port) {
  return new Promise(async (resolve) => {
    let client = null;
    let reconnectAttempts = 0;
    let isIntentionallyDisconnected = false;
    const authflow = new Authflow(email, './auth-cache', { flow: 'msal' });

    const startBot = async () => {
      const tag = `[${email}@${host}]`;
      console.log(`${tag} connecting (attempt ${reconnectAttempts + 1})...`);

      try {
        client = bedrock.createClient({
          host: host,
          port: port,
          username: email,
          offline: false,
          authflow: authflow
        });

        client.on('connect', () => {
          console.log(`${tag} connected to server.`);
          reconnectAttempts = 0;
        });

        client.on('join', async () => {
          console.log(`${tag} ✅ spawned and joined the game.`);
          
          // Start the friend watcher in the background
          if (!client.friendWatcherStarted) {
            client.friendWatcherStarted = true;
            watchForNewFriends(authflow, host, port).catch(err => console.error('Watcher error:', err));
          }

          // Start AFK loop
          const endTime = Date.now() + SESSION_MINUTES * 60 * 1000;
          while (Date.now() < endTime && client && !isIntentionallyDisconnected) {
            await doAFKAction(client);
            await delay(4000, 10000);
          }
          
          isIntentionallyDisconnected = true;
          if (client) client.disconnect('Session over');
        });

        client.on('error', (err) => console.error(`${tag} error:`, err.message));
        client.on('kick', (reason) => console.log(`${tag} kicked: ${reason}`));
        client.on('close', () => {
          console.log(`${tag} connection closed.`);
          if (reconnectAttempts < 10 && !isIntentionallyDisconnected) {
            reconnectAttempts++;
            const wait = Math.min(60000, 5000 * reconnectAttempts);
            setTimeout(startBot, wait);
          } else {
            resolve();
          }
        });

      } catch (error) {
        console.error(`${tag} failed:`, error.message);
        if (reconnectAttempts < 10) {
          reconnectAttempts++;
          setTimeout(startBot, 10000);
        } else {
          resolve();
        }
      }
    };

    startBot();
  });
}

// ================= START =================
(async () => {
  await runBedrockBot(BOT_EMAIL, SERVER_HOST, SERVER_PORT);
})();
