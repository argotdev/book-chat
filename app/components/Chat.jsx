// app/components/Chat.jsx
'use client'
import React, { useEffect, useState } from 'react';
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
import { toast } from 'react-hot-toast';
import 'stream-chat-react/dist/css/v2/index.css';

const chatClient = StreamChat.getInstance(process.env.NEXT_PUBLIC_STREAM_API_KEY);
const USER_ID = 'user_id';

export default function ChatComponent({ channelId }) {
    console.log('channelId', channelId)
  const [channel, setChannel] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const setupChat = async () => {
      try {
        // Get user token
        const response = await fetch('/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: USER_ID })
        });
        
        if (!response.ok) {
          throw new Error('Failed to get user token');
        }

        const { token } = await response.json();
        
        // Connect user to Stream Chat
        await chatClient.connectUser(
          {
            id: USER_ID,
            name: 'User Name',
          },
          token
        );

        // Get or create channel
        const channel = chatClient.channel('messaging', channelId);
        
        // Watch channel for updates
        await channel.watch();

        // Check if channel is empty before sending welcome message
        const state = await channel.query();
        if (state.messages.length === 0) {
          await channel.sendMessage({
            id: `welcome-${channelId}`,
            text: "You can now start chatting with your PDF document. Ask any questions about its content!",
            user_id: 'system',
          });
        }

        setChannel(channel);
      } catch (error) {
        console.error('Error setting up chat:', error);
        toast.error('Failed to connect to chat');
      } finally {
        setIsLoading(false);
      }
    };

    setupChat();

    // Cleanup
    return () => {
      const cleanup = async () => {
        try {
          if (channel) {
            await channel.stopWatching();
          }
          await chatClient.disconnectUser();
        } catch (error) {
          console.error('Error during cleanup:', error);
        }
      };
      cleanup();
    };
  }, [channelId]);

  const handleMessage = async (message) => {
    if (!message.text) return;

    try {
      // Get the last 10 messages for context
      const messages = await channel.query({
        messages: { 
          limit: 10,
          id_lt: message.id 
        }
      });
      
      // Format conversation history for the AI
      const conversationHistory = [...messages.messages, message]
        .filter(msg => msg.user.id !== 'system') // Exclude system messages
        .map(msg => ({
          role: msg.user.id === USER_ID ? 'user' : 'assistant',
          content: msg.text
        }));

      // Send to AI endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.text,
          userId: USER_ID,
          channelId: channelId,
          conversationHistory
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      // Response handling is done in the API route
      // which sends the message directly to the Stream channel

    } catch (error) {
      console.error('Error processing message:', error);
      toast.error('Failed to process message');
      
      // Send error message to channel
      await channel.sendMessage({
        text: "I'm sorry, I encountered an error processing your message. Please try again.",
        user_id: 'ai_assistant'
      });
    }
  };

  useEffect(() => {
    if (channel) {
      // Listen for new messages
      channel.on('message.new', event => {
        // Only process messages from the user, not from the AI or system
        if (event.user.id === USER_ID) {
          handleMessage(event.message);
        }
      });

      // Handle connection state changes
      chatClient.on('connection.changed', ({ online }) => {
        if (!online) {
          toast.error('Lost connection. Trying to reconnect...');
        }
      });

      // Handle errors
      channel.on('channel.error', () => {
        toast.error('Error in chat channel');
      });

      return () => {
        channel.off('message.new');
        channel.off('channel.error');
        chatClient.off('connection.changed');
      };
    }
  }, [channel]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center text-red-600">
          <p>Failed to load chat.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <Chat client={chatClient} theme="messaging light">
        <StreamChannel channel={channel}>
          <Window>
            <ChannelHeader />
            <MessageList />
            <MessageInput />
          </Window>
          <Thread />
        </StreamChannel>
      </Chat>
    </div>
  );
}