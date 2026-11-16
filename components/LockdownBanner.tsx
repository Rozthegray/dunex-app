import React, { useState } from 'react';
import { useRouter } from 'next/router';

interface LockdownState {
  is_locked: boolean;
  fine_owed: number;
  days_inactive: number;
}

export default function LockdownBanner({ lockdown }: { lockdown: LockdownState }) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  // Normal state - do not render the banner
  if (lockdown.days_inactive < 30 && !lockdown.is_locked) return null;

  const handleReactivate = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/v1/wallet/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        const error = await response.json();
        // If insufficient funds, redirect to deposit
        if (response.status === 400 && error.detail.includes('Insufficient funds')) {
          alert('Insufficient balance to pay the fine. Please deposit funds first.');
          router.push('/deposit');
        } else {
          alert(error.detail || 'Reactivation failed.');
        }
        return;
      }
      
      // Success: Reload dashboard state
      alert('Account reactivated successfully!');
      router.reload();
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  // State 1: Locked Out
  if (lockdown.is_locked) {
    return (
      <div className="bg-red-900/50 border border-red-500 rounded-lg p-6 mb-6 text-center">
        <h2 className="text-xl font-bold text-red-400 mb-2">Account Locked: Inactivity</h2>
        <p className="text-gray-300 mb-4">
          Your account has been locked due to 60 days of inactivity. Withdrawals and trading are disabled.
          To restore full access, a reactivation fine of <strong className="text-white">${lockdown.fine_owed.toFixed(2)}</strong> is required.
        </p>
        <button 
          onClick={handleReactivate}
          disabled={isProcessing}
          className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded-md transition-colors"
        >
          {isProcessing ? 'Processing...' : `Pay $${lockdown.fine_owed.toFixed(2)} Reactivation Fine`}
        </button>
      </div>
    );
  }

  // State 2: Countdown Warning (Days 30 - 59)
  const daysLeft = 60 - lockdown.days_inactive;
  return (
    <div className="bg-yellow-900/50 border border-yellow-500 rounded-lg p-4 mb-6 flex justify-between items-center">
      <div>
        <h3 className="text-yellow-400 font-bold">Action Required: Account Inactivity</h3>
        <p className="text-sm text-gray-300 mt-1">
          Your account will enter Lockdown Mode in <strong>{daysLeft} days</strong>. Initiate a deposit to keep your account active and avoid a $500 fine.
        </p>
      </div>
      <button 
        onClick={() => router.push('/deposit')}
        className="bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-bold py-2 px-4 rounded-md whitespace-nowrap ml-4 transition-colors"
      >
        Make a Deposit
      </button>
    </div>
  );
}
