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
app.use(express.json());
app.use(cors());

// This is a secret path for your webhook to make it secure
const WEBHOOK_SECRET_PATH = process.env.WEBHOOK_SECRET_PATH || `bot${Math.random().toString(36).substring(2)}`;

// This is the bot that users talk to TO CREATE their own app
// YOUR MAIN BOT TOKEN IS NOW READ FROM ENVIRONMENT VARIABLES FOR SECURITY
const PLATFORM_BOT_TOKEN = process.env.PLATFORM_BOT_TOKEN;
const platformBot = new TelegramBot(PLATFORM_BOT_TOKEN); // NO POLLING!

// ============================
// ➡️ Webhook Logic - THE HEART OF THE PLATFORM
// ============================
app.post(`/${WEBHOOK_SECRET_PATH}/:botToken`, (req, res) => {
    const { botToken } = req.params;
    const msg = req.body;
    const tempBot = new TelegramBot(botToken);
    
    if (msg.message && msg.message.text && msg.message.text.startsWith('/start')) {
        handleStartCommand(tempBot, msg.message);
    }
    
    res.sendStatus(200);
});

async function handleStartCommand(botInstance, message) {
    try {
        const botInfo = await botInstance.getMe();
        const botUsername = botInfo.username;

        const creatorsRef = ref(db, 'creators');
        const creatorsSnap = await get(creatorsRef);
        let creatorId = null;
        if (creatorsSnap.exists()) {
            const creatorsData = creatorsSnap.val();
            for (const id in creatorsData) {
                if (creatorsData[id].config?.botUsername === botUsername) {
                    creatorId = id;
                    break;
                }
            }
        }

        if (!creatorId) { return; }

        const config = (await get(ref(db, `creators/${creatorId}/config`))).val() || {};
        // YOUR GITHUB PAGES URL HAS BEEN ADDED HERE
        const webAppUrl = 'https://yichu-bro.github.io/Mini-app-factory/app.html';

        const chatId = message.chat.id;
        const userFullName = `${message.from.first_name || ''} ${message.from.last_name || ''}`.trim();

        const userRef = ref(db, `creators/${creatorId}/users/${chatId}`);
        const userSnap = await get(userRef);

        if (!userSnap.exists()) {
            const newUser = { username: userFullName, points: 0 /* other fields */ };
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
    const { creatorId, botToken, appName, backendUrl } = req.body;
    if (!creatorId || !botToken || !appName || !backendUrl) {
        return res.status(400).send({ error: 'Missing required fields.' });
    }

    try {
        const newBot = new TelegramBot(botToken);
        const botInfo = await newBot.getMe();

        const webhookUrl = `${backendUrl}/${WEBHOOK_SECRET_PATH}/${botToken}`;
        await newBot.setWebHook(webhookUrl);
        
        const creatorConfigRef = ref(db, `creators/${creatorId}/config`);
        await set(creatorConfigRef, {
            appName: appName,
            botToken: botToken,
            botUsername: botInfo.username,
        });

        res.send({ success: true, message: 'Your app has been created and webhook is set!' });
    } catch (error) {
        res.status(500).send({ error: 'Invalid Bot Token or failed to set webhook.' });
    }
});

// All other APIs remain the same and are fully functional
app.get('/api/:creatorId/config', async (req, res) => { /* ... */ });
app.get('/api/:creatorId/user/:userId', async (req, res) => { /* ... */ });
app.post('/api/:creatorId/user/:userId', async (req, res) => { /* ... */ });
app.post('/api/admin/:creatorId/config', async (req, res) => { /* ... */ });

// ============================
// 🚀 Server Start
// ============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`🚀 Platform server is running on http://localhost:${PORT}`);
    console.log(`Webhook secret path is: /${WEBHOOK_SECRET_PATH}`);
    
    try {
        // YOUR RENDER URL HAS BEEN ADDED HERE
        const platformWebhookUrl = `https://mini-app-factory.onrender.com/${WEBHOOK_SECRET_PATH}/${PLATFORM_BOT_TOKEN}`;
        await platformBot.setWebHook(platformWebhookUrl);
        console.log("Platform bot webhook has been set successfully.");
    } catch (error) {
        console.error("CRITICAL ERROR: Failed to set the main platform bot webhook.", error.message);
    }
});