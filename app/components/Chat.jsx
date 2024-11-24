// app/components/Chat.jsx
'use client'
import React, { useEffect, useState, useCallback } from 'react';
import { StreamChat } from 'stream-chat';
import {
  Chat,
  Channel as StreamChannel,
  ChannelHeader,
  MessageInput,
  MessageList,
  Thread,
  Window,
} from 'stream-chat-react';
import 'stream-chat-react/dist/css/v2/index.css';
import { toast } from 'react-hot-toast';

const chatClient = StreamChat.getInstance(process.env.NEXT_PUBLIC_STREAM_API_KEY);
const USER_ID = 'user_id'
const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5MB in bytes

export default function ChatComponent() {
  const [channel, setChannel] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  useEffect(() => {
    const setupChat = async () => {
      try {
        const response = await fetch('/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: USER_ID })
        });
        
        const { token } = await response.json();
        
        await chatClient.connectUser(
          {
            id: USER_ID,
            name: 'User Name',
          },
          token
        );

        const channel = chatClient.channel('messaging', 'book_chat_2', {
          name: 'Book Discussion',
        });
        
        await channel.watch();
        setChannel(channel);
      } catch (error) {
        console.error('Error setting up chat:', error);
        toast.error('Failed to connect to chat');
      }
    };

    setupChat();

    return () => {
      chatClient.disconnectUser();
    };
  }, []);

  const handleMessage = useCallback(async (message) => {
    if (!message.text && !message.attachments?.length) return;

    try {
      // Get the last 10 messages for context
      const messages = await channel.query({
        messages: { limit: 10, id_lt: message.id },
      });
      
      const conversationHistory = [...messages.messages, message]
        .map(msg => ({
          role: msg.user.id === USER_ID ? 'user' : 'assistant',
          content: msg.text
        }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.text,
          userId: USER_ID,
          channelId: channel.id,
          conversationHistory,
          attachments: message.attachments
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const { response: aiResponse } = await response.json();

    } catch (error) {
      console.error('Error processing message:', error);
      toast.error('Failed to process message');
      await channel.sendMessage({
        text: "I'm sorry, I encountered an error processing your message.",
        user_id: 'ai_assistant'
      });
    }
  }, [channel]);

  const validateFile = (file) => {
    // Check file type
    if (file.type !== 'application/pdf') {
      throw new Error('Only PDF files are allowed');
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size must be less than 4.5MB');
    }

    return true;
  };

  const doUploadRequest = useCallback(async (file, channel) => {
    setIsUploading(true);
    
    try {
      // Validate file
      validateFile(file);
      
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      
      // Upload to Vercel Blob Storage
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.message || 'Upload failed');
      }
      
      const { url } = await uploadResponse.json();
      
      toast.success('File uploaded successfully');
      
      // Return the file URL in the format Stream expects
      return {
        file: url,
        type: 'file',
        mimeType: 'application/pdf',
        size: file.size,
        name: file.name
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(error.message || 'Failed to upload file');
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, []);

  useEffect(() => {
    if (channel) {
      channel.on('message.new', event => {
        if (event.user.id === USER_ID) {
          handleMessage(event.message);
        }
      });

      return () => {
        channel.off('message.new');
      };
    }
  }, [channel, handleMessage]);

  if (!channel) return <div>Loading...</div>;

  return (
    <div className="h-screen">
      <Chat client={chatClient} theme="messaging light">
        <StreamChannel channel={channel}>
          <Window>
            <ChannelHeader />
            <MessageList />
            <MessageInput 
              doFileUploadRequest={doUploadRequest}
              disabled={isUploading}
              maxNumberOfFiles={1}
              acceptedFiles={['.pdf']}
            />
          </Window>
          <Thread />
        </StreamChannel>
      </Chat>
    </div>
  );
}