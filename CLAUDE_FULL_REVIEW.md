Looking at your React Native/Expo app code, I can identify several critical issues that are preventing functionality. Here are the fixes:

## CRITICAL BUGS LIST

1. **Missing imports and components**:
   - `ScreenContainer` component is used everywhere but not defined
   - `HapticTab` component missing
   - `IconSymbol` component missing
   - Multiple service files missing (`huggingface.ts`, `dicom-parser.ts`, etc.)
   - Types definitions missing

2. **Navigation issues**:
   - Stack screens not properly defined in `_layout.tsx`
   - Missing route definitions for analysis, segmentation, etc.

3. **Button/Pressable issues**:
   - Missing proper event handlers
   - Async operations without proper error handling

4. **Missing service implementations**:
   - HuggingFace API integration
   - DICOM parsing
   - ML model services
   - Storage services

Let me provide the fixed code:

=== FIXED: components/screen-container.tsx ===
```typescript
import { View, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cn } from '@/lib/utils';

interface ScreenContainerProps extends ViewProps {
  children: React.ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  className?: string;
}

export function ScreenContainer({ 
  children, 
  edges = ['top', 'bottom', 'left', 'right'], 
  className,
  style,
  ...props 
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();
  
  const paddingTop = edges.includes('top') ? insets.top : 0;
  const paddingBottom = edges.includes('bottom') ? insets.bottom : 0;
  const paddingLeft = edges.includes('left') ? insets.left : 0;
  const paddingRight = edges.includes('right') ? insets.right : 0;

  return (
    <View
      className={cn('flex-1 bg-background', className)}
      style={[
        {
          paddingTop,
          paddingBottom,
          paddingLeft,
          paddingRight,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
```

=== FIXED: components/haptic-tab.tsx ===
```typescript
import * as Haptics from 'expo-haptics';
import { Pressable, PressableProps } from 'react-native';

export function HapticTab(props: PressableProps) {
  return (
    <Pressable
      onPressIn={() => {
        if (process.env.NODE_ENV !== 'development') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }}
      {...props}
    />
  );
}
```

=== FIXED: components/ui/icon-symbol.tsx ===
```typescript
import { Text, TextProps } from 'react-native';
import { cn } from '@/lib/utils';

interface IconSymbolProps extends TextProps {
  name: string;
  size?: number;
  color?: string;
}

// Map SF Symbols to Unicode equivalents
const ICON_MAP: Record<string, string> = {
  'house.fill': '🏠',
  'folder.fill': '📁',
  'clock.fill': '🕐',
  'gear': '⚙️',
  'arrow.left': '←',
  'chevron.left': '‹',
  'chevron.right': '›',
  'square.and.arrow.up': '↗️',
  'square.split.2x1': '⧉',
  'trash': '🗑️',
  'plus': '+',
  'minus': '-',
  'xmark': '×',
  'checkmark': '✓',
};

export function IconSymbol({ name, size = 24, color, style, ...props }: IconSymbolProps) {
  const icon = ICON_MAP[name] || '?';
  
  return (
    <Text
      style={[
        {
          fontSize: size,
          color,
          lineHeight: size,
        },
        style,
      ]}
      {...props}
    >
      {icon}
    </Text>
  );
}
```

=== FIXED: lib/utils.ts ===
```typescript
import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
```

=== FIXED: services/huggingface.ts ===
```typescript
export interface MRIDataset {
  id: string;
  name: string;
  repoId: string;
  description: string;
}

export interface MRIImage {
  uri: string;
  source: string;
  datasetId: string;
}

export const AVAILABLE_DATASETS: MRIDataset[] = [
  {
    id: 'brain-tumor',
    name: 'Brain Tumor MRI',
    repoId: 'brain-tumor-classification-mri',
    description: 'Brain tumor classification dataset with various tumor types',
  },
  {
    id: 'alzheimer-mri',
    name: 'Alzheimer MRI',
    repoId: 'alzheimer-mri-classification',
    description: 'Alzheimer disease classification from brain MRI scans',
  },
  {
    id: 'stroke-lesion',
    name: 'Stroke Lesion',
    repoId: 'stroke-lesion-segmentation',
    description: 'Stroke lesion segmentation dataset',
  },
];

export async function loadRandomSample(datasetId: string): Promise<MRIImage> {
  try {
    // Simulate loading from HuggingFace
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Return a sample MRI image (you would replace this with actual HuggingFace API call)
    const sampleImages = [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Normal_Brain_MRI_T2_Axial.jpg/256px-Normal_Brain_MRI_T2_Axial.jpg',
      'https://radiopaedia.org/images/1234567',
      // Add more sample URLs or use placeholder service
    ];
    
    const randomImage = sampleImages[Math.floor(Math.random() * sampleImages.length)];
    
    return {
      uri: randomImage,
      source: 'huggingface',
      datasetId,
    };
  } catch (error) {
    throw new Error(`Failed to load sample from dataset ${datasetId}: ${error}`);
  }
}
```

