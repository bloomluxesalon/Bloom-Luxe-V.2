import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { QueueItem, SystemSettings } from "../types";
import { fetchDatabase, saveDatabase } from "./api";

interface AppContextType {
  queues: QueueItem[];
  settings: SystemSettings | null;
  status: 'live' | 'error';
  statusCode?: string;
  refresh: () => Promise<void>;
  updateQueues: (newQueues: QueueItem[]) => Promise<boolean>;
  updateSettings: (newSettings: SystemSettings) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [queues, setQueues] = useState<QueueItem[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [status, setStatus] = useState<'live' | 'error'>('live');
  const [statusCode, setStatusCode] = useState<string>();

  const loadData = async () => {
    try {
      const data = await fetchDatabase();
      setQueues(data.queues);
      setSettings(data.settings);
      setStatus('live');
      setStatusCode(undefined);
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setStatusCode(err.message || 'NET');
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const updateQueues = async (newQueues: QueueItem[]) => {
    try {
      await saveDatabase(newQueues, settings || { id: 'SYS_SETTINGS', staffLineIds: ["", "", "", "", "", ""] });
      setQueues(newQueues);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const updateSettings = async (newSettings: SystemSettings) => {
    try {
      await saveDatabase(queues, newSettings);
      setSettings(newSettings);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  return (
    <AppContext.Provider value={{ queues, settings, status, statusCode, refresh: loadData, updateQueues, updateSettings }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be within AppProvider");
  return context;
}
