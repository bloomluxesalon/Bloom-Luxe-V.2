import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { QueueItem, SystemSettings } from "../types";
import { createQueueBooking, fetchDatabase, saveQueues, saveSettings } from "./api";

interface AppContextType {
  queues: QueueItem[];
  settings: SystemSettings | null;
  status: 'live' | 'error';
  statusCode?: string;
  refresh: () => Promise<void>;
  createQueue: (newQueue: Omit<QueueItem, 'id'>) => Promise<QueueItem | null>;
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
      const result = await saveQueues(newQueues, queues);
      setQueues(result.queues);
      setStatus('live');
      setStatusCode(undefined);
      return true;
    } catch (err) {
      console.error(err);
      setStatus('error');
      setStatusCode('SAVE');
      return false;
    }
  };

  const createQueue = async (newQueue: Omit<QueueItem, 'id'>) => {
    try {
      const result = await createQueueBooking(newQueue, queues);
      setQueues(result.queues);
      setStatus('live');
      setStatusCode(undefined);
      return result.queue;
    } catch (err) {
      console.error(err);
      setStatus('error');
      setStatusCode('SAVE');
      return null;
    }
  };

  const updateSettings = async (newSettings: SystemSettings) => {
    try {
      const result = await saveSettings(newSettings);
      setSettings(result.settings);
      setStatus('live');
      setStatusCode(undefined);
      return true;
    } catch (err) {
      console.error(err);
      setStatus('error');
      setStatusCode('SAVE');
      return false;
    }
  };

  return (
    <AppContext.Provider value={{ queues, settings, status, statusCode, refresh: loadData, createQueue, updateQueues, updateSettings }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be within AppProvider");
  return context;
}
