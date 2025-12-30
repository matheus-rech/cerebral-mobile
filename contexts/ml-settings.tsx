/**
 * ML Settings Context
 * Manages backend selection (local vs NeuroSAM3 cloud) and processing options
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Modality, WindowType, Colormap, WINDOW_TYPES, COLORMAPS } from '@/services/neurosam3';

// Backend options
export type MLBackend = 'local' | 'neurosam3';

// Settings interface
export interface MLSettings {
  // Backend selection
  backend: MLBackend;
  
  // Image processing options
  modality: Modality;
  windowType: WindowType;
  colormap: Colormap;
  transparency: number;
  
  // CLAHE preprocessing
  applyClahe: boolean;
  claheClip: number;
  
  // AMG settings
  amgPointsPerSide: number;
  amgMinMaskArea: number;
  
  // Edge detection settings
  edgeThreshold: number;
  edgeDilationSize: number;
}

// Default settings
const defaultSettings: MLSettings = {
  backend: 'local',
  modality: 'MRI',
  windowType: 'Brain (Grey Matter)',
  colormap: 'jet',
  transparency: 0.5,
  applyClahe: false,
  claheClip: 2.0,
  amgPointsPerSide: 32,
  amgMinMaskArea: 100,
  edgeThreshold: 50,
  edgeDilationSize: 2,
};

// Context interface
interface MLSettingsContextType {
  settings: MLSettings;
  updateSettings: (updates: Partial<MLSettings>) => void;
  resetSettings: () => void;
  isLoading: boolean;
}

const MLSettingsContext = createContext<MLSettingsContextType | undefined>(undefined);

const STORAGE_KEY = '@cerebral_ml_settings';

export function MLSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<MLSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from storage on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load ML settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: MLSettings) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save ML settings:', error);
    }
  };

  const updateSettings = (updates: Partial<MLSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    saveSettings(defaultSettings);
  };

  return (
    <MLSettingsContext.Provider value={{ settings, updateSettings, resetSettings, isLoading }}>
      {children}
    </MLSettingsContext.Provider>
  );
}

export function useMLSettings() {
  const context = useContext(MLSettingsContext);
  if (!context) {
    throw new Error('useMLSettings must be used within MLSettingsProvider');
  }
  return context;
}

// Re-export constants for convenience
export { WINDOW_TYPES, COLORMAPS };
export type { Modality, WindowType, Colormap };
