"use client";

import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { LocalizationProvider } from "../lib/localization";

interface ClientProviderProps {
  children: React.ReactNode;
  fontFamily?: string;
  monoFontFamily?: string;
}

export function ClientProvider({
  children,
  fontFamily = "Arial, sans-serif",
  monoFontFamily = "Courier New, monospace",
}: ClientProviderProps) {
  return (
    <LocalizationProvider>
      <MantineProvider
        theme={{
          primaryColor: "blue",
          fontFamily,
          fontFamilyMonospace: monoFontFamily,
          colors: {
            blue: [
              "#e7f5ff",
              "#d0ebff",
              "#a5d8ff",
              "#74c0fc",
              "#339af0",
              "#228be6",
              "#1c7ed6",
              "#1971c2",
              "#1864ab",
              "#0b5394",
            ],
          },
        }}
      >
        {children}
      </MantineProvider>
    </LocalizationProvider>
  );
}
