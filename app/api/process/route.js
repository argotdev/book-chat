// app/api/process/route.js
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

// We can also add a GET handler to test if the route is working
export async function GET() {
  return NextResponse.json({ status: 'Route is working' });
}
// Make sure to export the HTTP method handlers
export async function POST(req) {
  try {
    // Dynamic imports to avoid initialization issues
    const { StreamChat } = await import('stream-chat');
    const { PDFEmbeddingSystem } = await import('@/lib/PDFEmbeddingSystem');

    const formData = await req.formData();
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file received' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    // Process file
    const buffer = await file.arrayBuffer();
    const pdfId = randomUUID();
    const timestamp = Date.now();
    const nameWithoutExtension = file.name.replace(/\.pdf$/i, '');
    const cleanFileName = `${timestamp}-${nameWithoutExtension.replace(/[^a-zA-Z0-9-]/g, '_')}`;

    try {
      console.log('Initializing embedding system...');
      
      // Initialize embedding system
      const embedder = new PDFEmbeddingSystem(
        process.env.OPENAI_API_KEY,
        process.env.PINECONE_API_KEY,
        process.env.PINECONE_INDEX
      );

      console.log('Processing PDF...');
      
      // Process PDF and create embeddings
      await embedder.processPDF(
        buffer,
        cleanFileName,
        { 
          pdfId,
          originalName: file.name,
          uploadedAt: timestamp
        }
      );

      console.log('Creating Stream channel...');

      // Create a new Stream channel for this PDF
      const serverClient = StreamChat.getInstance(
        process.env.NEXT_PUBLIC_STREAM_API_KEY,
        process.env.STREAM_API_SECRET
      );

      const channelId = cleanFileName;
      
      // Create the channel
      const channel = serverClient.channel('messaging', channelId, {
        name: file.name,
        created_by: { id: 'system' },
        pdfId,
        created_at: timestamp
      });

      await channel.create();

      console.log('Process completed successfully');

      return NextResponse.json({
        success: true,
        channelId,
        cleanFileName
      });

    } catch (processingError) {
      console.error('Error during PDF processing:', processingError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to process PDF: ' + processingError.message 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error handling request:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to handle request: ' + error.message 
      },
      { status: 500 }
    );
  }
}
