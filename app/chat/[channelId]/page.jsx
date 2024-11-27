// app/chat/[channelId]/page.jsx
'use client'
import ChatComponent from '../../components/Chat'
import { Toaster } from 'react-hot-toast';
import { useParams } from 'next/navigation'


export default function ChatPage() {
    const params = useParams()
    console.log('params', params)
  
  return (
    <>
      <Toaster position="top-right" />
      <ChatComponent channelId={params.channelId} />
    </>
  );
}