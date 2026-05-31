"use client";

import React from "react";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { wagmiConfig } from "@/lib/config";

import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Silence unhandled promise rejections from wagmi/viem on page load
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (e) => {
    const msg = e?.reason?.message ?? "";
    if (
      msg.includes("indexedDB") ||
      msg.includes("Cannot read properties of undefined") ||
      msg.includes("WebSocket") ||
      msg.includes("network") ||
      msg.includes("fetch")
    ) {
      e.preventDefault();
    }
  });
}

const rainbowTheme = darkTheme({
  accentColor: "#f5c518",
  accentColorForeground: "#0a0a0b",
  borderRadius: "medium",
  fontStack: "system",
  overlayBlur: "small",
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rainbowTheme}>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 5000,
              style: {
                background: "#1a0a2e",
                color: "#f5f5f5",
                border: "1px solid rgba(245, 197, 24, 0.25)",
                borderRadius: "10px",
                fontSize: "14px",
                padding: "12px 16px",
              },
              success: {
                iconTheme: { primary: "#00d68f", secondary: "#1a0a2e" },
              },
              error: {
                iconTheme: { primary: "#ef4444", secondary: "#1a0a2e" },
              },
            }}
          />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
