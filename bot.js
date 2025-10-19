import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update } from 'firebase/database';
import cors from 'cors';

// ============================
// 🔥 Firebase Configuration
// ============================
const firebaseConfig = {
    apiKey: "AIzaSyD8-E3hJLweH60kcAHLhg8kcbEWkADejVg",
    authDomain: "besh-c0cde.firebaseapp.com",
    databaseURL: "https://besh-c0cde-default-rtdb.firebaseio.com",
    projectId: "besh-c0cde",
    storageBucket: "besh-c0cde.firebasestorage.app",
    messagingSenderId: "387004383369",
    appId: "1:387004383369:web:22fa62fcb4e5b787f58658"
};

const appFB = initializeApp(firebaseConfig);
const db = getDatabase(appFB);

// ============================
// 🤖 Server Setup
// ============================
const app = express();
app.use(express.json()); // Use express's built-in parser
app.use(cors());

// This is the bot that users talk to TO CREATE their own app.
// We get the token from environment variables for security.
const PLATFORM_BOT_TOKEN = process.env.PLATFORM_BOT_TOKEN;
if (!PLATFORM_BOT_TOKEN) {
    console.error("CRITICAL ERROR: PLATFORM_BOT_TOKEN is not set in environment variables!");
    process.exit(1);
}
// This instance has the specific logic for creating apps. NO POLLING.
const platformBot = new TelegramBot(PLATFORM_BOT_TOKEN);

// This is a secret path for your webhook to make it secure
const WEBHOOK_SECRET_PATH = `bot${PLATFORM_BOT_TOKEN.substring(0, 8)}`;

// ============================
// ➡️ Webhook Logic - THE HEART OF THE PLATFORM
// ============================

// This single endpoint receives updates for ALL bots created on the platform
app.post(`/${WEBHOOK_SECRET_PATH}/:botToken`, (req, res) => {
    const { botToken } = req.params;
    const update = req.body;

    // Route the update to the correct logic
    if (botToken === PLATFORM_BOT_TOKEN) {
        // If the update is for our MAIN platform bot, process it here
        platformBot.processUpdate(update);
    } else {
        // If the update is for a CREATED bot, handle it dynamically
        handleCreatorBotUpdate(botToken, update);
    }
    
    // Always respond to Telegram immediately to acknowledge receipt
    res.sendStatus(200);
});

// This is the logic for YOUR MAIN bot that creates apps
platformBot.onText(/\/start/, (msg) => {
    const creatorWebAppUrl = `https://yichu-bro.github.io/Mini-app-factory/creator.html`;
    platformBot.sendMessage(msg.chat.id, "Welcome! This bot helps you create your own Besh Besh style Mini App. Please open the creator app to get started.", {
        reply_markup: {
            inline_keyboard: [[{ 
                text: '🚀 Create Your App', 
                web_app: { url: `${creatorWebAppUrl}?creatorId=${msg.chat.id}` } 
            }]]
        }
    });
});

// This is the logic that runs when ANY of the created bots receive a message
async function handleCreatorBotUpdate(botToken, update) {
    if (update.message?.text?.startsWith('/start')) {
        const tempBot = new TelegramBot(botToken);
        await handleStartCommand(tempBot, update.message);
    }
}

async function handleStartCommand(botInstance, message) {
    try {
        const botInfo = await botInstance.getMe();
        const botUsername = botInfo.username;

        const creatorsRef = ref(db, 'creators');
        const creatorsSnap = await get(creatorsRef);
        let creatorId = null;
        if (creatorsSnap.exists()) {
            for (const id in creatorsSnap.val()) {
                if (creatorsSnap.val()[id].config?.botUsername === botUsername) {
                    creatorId = id;
                    break;
                }
            }
        }
        if (!creatorId) return;

        const config = (await get(ref(db, `creators/${creatorId}/config`))).val() || {};
        const webAppUrl = config.webAppUrl || 'https://yichu-bro.github.io/Mini-app-factory/app.html';
        const chatId = message.chat.id;
        const userFullName = `${message.from.first_name || ''} ${message.from.last_name || ''}`.trim();

        const userRef = ref(db, `creators/${creatorId}/users/${chatId}`);
        const userSnap = await get(userRef);

        if (!userSnap.exists()) {
            const newUser = { username: userFullName, points: 0 /* other default fields */ };
            await set(userRef, newUser);
        }

        botInstance.sendPhoto(chatId, 'https://i.ibb.co/VvzSgp3/Tag2-Cash-1.png', {
            caption: `<b>Welcome to ${config.appName || 'the app'}, ${userFullName}!</b>`,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[{ 
                    text: '🚀 Launch App', 
                    web_app: { url: `${webAppUrl}?creatorId=${creatorId}&userId=${chatId}` } 
                }]]
            }
        });
    } catch (error) {
        console.error("Error in handleStartCommand:", error.message);
    }
}

// ============================
// 📡 API Endpoints for Frontend
// ============================

app.post('/api/create-app', async (req, res) => {
    const { creatorId, botToken, appName } = req.body;
    const backendUrl = "https://mini-app-factory.onrender.com"; // Your Render URL is hardcoded for safety

    if (!creatorId || !botToken || !appName) {
        return res.status(400).send({ error: 'Missing required fields.' });
    }

    try {
        const newBot = new TelegramBot(botToken);
        const botInfo = await newBot.getMe();

        const webhookUrl = `${backendUrl}/${WEBHOOK_SECRET_PATH}/${botToken}`;
        const isWebhookSet = await newBot.setWebHook(webhookUrl);
        if (!isWebhookSet) {
            throw new Error("Telegram failed to set the webhook. Check your bot token and server URL.");
        }
        
        const creatorConfigRef = ref(db, `creators/${creatorId}/config`);
        await set(creatorConfigRef, {
            appName: appName,
            botToken: botToken,
            botUsername: botInfo.username,
            // Add other default settings for a new app here
        });

        res.send({ success: true, message: 'Your app has been created and webhook is set!' });
    } catch (error) {
        console.error("CREATE APP ERROR:", error.message);
        res.status(500).send({ error: 'Invalid Bot Token or failed to set webhook.' });
    }
});

// All other APIs remain the same, as they are already multi-tenant and functional
// Example:
app.get('/api/:creatorId/config', async (req, res) => {
    const { creatorId } = req.params;
    const configRef = ref(db, `creators/${creatorId}/config`);
    const snap = await get(configRef);
    if (snap.exists()) { res.json(snap.val()); } 
    else { res.status(404).send({ error: "Configuration not found." }); }
});
// ... The rest of your APIs ...

// ============================
// 🚀 Server Start
// ============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`🚀 Platform server is running on http://localhost:${PORT}`);
    console.log(`Webhook secret path is: /${WEBHOOK_SECRET_PATH}`);
    
    try {
        const platformWebhookUrl = `https://mini-app-factory.onrender.com/${WEBHOOK_SECRET_PATH}/${PLATFORM_BOT_TOKEN}`;
        await platformBot.setWebHook(platformWebhookUrl);
        console.log("Platform bot webhook has been set successfully.");
    } catch (error) {
        console.error("CRITICAL ERROR: Failed to set the main platform bot webhook.", error.message);
    }
});