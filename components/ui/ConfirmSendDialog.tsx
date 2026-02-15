'use client';

import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface ConfirmSendDialogProps {
  to: string;
  subject: string;
  body: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmSendDialog({
  to,
  subject,
  body,
  onConfirm,
  onCancel,
}: ConfirmSendDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Confirm Send Email</h3>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3 mb-6">
          <div>
            <span className="text-sm font-medium text-muted-foreground">
              To:
            </span>
            <p className="text-sm">{to}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-muted-foreground">
              Subject:
            </span>
            <p className="text-sm">{subject}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-muted-foreground">
              Body:
            </span>
            <p className="text-sm max-h-32 overflow-y-auto whitespace-pre-wrap">
              {body || '(empty)'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={onConfirm} className="flex-1">
            Send Email
          </Button>
          <Button onClick={onCancel} variant="outline" className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
