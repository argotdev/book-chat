// app/chat/[channelId]/page.jsx
'use client'
import ChatComponent from '../../components/Chat'
import { Toaster } from 'react-hot-toast';

export default function ChatPage({ params }) {
  const { channelId } = params;
  
  return (
    <>
      <Toaster position="top-right" />
      <ChatComponent channelId={channelId} />
    </>
  );
}