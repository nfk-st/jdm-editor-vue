import { injectToastProviderContext } from 'reka-ui';

type ToastNotice = {
  message: string;
  description?: string;
  duration?: number;
};

const MESSAGE_DURATION = 3000;
const NOTIFICATION_DURATION = 4500;

export const useToast = () => {
  const manager = injectToastProviderContext(null)?.toastStore;

  return {
    success(message: string) {
      manager?.add({ status: 'success', description: message, duration: MESSAGE_DURATION });
    },
    error(message: string | undefined) {
      if (!message) return;
      manager?.add({ status: 'error', description: message, duration: MESSAGE_DURATION });
    },
    notificationError({ message, description, duration = NOTIFICATION_DURATION }: ToastNotice) {
      manager?.add({ status: 'error', title: message, description, duration });
    },
  };
};
