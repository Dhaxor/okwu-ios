// Confirmations live in a sheet, never Alert.alert. Two ways in:
//   <ConfirmSheet visible … />            declarative, also nestable inside a Sheet
//   const ok = await confirm({ … })       imperative, from useConfirm()
// Confirm is the filled button, cancel the ghost button under it, both in
// the thumb zone. With `destructive` the confirm turns oxblood so a
// destructive choice is never mistaken for the usual ink "go ahead".
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface ConfirmSheetProps extends ConfirmOptions {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
  testID = "confirm",
}: ConfirmSheetProps) {
  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      testID={testID}
      title={title}
      subtitle={message}
      footer={
        <>
          <Button label={confirmLabel} onPress={onConfirm} testID={`${testID}-ok`} variant={destructive ? "danger" : "primary"} block />
          <Button label={cancelLabel} onPress={onCancel} testID={`${testID}-cancel`} variant="ghost" block />
        </>
      }
    />
  );
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmCtx = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children?: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [visible, setVisible] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    resolver.current?.(false);
    setOptions(opts);
    setVisible(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setVisible(false);
  }, []);

  const value = useMemo(() => confirm, [confirm]);
  return (
    <ConfirmCtx.Provider value={value}>
      {children}
      {options ? (
        <ConfirmSheet {...options} visible={visible} onConfirm={() => settle(true)} onCancel={() => settle(false)} testID="confirm" />
      ) : null}
    </ConfirmCtx.Provider>
  );
}

/**
 * `const confirm = useConfirm(); if (await confirm({ title: "Leave lesson?" })) …`
 * Root-level: do not call while a Sheet is open (iOS shows one root Modal at
 * a time); inside a Sheet, render <ConfirmSheet> as its child instead.
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error("useConfirm needs <UIProvider> (components/ui) above it");
  return ctx;
}
