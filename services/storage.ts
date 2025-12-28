/**
 * Storage Service
 * Manages local storage for analysis history and settings
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MRIAnalysisReport } from '@/types/mri';

const STORAGE_KEYS = {
  ANALYSIS_HISTORY: '@cerebral:analysis_history',
  SETTINGS: '@cerebral:settings',
};

/**
 * Save an analysis report to history
 */
export async function saveAnalysisToHistory(report: MRIAnalysisReport): Promise<void> {
  try {
    const history = await getAnalysisHistory();
    const updatedHistory = [report, ...history];
    
    // Keep only the last 50 analyses
    const trimmedHistory = updatedHistory.slice(0, 50);
    
    await AsyncStorage.setItem(
      STORAGE_KEYS.ANALYSIS_HISTORY,
      JSON.stringify(trimmedHistory)
    );
  } catch (error) {
    console.error('Error saving analysis to history:', error);
    throw error;
  }
}

/**
 * Get all analysis history
 */
export async function getAnalysisHistory(): Promise<MRIAnalysisReport[]> {
  try {
    const historyJson = await AsyncStorage.getItem(STORAGE_KEYS.ANALYSIS_HISTORY);
    
    if (!historyJson) {
      return [];
    }
    
    return JSON.parse(historyJson);
  } catch (error) {
    console.error('Error getting analysis history:', error);
    return [];
  }
}

/**
 * Delete an analysis from history
 */
export async function deleteAnalysisFromHistory(analysisId: string): Promise<void> {
  try {
    const history = await getAnalysisHistory();
    const updatedHistory = history.filter((report) => report.id !== analysisId);
    
    await AsyncStorage.setItem(
      STORAGE_KEYS.ANALYSIS_HISTORY,
      JSON.stringify(updatedHistory)
    );
  } catch (error) {
    console.error('Error deleting analysis from history:', error);
    throw error;
  }
}

/**
 * Clear all analysis history
 */
export async function clearAnalysisHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.ANALYSIS_HISTORY);
  } catch (error) {
    console.error('Error clearing analysis history:', error);
    throw error;
  }
}

/**
 * Get a specific analysis by ID
 */
export async function getAnalysisById(analysisId: string): Promise<MRIAnalysisReport | null> {
  try {
    const history = await getAnalysisHistory();
    return history.find((report) => report.id === analysisId) || null;
  } catch (error) {
    console.error('Error getting analysis by ID:', error);
    return null;
  }
}

/**
 * Settings interface
 */
export interface AppSettings {
  apiKey?: string;
  defaultModality?: string;
  autoSaveHistory: boolean;
  darkMode: boolean;
}

/**
 * Get app settings
 */
export async function getSettings(): Promise<AppSettings> {
  try {
    const settingsJson = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
    
    if (!settingsJson) {
      return {
        autoSaveHistory: true,
        darkMode: false,
      };
    }
    
    return JSON.parse(settingsJson);
  } catch (error) {
    console.error('Error getting settings:', error);
    return {
      autoSaveHistory: true,
      darkMode: false,
    };
  }
}

/**
 * Save app settings
 */
export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
}
