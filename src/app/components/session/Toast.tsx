import { toast } from 'sonner';

export const showToast = {
  success: (message: string) => {
    toast.success(message, {
      duration: 3000,
      position: 'top-right',
      style: {
        background: '#10B981',
        color: 'white',
      },
    });
  },
  error: (message: string) => {
    toast.error(message, {
      duration: 4000,
      position: 'top-right',
      style: {
        background: '#EF4444',
        color: 'white',
      },
    });
  },
  warning: (message: string) => {
    toast.warning(message, {
      duration: 4000,
      position: 'top-right',
      style: {
        background: '#F59E0B',
        color: 'white',
      },
    });
  },
  info: (message: string) => {
    toast.info(message, {
      duration: 3000,
      position: 'top-right',
      style: {
        background: '#3B82F6',
        color: 'white',
      },
    });
  },
}; 