import { NextResponse } from 'next/server';
import { StreamChat } from 'stream-chat';

export async function POST(req) {
  try {
    const { userId } = await req.json();
    
    const serverClient = StreamChat.getInstance(
      process.env.NEXT_PUBLIC_STREAM_API_KEY,
      process.env.STREAM_API_SECRET
    );

    // First, upsert the user with admin role
    await serverClient.upsertUser({
      id: userId,
      role: 'admin',
    });

    // Generate token for the admin user
    const token = serverClient.createToken(userId);

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error generating token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}