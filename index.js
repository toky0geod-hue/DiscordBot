require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const OpenAI = require('openai');
require('./server');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const TARGET_CHANNEL = process.env.CHANNEL_ID;
const userMemory = new Map();

// Store active users who have used !12on
const activeUsers = new Set();

client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`📡 Monitoring channel: ${TARGET_CHANNEL}`);
});

client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    if (msg.channelId !== TARGET_CHANNEL) return;

    try {
        // Check for !12on command (only exact match)
        if (msg.content === '!12on') {
            activeUsers.add(msg.author.id);
            await msg.reply('✅');
            return;
        }

        // Check if user is active
        if (!activeUsers.has(msg.author.id)) {
            return; // Silently ignore - no hint given
        }

        await msg.channel.sendTyping();

        // Commands (only work when active)
        if (msg.content === '!ping') {
            return msg.reply(`🏓 Pong! ${client.ws.ping}ms`);
        }
        if (msg.content === '!clear') {
            userMemory.delete(msg.author.id);
            return msg.reply('🧹 Memory cleared!');
        }
        if (msg.content === '!help') {
            return msg.reply('📱 **Commands:**\n`!ping` - Check bot\n`!clear` - Reset chat\n`!status` - Bot info');
        }
        if (msg.content === '!status') {
            return msg.reply(`🤖 Online | ${userMemory.size} active users | ${Math.floor(process.uptime()/60)}m uptime`);
        }

        // AI Response (only when active)
        if (!userMemory.has(msg.author.id)) {
            userMemory.set(msg.author.id, []);
        }
        const history = userMemory.get(msg.author.id);
        
        history.push({ role: 'user', content: msg.content });
        if (history.length > 10) history.splice(0, 2);

        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: 'You are a helpful Discord assistant. Keep responses short and clear.' },
                ...history
            ],
            max_tokens: 300,
            temperature: 0.7
        });

        const reply = response.choices[0].message.content;
        history.push({ role: 'assistant', content: reply });

        if (reply.length > 2000) {
            await msg.reply(reply.slice(0, 2000));
        } else {
            await msg.reply(reply);
        }

    } catch (error) {
        console.error('Error:', error.message);
        // Silently fail - no error message
    }
});

client.login(process.env.DISCORD_TOKEN);