import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ message = 'Loading...' }) => {
  return (
    <div className='flex items-center justify-center min-h-[400px]'>
      <div className='text-center'>
        <Loader2 className='w-8 h-8 animate-spin text-blue-400 mx-auto mb-4' />
        <p className='text-white/70'>{message}</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;
