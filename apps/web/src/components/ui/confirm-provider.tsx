'use client';

import * as React from 'react';
import { Button } from './button';
import { Dialog } from './dialog';

type ConfirmFn = (message: string) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn>(async () => false);

export function useConfirm() {
  return React.useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = React.useState<{
    message: string;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = React.useCallback<ConfirmFn>(
    (message) =>
      new Promise<boolean>((resolve) => {
        setRequest({ message, resolve });
      }),
    []
  );

  const finish = (value: boolean) => {
    request?.resolve(value);
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={request !== null}
        onClose={() => finish(false)}
        title="Confirm"
      >
        <div className="space-y-4">
          <p className="text-sm">{request?.message}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => finish(false)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={() => finish(true)}>
              Confirm
            </Button>
          </div>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
