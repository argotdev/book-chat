import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Chat with Your Knowledge Base',
  description: 'A Next.js app for chatting with embeddings stored in Pinecone using OpenAI',
}

export default function RootLayout({
  children,
} ) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}

