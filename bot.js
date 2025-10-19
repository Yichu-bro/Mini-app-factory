import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update } from 'firebase/database';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// ============================
// 🔥 Firebase & Server Setup
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

const app = express();
app.use(express.json());
app.use(cors());

// --- NEW: Code to serve your HTML files ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));
// --- END NEW ---

const PLATFORM_BOT_TOKEN = process.env.PLATFORM_BOT_TOKEN;
if (!PLATFORM_BOT_TOKEN) {
    console.error("CRITICAL ERROR: PLATFORM_BOT_TOKEN is not set!");
    process.exit(1);
}
const platformBot = new TelegramBot(PLATFORM_BOT_TOKEN);
const WEBHOOK_SECRET_PATH = `bot${PLATFORM_BOT_TOKEN.substring(0, 8)}`;
const RENDER_URL = `https://mini-app-factory.onrender.com`; // Your Render URL

// ============================
// ➡️ Webhook Logic
// ============================
app.post(`/${WEBHOOK_SECRET_PATH}/:botToken`, (req, res) => {
    const { botToken } = req.params;
    if (botToken === PLATFORM_BOT_TOKEN) {
        platformBot.processUpdate(req.body);
    } else {
        handleCreatorBotUpdate(botToken, req.body);
    }
    res.sendStatus(200);
});

platformBot.onText(/\/start/, (msg) => {
    // UPDATED: URL now points to the server itself
    const creatorWebAppUrl = `${RENDER_URL}/creator.html`;
    platformBot.sendMessage(msg.chat.id, "Welcome! This bot helps you create your own Mini App. Open the creator app to get started.", {
        reply_markup: {
            inline_keyboard: [[{ 
                text: '🚀 Create Your App', 
                web_app: { url: `${creatorWebAppUrl}?creatorId=${msg.chat.id}` } 
            }]]
        }
    });
});

async function handleCreatorBotUpdate(botToken, update) {
    if (update.message?.text?.startsWith('/start')) {
        const tempBot = new TelegramBot(botToken);
        await handleStartCommand(tempBot, botToken, update.message);
    }
}

async function handleStartCommand(botInstance, botToken, message) {
    try {
        const creatorsRef = ref(db, 'creators');
        const creatorsSnap = await get(creatorsRef);
        let creatorId = null;
        if (creatorsSnap.exists()) {
            for (const id in creatorsSnap.val()) {
                if (creatorsSnap.val()[id].config?.botToken === botToken) {
                    creatorId = id; break;
                }
            }
        }
        if (!creatorId) return;

        const config = (await get(ref(db, `creators/${creatorId}/config`))).val() || {};
        // UPDATED: URL now points to the server itself
        const webAppUrl = config.webAppUrl || `${RENDER_URL}/app.html`;
        const chatId = message.chat.id;
        const userFullName = `${message.from.first_name || ''} ${message.from.last_name || ''}`.trim();

        const finalUrl = new URL(webAppUrl);
        finalUrl.searchParams.set('creatorId', creatorId);
        finalUrl.searchParams.set('userId', chatId);

        const userRef = ref(db, `creators/${creatorId}/users/${chatId}`);
        const userSnap = await get(userRef);
        if (!userSnap.exists()) {
            await set(userRef, { username: userFullName, points: 0 });
        }

        await botInstance.sendPhoto(chatId, 'https://i.ibb.co/VvzSgp3/Tag2-Cash-1.png', {
            caption: `<b>Welcome to ${config.appName || 'the app'}, ${userFullName}!</b>`,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[{ 
                    text: '🚀 Launch App', 
                    web_app: { url: finalUrl.toString() }
                }]]
            }
        });
    } catch (error) {
        console.error("Error in handleStartCommand:", error.response?.body || error.message);
    }
}

// ============================
// 📡 API Endpoints for Frontend
// ============================
app.post('/api/create-app', async (req, res) => {
    const { creatorId, botToken, appName } = req.body;
    if (!creatorId || !botToken || !appName) {
        return res.status(400).send({ error: 'Missing required fields.' });
    }
    try {
        const newBot = new TelegramBot(botToken);
        const botInfo = await newBot.getMe();
        const webhookUrl = `${RENDER_URL}/${WEBHOOK_SECRET_PATH}/${botToken}`;
        const isWebhookSet = await newBot.setWebHook(webhookUrl, { allowed_updates: ["message"] });
        if (!isWebhookSet) throw new Error("Telegram API rejected the webhook setup.");
        
        const creatorConfigRef = ref(db, `creators/${creatorId}/config`);
        await set(creatorConfigRef, {
            appName: appName,
            botToken: botToken,
            botUsername: botInfo.username,
        });
        res.send({ success: true, message: 'Your app has been created and webhook is set!' });
    } catch (error) {
        console.error("CREATE APP ERROR:", error.message);
        res.status(500).send({ error: 'Invalid Bot Token or failed to set webhook.' });
    }
});

// All other APIs are unchanged and will work correctly.

// ============================
// 🚀 Server Start
// ============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`🚀 Platform server is running on port ${PORT}`);
    console.log(`Webhook secret path is: /${WEBHOOK_SECRET_PATH}`);
    try {
        const platformWebhookUrl = `${RENDER_URL}/${WEBHOOK_SECRET_PATH}/${PLATFORM_BOT_TOKEN}`;
        await platformBot.setWebHook(platformWebhookUrl);
        console.log("Platform bot webhook has been set successfully.");
    } catch (error) {
        console.error("CRITICAL ERROR: Failed to set the main platform bot webhook.", error.message);
    }
});