=== FIXED: services/dicom-parser.ts ===
```typescript
export interface DICOMImage {
  dataUrl: string;
  metadata: {
    patientName?: string;
    studyDate?: string;
    modality?: string;
    institution?: string;
  };
}

export async function parseDICOMFile(blob: Blob): Promise<DICOMImage> {
  try {
    // Simulate DICOM parsing (you would use a real DICOM library like cornerstone-core)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // For now, return a placeholder
    return {
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      metadata: {
        patientName: 'Anonymous',
        studyDate: new Date().toISOString().split('T')[0],
        modality: 'MR',
        institution: 'Unknown',
      },
    };
  } catch (error) {
    throw new Error(`Failed to parse DICOM file: ${error}`);
  }
}
```

=== FIXED: services/vision-analyzer.ts ===
```typescript
import type { MRIAnalysisReport } from '@/types/mri';

export async function analyzeMRIImage(imageUri: string): Promise<MRIAnalysisReport> {
  try {
    // Simulate AI analysis with Claude Vision API
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Mock analysis result
    const report: MRIAnalysisReport = {
      id: `analysis_${Date.now()}`,
      imageUri,
      timestamp: Date.now(),
      modality: 'T2-weighted',
      view: 'Axial',
      qualityScore: 0.85 + Math.random() * 0.15,
      impression: 'Normal brain anatomy with no acute abnormalities detected. White matter appears normal. No evidence of mass effect or midline shift.',
      anatomicalFindings: [
        {
          structure: 'Cerebral cortex',
          status: 'normal',
          description: 'Normal cortical thickness and signal intensity',
        },
        {
          structure: 'White matter',
          status: 'normal', 
          description: 'Homogeneous white matter signal',
        },
        {
          structure: 'Ventricular system',
          status: 'normal',
          description: 'Normal ventricular size and configuration',
        },
      ],
      emergencyFindings: [],
      severity: 'normal',
    };
    
    return report;
  } catch (error) {
    throw new Error(`Failed to analyze MRI image: ${error}`);
  }
}
```

=== FIXED: services/storage.ts ===
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MRIAnalysisReport } from '@/types/mri';

const HISTORY_KEY = '@cerebral_analysis_history';
const SETTINGS_KEY = '@cerebral_settings';

export interface AppSettings {
  autoSaveHistory: boolean;
  darkMode: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  autoSaveHistory: true,
  darkMode: false,
};

export async function saveAnalysisToHistory(report: MRIAnalysisReport): Promise<void> {
  try {
    const existingHistory = await getAnalysisHistory();
    const updatedHistory = [report, ...existingHistory];
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    throw new Error(`Failed to save analysis: ${error}`);
  }
}

export async function getAnalysisHistory(): Promise<MRIAnalysisReport[]> {
  try {
    const historyJson = await AsyncStorage.getItem(HISTORY_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
  } catch (error) {
    console.error('Failed to load analysis history:', error);
    return [];
  }
}

export async function deleteAnalysisFromHistory(analysisId: string): Promise<void> {
  try {
    const history = await getAnalysisHistory();
    const updatedHistory = history.filter(report => report.id !== analysisId);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    throw new Error(`Failed to delete analysis: ${error}`);
  }
}

export async function clearAnalysisHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    throw new Error(`Failed to clear history: ${error}`);
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    throw new Error(`Failed to save settings: ${error}`);
  }
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const settingsJson = await AsyncStorage.getItem(SETTINGS_KEY);
    return settingsJson ? { ...DEFAULT_SETTINGS, ...JSON.parse(settingsJson) } : DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Failed to load settings:', error);
    return DEFAULT_SETTINGS;
  }
}
```

=== FIXED: types/mri.ts ===
```typescript
export type MRIModality = 'T1-weighted' | 'T2-weighted' | 'FLAIR' | 'DWI' | 'T1-CE';
export type MRIView = 'Axial' | 'Sagittal' | 'Coronal';
export type FindingStatus = 'normal' | 'abnormal' | 'uncertain';
export type SeverityLevel = 'normal' | 'mild' | 'moderate' | 'severe' | 'critical';

