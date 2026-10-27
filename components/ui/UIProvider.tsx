// Hosts the app-wide overlays: toasts and the imperative confirm sheet.
// Mount once in app/_layout.tsx, inside SafeAreaProvider.
import React from "react";
import { ConfirmProvider } from "./ConfirmSheet";
import { ToastProvider, ToastViewport } from "./Toast";

export function UIProvider({ children }: { children?: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        {children}
        <ToastViewport layer="root" />
      </ConfirmProvider>
    </ToastProvider>
  );
}
