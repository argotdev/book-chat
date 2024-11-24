import { StreamChat } from 'stream-chat'

const serverClient = StreamChat.getInstance(
  process.env.NEXT_PUBLIC_STREAM_API_KEY,
  process.env.STREAM_API_SECRET
)

export async function POST(req) {
  try {
    const { userId } = await req.json()
    
    if (!userId) {
      return Response.json({ error: 'User ID is required' }, { status: 400 })
    }

    const token = serverClient.createToken(userId)
    return Response.json({ token })
    
  } catch (error) {
    console.error('Error generating token:', error)
    return Response.json({ error: 'Could not generate token' }, { status: 500 })
  }
}