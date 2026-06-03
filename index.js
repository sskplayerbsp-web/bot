const bedrock = require('bedrock-protocol')

const client = bedrock.createClient({
  host: 'play.minefort.com',   // Connect directly to the main network
  port: 19132,                  // Default Bedrock port for Minefort
  username: 'shravan.sktn20@gmail.com', // Your official Bedrock Microsoft login
  offline: false                // Forces official Microsoft verification to bypass CAPTCHAs
})

client.on('spawn', () => {
  console.log('Bedrock bot spawned successfully in the lobby without CAPTCHA!')
  
  // Wait 5 seconds for the lobby loading screens to clear, then join your server
  setTimeout(() => {
    // Bedrock accounts send chat text packets differently than Java bots
    client.queue('text', {
      type: 'chat',
      needs_translation: false,
      source_name: client.username,
      xuid: '',
      platform_chat_id: '',
      message: '/join sleepyempire' // Replace with your server name
    })
    console.log('Sent server wake-up command.')
  }, 5000)
})

// Auto Reconnect if kicked
client.on('close', () => {
  console.log('Disconnected. Reconnecting in 30 seconds...')
  setTimeout(() => { process.exit(1) }, 30000) // Your host container will auto-restart the script
})
