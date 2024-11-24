// app/page.jsx
import UploadForm from './components/UploadForm';
import { Toaster } from 'react-hot-toast';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <Toaster position="top-right" />
      <UploadForm />
    </main>
  );
}