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
// 🤖 Bot & Server Setup
// ============================
const app = express();
app.use(express.json());
app.use(cors());

const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || "123@Creator";
const botInstances = new Map(); // This will hold all the active bot instances

// --- Main Platform Bot (The one that creates other apps) ---
// This token is for YOUR main bot that users interact with to create their apps.
const PLATFORM_BOT_TOKEN = process.env.PLATFORM_BOT_TOKEN || '8468529543:AAHdUXA_Ap0fTdg85b2XWudEMPenSZn7qp8';
const platformBot = new TelegramBot(PLATFORM_BOT_TOKEN, { polling: true });

platformBot.onText(/\/start/, (msg) => {
    platformBot.sendMessage(msg.chat.id, "Welcome! This bot helps you create your own Besh Besh style Mini App. Please open the creator app to get started.", {
        reply_markup: {
            inline_keyboard: [[{ text: '🚀 Create Your App', web_app: { url: `https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO_NAME/creator.html?creatorId=${msg.chat.id}` } }]]
        }
    });
});

// ============================
// 📡 API Endpoints
// ============================

// --- API for the Creator App ---
app.post('/api/create-app', async (req, res) => {
    const { creatorId, botToken, appName } = req.body;
    if (!creatorId || !botToken || !appName) {
        return res.status(400).send({ error: 'Missing required fields.' });
    }

    try {
        // Check if the bot token is valid
        const newBot = new TelegramBot(botToken);
        const botInfo = await newBot.getMe();
        
        // Save the new app's configuration to Firebase, nested under the creator's ID
        const creatorConfigRef = ref(db, `creators/${creatorId}/config`);
        await set(creatorConfigRef, {
            appName: appName,
            botToken: botToken, // Note: In a real app, encrypt this!
            botUsername: botInfo.username,
            currencyName: 'Points',
            requiredReferrals: 15,
            requiredAds: 15,
            // Add other default settings here
        });

        res.send({ success: true, message: 'Your app has been created!' });
    } catch (error) {
        console.error("Failed to create bot instance:", error.message);
        res.status(500).send({ error: 'Invalid Bot Token or failed to connect to Telegram.' });
    }
});

// --- Multi-Tenant APIs for ALL Mini Apps ---
// Note the structure: /api/:creatorId/...

// Get the config for a specific app
app.get('/api/:creatorId/config', async (req, res) => {
    const { creatorId } = req.params;
    const configRef = ref(db, `creators/${creatorId}/config`);
    const snap = await get(configRef);
    if (snap.exists()) {
        res.json(snap.val());
    } else {
        res.status(404).send({ error: "Configuration for this app not found." });
    }
});

// Get a user's data from a specific app
app.get('/api/:creatorId/user/:userId', async (req, res) => {
    const { creatorId, userId } = req.params;
    const userRef = ref(db, `creators/${creatorId}/users/${userId}`);
    const snap = await get(userRef);
    if (snap.exists()) {
        res.json(snap.val());
    } else {
        res.status(404).send({ error: "User not found in this app. Please start the bot first." });
    }
});

// Save a user's data for a specific app
app.post('/api/:creatorId/user/:userId', async (req, res) => {
    const { creatorId, userId } = req.params;
    const userRef = ref(db, `creators/${creatorId}/users/${userId}`);
    await set(userRef, req.body);
    res.send({ success: true });
});

// Admin Panel APIs
app.post('/api/admin/:creatorId/config', async (req, res) => {
    // In a real app, you would add security here to ensure the user is the owner
    const { creatorId } = req.params;
    const { newConfig } = req.body;
    const configRef = ref(db, `creators/${creatorId}/config`);
    await set(configRef, newConfig);
    res.send({ success: true });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Platform server is running on http://localhost:${PORT}`));
