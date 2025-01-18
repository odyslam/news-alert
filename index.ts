import { WebSocket } from 'ws';
import Anthropic from '@anthropic-ai/sdk';


const CLAUDE_API_KEY = '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';
const API_KEY = '00aa9db6c7dd16787177c0f0ea5552d8c7ad4b4e01f7c405e0b7e17e3a3e084d';


const anthropic = new Anthropic({
    apiKey: CLAUDE_API_KEY
});


interface Context {
    urls: { url: string; content: string }[];
    tweets: { id: string; content: string }[];
}

async function fetchUrl(url: string): Promise<string> {
    try {
        const response = await fetch(url);
        return await response.text();
    } catch (error) {
        console.error(`Failed to fetch URL ${url}:`, error);
        return '';
    }
}

/// TODO: Implement tweet fetching using Twitter's API
async function fetchTweet(tweetId: string): Promise<string> {
    // You'll need to implement tweet fetching using Twitter's API
    // This is a placeholder
    return `Tweet content for ${tweetId}`;
}

async function sendToClaude(context: Context, message: any) {
    try {
        // Check if we have any content to process
        if (context.urls.length === 0 && context.tweets.length === 0) {
            console.log('No URLs or tweets to analyze');
            return;
        }

        const urlsContent = context.urls.length > 0
            ? `URLs:\n${context.urls.map(u => `- ${u.url}:\n  ${u.content}`).join('\n')}`
            : 'No URLs provided';
            
        const tweetsContent = context.tweets.length > 0
            ? `Tweets:\n${context.tweets.map(t => `- ${t.id}:\n  ${t.content}`).join('\n')}`
            : 'No tweets provided';

        const prompt = `
Here is the context of URLs and tweets:

${urlsContent}

${tweetsContent}

Original message: ${JSON.stringify(message, null, 2)}

You are a senior financial analyst with 20 years of experience and 5 years of experience in crypto. Your job is to wake me up if a message is very important that will move the market in some big way that I should know about it. For example, Trump launching his meme coin during the crypto bull run was a big deal.

If the news is important and I should wake up, start answer with "WAKE UP". You should explain why the news is important so that I read it as soon as I wake up from your message. If the news is not important, just say "OK" and also explain why it is not important.`;

        console.log('Sending to Claude:\n', prompt);

        const response = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1024,
            messages: [{ 
                role: "user", 
                content: prompt 
            }],
        });

        console.log('Claude response:', response);
    } catch (error) {
        console.error('Failed to send to Claude:', error);
    }
}

async function processMessage(data: any) {
    const context: Context = {
        urls: [],
        tweets: []
    };

    // Fetch URLs if present
    if (data.urls && Array.isArray(data.urls)) {
        for (const urlObj of data.urls) {
            const content = await fetchUrl(urlObj.url);
            context.urls.push({ url: urlObj.url, content });
        }
    }

    // Fetch tweet if present
    if (data.info?.twitterId) {
        const tweetContent = await fetchTweet(data.info.twitterId);
        context.tweets.push({ id: data.info.twitterId, content: tweetContent });
    }

    // Send to Claude
    await sendToClaude(context, data);
}

async function connectWebSocket() {
    try {
        const webSocket = new WebSocket('wss://news.treeofalpha.com/ws');

        await new Promise((resolve, reject) => {
            webSocket.onopen = () => {
                console.log('🌟 Connected to Tree of Alpha');
                webSocket.send(`login ${API_KEY}`);
                resolve(true);
            };
            webSocket.onerror = (error) => reject(error);
        });

        webSocket.addEventListener('message', async (event) => {
            try {
                const data = JSON.parse(event.data.toString());
                console.log('📨 New message:', JSON.stringify(data, null, 2));
                await processMessage(data);
            } catch (e) {
                console.log('📨 New message (raw):', event.data);
            }
        });

        webSocket.addEventListener('close', () => {
            console.log('👋 WebSocket connection closed');
        });

        process.on('SIGINT', () => {
            console.log('\n🛑 Closing WebSocket connection...');
            webSocket.close();
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Start the connection
connectWebSocket();
