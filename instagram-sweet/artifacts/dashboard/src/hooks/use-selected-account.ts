import { useEffect, useState } from "react";

const STORAGE_KEY = "instagram_selected_account";

function normalizeAccount(username: string | null | undefined): string | null {
  const normalized = username?.trim().replace(/^@/, "").toLowerCase();
  return normalized || null;
}

export function useSelectedAccount() {
  const [selectedAccount, setSelectedAccountState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return normalizeAccount(window.localStorage.getItem(STORAGE_KEY));
  });

  const setSelectedAccount = (username: string | null) => {
    setSelectedAccountState(normalizeAccount(username));
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (selectedAccount) {
      window.localStorage.setItem(STORAGE_KEY, selectedAccount);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [selectedAccount]);

  return { selectedAccount, setSelectedAccount };
}
