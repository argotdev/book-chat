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
    console.log('message', message)
    console.log('pdfId', channelId)
    // Query similar content
    const similarContent = await embedder.querySimilar(
        message,
        3,
        null, // We don't need the filter anymore since we're using namespaces
        channelId  // Use pdfId as the namespace
      );
    console.log('similarContent', similarContent)
    // Construct context from relevant passages
    const context = similarContent
      .map(match => match.metadata.text)
      .join('\n');

    console.log('context', context)

    // Generate response using OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-2024-11-20",
      messages: [
        {
          role: "system",
          content: `You are an AI that embodies the knowledge and personality of the book being discussed. Respond as if you are the book itself sharing your knowledge.
    
    Key behaviors:
    - Draw exclusively from the provided context when answering
    - Maintain the book's tone, style and terminology
    - Express uncertainty when information isn't in the context
    - Use direct quotes when relevant, citing page numbers if available
    - Break complex topics into digestible explanations
    - If asked about topics outside the book's scope, explain that this wasn't covered
    
    Important: Base all responses solely on the provided context. Do not introduce external knowledge even if related.
    
    Format responses conversationally, as if the book itself is explaining its contents to the reader.`
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