export interface AnatomicalFinding {
  structure: string;
  status: FindingStatus;
  description: string;
  confidence?: number;
}

export interface EmergencyFinding {
  type: string;
  severity: SeverityLevel;
  description: string;
  recommendation: string;
}

export interface MRIAnalysisReport {
  id: string;
  imageUri: string;
  timestamp: number;
  modality: MRIModality;
  view: MRIView;
  qualityScore: number;
  impression: string;
  anatomicalFindings: AnatomicalFinding[];
  emergencyFindings: EmergencyFinding[];
  severity: SeverityLevel;
}

export interface SegmentationResult {
  maskUri: string;
  confidence: number;
  statistics: {
    totalPixels: number;
    segmentedPixels: number;
    segmentedPercentage: number;
    regions: Array<{
      label: string;
      area: number;
      percentage: number;
    }>;
  };
}
```

=== FIXED: services/segmentation.ts ===
```typescript
import type { SegmentationResult, MRIModality } from '@/types/mri';

export async function segmentMRIImage(
  imageUri: string, 
  modality: MRIModality
): Promise<SegmentationResult> {
  try {
    // Simulate segmentation processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock segmentation result
    const mockResult: SegmentationResult = {
      maskUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      confidence: 0.82,
      statistics: {
        totalPixels: 65536,
        segmentedPixels: 5240,
        segmentedPercentage: 8.0,
        regions: [
          {
            label: 'Gray Matter',
            area: 2850,
            percentage: 4.35,
          },
          {
            label: 'White Matter',
            area: 1890,
            percentage: 2.88,
          },
          {
            label: 'CSF',
            area: 500,
            percentage: 0.76,
          },
        ],
      },
    };
    
    return mockResult;
  } catch (error) {
    throw new Error(`Segmentation failed: ${error}`);
  }
}
```

=== FIXED: app/_layout.tsx ===
```typescript
import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="analysis" />
            <Stack.Screen name="segmentation" />
            <Stack.Screen name="comparison" />
            <Stack.Screen name="viewer-3d" />
            <Stack.Screen name="interactive-segment" />
            <Stack.Screen name="model-comparison" />
            <Stack.Screen name="model-config" />
            <Stack.Screen name="async-demo" />
            <Stack.Screen name="oauth/callback" />
          </Stack>
          <StatusBar style="auto" />
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}
```

## MISSING PIECES TO ADD

1. **Install required dependencies**:
```bash
npm install @react-native-async-storage/async-storage
npm install @react-native-community/slider
npm install expo-haptics
npm install expo-document-picker
npm install clsx
```

2. **Add these additional service files**:

=== MISSING: components/mri-viewer-enhanced.tsx ===
```typescript
import { Image } from 'expo-image';
import { View } from 'react-native';

interface MRIViewerEnhancedProps {
  imageUri: string;
  showWindowingControls?: boolean;
}

export function MRIViewerEnhanced({ imageUri }: MRIViewerEnhancedProps) {
  return (
    <View className="flex-1 bg-black">
      <Image
        source={{ uri: imageUri }}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
      />
    </View>
  );
}
```

=== MISSING: hooks/use-colors.ts ===
```typescript
import { useColorScheme } from 'react-native';

export function useColors() {
  const colorScheme = useColorScheme();
  
  const colors = {
    primary: colorScheme === 'dark' ? '#3B82F6' : '#2563EB',
    background: colorScheme === 'dark' ? '#000000' : '#FFFFFF',
    foreground: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
    surface: colorScheme === 'dark' ? '#1F1F1F' : '#F8F9FA',
    border: colorScheme === 'dark' ? '#333333' : '#E5E7EB',
    muted: colorScheme === 'dark' ? '#9CA3AF' : '#6B7280',
    text: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
    tint: colorScheme === 'dark' ? '#3B82F6' : '#2563EB',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  };
  
  return colors;
}
```

3. **Add remaining missing components** (EmergencyAlert, NiiVueViewer, etc.) as needed.

The main issues were missing foundational components, services, and types. With these fixes, your buttons should work, navigation should function, and the basic app structure should be operational. You'll need to implement the actual ML model integrations and API endpoints separately.