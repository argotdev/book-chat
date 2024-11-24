// app/api/upload/route.js
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5MB in bytes

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file received' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size must be less than 4.5MB' },
        { status: 400 }
      );
    }

    // Generate a clean filename
    const timestamp = new Date().getTime();
    const cleanFileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Upload file to Vercel Blob Storage
    const blob = await put(cleanFileName, file, {
      access: 'public',
      contentType: 'application/pdf',
      maxAge: 31536000, // Cache for 1 year
    });

    return NextResponse.json({
      url: blob.url,
      type: 'file',
      mimeType: 'application/pdf',
      size: file.size,
      name: file.name
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Upload failed: ' + error.message },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};