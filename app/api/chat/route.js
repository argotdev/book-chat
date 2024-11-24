// app/api/chat/route.js
import { StreamChat } from 'stream-chat';
import { OpenAI } from 'openai';
import { PDFEmbeddingSystem } from '@/lib/PDFEmbeddingSystem';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const streamClient = StreamChat.getInstance(
  process.env.NEXT_PUBLIC_STREAM_API_KEY,
  process.env.STREAM_API_SECRET
);

export async function POST(req) {
  try {
    const { message, userId, channelId, conversationHistory } = await req.json();
    
    // Get channel to retrieve PDF information
    const channel = streamClient.channel('messaging', channelId);
    const channelData = await channel.query();
    const pdfId = channelData.channel.pdfId;

    // Initialize embedding system
    const embedder = new PDFEmbeddingSystem(
      process.env.OPENAI_API_KEY,
      process.env.PINECONE_API_KEY,
      process.env.PINECONE_INDEX
    );

    // Query similar content
    const similarContent = await embedder.querySimilar(
      message,
      3,
      { pdfId } // Filter by this PDF's ID
    );

    // Construct context from relevant passages
    const context = similarContent
      .map(match => match.metadata.text)
      .join('\n');

    // Generate response using OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that answers questions about a document. Use the provided context to answer questions accurately. If you're unsure, say so."
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
        error: 'Failed to process message' 
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