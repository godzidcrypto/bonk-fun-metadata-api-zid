import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { metadataEnv } from './env.js';
import jwtRouter from './routes/jwt';
import userRouter from './routes/user';
import commentRouter from './routes/comment';
import type { WalletContext } from './types';
import uploadRouter from './routes/upload';
import contestRouter from './routes/contest';
import jobsRouter from './routes/jobs';

const SOL_PRICE_INTERVAL_MINS = 1;

// Solana Price
type BirdeyePrice = {
    "data": {
        "value": number,
        "updateUnixTime": number,
        "updateHumanTime": string,
        "priceChange24h": number,
        "priceInNative": number
    },
    "success": boolean
}

let solPrice = 0;

await fetchSolPrice();
setInterval(async () => {
    await fetchSolPrice();
}, 1000 * 60 * SOL_PRICE_INTERVAL_MINS)

async function fetchSolPrice() {
    const options = {
        method: 'GET',
        headers: {
            accept: 'application/json',
            'x-chain': 'solana',
            'X-API-KEY': metadataEnv.BIRDEYE_API_KEY
        }
    };

    try {
        const res = await fetch('https://public-api.birdeye.so/defi/price?address=So11111111111111111111111111111111111111112', options);
        const resJson = await res.json() as BirdeyePrice;
        solPrice = resJson.data.value;
        console.log("New Solana price", solPrice);
    } catch(e) {
        console.error("Failed to fetch Solana price");
        console.error(e);
    }
}

// App
const app = new Hono<WalletContext>();

app.use(cors());

app.get('/', c => {
    return c.text("Letsbonk.fun Service Online");
})

app.get('/price/sol', async (c) => {
    return c.text(solPrice.toString());
})

app.get('/address', async (c) => {
    try {
        const res = await fetch('https://buffer-queue.letsbonk22.workers.dev/queue/bonk/pop');
        const resJson = await res.json() as { item: string };
        return c.text(resJson.item);
    } catch(e) {
        console.error("Failed to fetch new BONK token address");
        console.error(e);
        return c.text("Failed to fetch, please try again later.", 500);
    }
})

app.route('/upload', uploadRouter)

app.route("/jwt", jwtRouter);

app.route("/user", userRouter);

app.route("/comment", commentRouter);

app.route('/contest', contestRouter);

app.route('/jobs', jobsRouter);

export default {
    port: process.env.PORT,
    fetch: app.fetch,
} 