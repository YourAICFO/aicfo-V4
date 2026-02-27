import { Link } from 'react-router-dom';
import { useUpgradeModalStore } from '../store/upgradeModalStore';
import { Button } from './ui/Button';

export default function UpgradeModal() {
  const { open, message, close } = useUpgradeModalStore();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={close} aria-hidden />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Plan limit reached
        </h3>
        <p className="text-gray-600 dark:text-gray-300">{message}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Upgrade to Pro to add more companies and get higher usage limits.
        </p>
        <div className="flex gap-3 pt-2">
          <Link to="/settings?tab=billing" onClick={close}>
            <Button>Go to Billing</Button>
          </Link>
          <Button variant="outline" onClick={close}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
