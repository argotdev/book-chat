// app/components/UploadForm.jsx
'use client'
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB in bytes

export default function UploadForm() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(0);
  const loadingMessages = [
    "Reading your PDF... 📚",
    "Processing the contents... 🤔",
    "Teaching AI about your document... 🧠",
    "Almost there... ⚡",
    "Making final preparations... 🎯"
  ];
  const router = useRouter();

  useEffect(() => {
    let interval;
    if (isProcessing) {
      interval = setInterval(() => {
        setLoadingMessage((prev) => (prev + 1) % loadingMessages.length);
      }, 30000);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    console.log('file', file)
    
    if (!file) return;

    // Validate file
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size must be less than 8MB');
      return;
    }

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });

      // Log the raw response for debugging
      console.log('Raw response:', response);

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Response parsing error:', parseError);
        toast.error('Server returned an invalid response');
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process PDF');
      }

      if (!data.channelId) {
        throw new Error('No channel ID returned from server');
      }

      toast.success('PDF processed successfully!');
      router.push(`/chat/${data.channelId}`);
    } catch (error) {
      console.error('Error processing PDF:', error);
      toast.error(error.message || 'Failed to process PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold text-center mb-6">
        Chat with your PDF
      </h1>
      
      <div className="space-y-4">
        <label className="block">
          <span className="text-gray-700">Upload a PDF (max 8MB)</span>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            disabled={isProcessing}
            className="mt-1 block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </label>

        {isProcessing && (
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-sm text-gray-600 animate-fade-in">
              {loadingMessages[loadingMessage]}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}