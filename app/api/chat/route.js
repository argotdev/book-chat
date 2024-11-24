// app/api/chat/route.js
import { StreamChat } from 'stream-chat';
import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const streamClient = StreamChat.getInstance(
  process.env.NEXT_PUBLIC_STREAM_API_KEY,
  process.env.STREAM_API_SECRET
);

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// Get the index name from environment variables
const indexName = process.env.PINECONE_INDEX;

if (!indexName) {
  throw new Error('PINECONE_INDEX environment variable is not set');
}

// Create the index reference
const index = pinecone.Index(indexName);

export async function POST(req) {
  try {
    const { message, userId, channelId, conversationHistory } = await req.json();
    
    // Get embeddings for the user's message
    const embedding = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: message,
    });

    // Query Pinecone using the pre-initialized index
    const queryResponse = await index.query({
      vector: embedding.data[0].embedding,
      topK: 3,
      includeMetadata: true
    });

    // Construct context from relevant passages
    const context = queryResponse.matches
      .map(match => match.metadata?.text)
      .join('\n');

    // Generate response using OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that answers questions about a book. Use the provided context to answer questions accurately. If you're unsure, say so."
        },
        ...conversationHistory,
        {
          role: "user",
          content: `Context: ${context}\n\nQuestion: ${message}`
        }
      ]
    });

    const aiResponse = completion.choices[0].message.content;

    // Send message to Stream Chat channel
    const channel = streamClient.channel('messaging', channelId);
    await channel.sendMessage({
      text: aiResponse,
      user_id: 'ai_assistant'
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        response: aiResponse 
      }), 
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to process message'
      }), 
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}