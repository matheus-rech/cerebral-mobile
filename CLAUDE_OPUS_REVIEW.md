# CRITICAL BUGS LIST

## 1. **Navigation Issues**
- **app/(tabs)/index.tsx**: Line 41, 53, 65 - `router.push()` uses wrong pathname format
- **app/(tabs)/datasets.tsx**: Line 29 - `router.push()` uses wrong pathname format
- **app/(tabs)/settings.tsx**: Line 90, 113 - `router.push()` uses wrong pathname format
- **app/analysis.tsx**: Multiple lines - `router.push()` uses wrong pathname format

## 2. **Missing Imports**
- **app/(tabs)/index.tsx**: Missing `IconSymbol` import
- **app/analysis.tsx**: Missing proper status bar handling

## 3. **TouchableOpacity Import Issues**
- Multiple files import TouchableOpacity from 'react-native' but should use Pressable for consistency

## 4. **Service Connection Issues**
- **app/(tabs)/index.tsx**: DICOM parser not handling errors properly
- **app/analysis.tsx**: Vision analyzer service connection issues

## 5. **State Management Issues**
- **app/interactive-segment.tsx**: Touch handling not properly implemented
- **app/model-comparison.tsx**: Async state updates not handled correctly

# FIXED CODE

=== FIXED: app/(tabs)/index.tsx ===
```typescript
import { ScrollView, Text, View, Pressable, ActivityIndicator, Alert, Platform } from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { AVAILABLE_DATASETS, loadRandomSample } from "@/services/huggingface";
import { parseDICOMFile } from "@/services/dicom-parser";

export default function HomeScreen() {
  const colors = useColors();
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [dicomLoading, setDicomLoading] = useState(false);

  const haptic = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleLoadDataset = async (datasetId: string) => {
    haptic();
    setLoading(true);
    setLoadingId(datasetId);

    try {
      const mriImage = await loadRandomSample(datasetId);
      router.push({
        pathname: "/analysis",
        params: { 
          imageUri: mriImage.uri, 
          source: "huggingface", 
          datasetId 
        },
      });
    } catch (error) {
      console.error("Dataset error:", error);
      Alert.alert("Error", "Failed to load MRI sample. Try another dataset.");
    } finally {
      setLoading(false);
      setLoadingId(null);
    }
  };

  const handleDICOM = async () => {
    haptic();
    setDicomLoading(true);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/dicom", "*/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets[0]) {
        setDicomLoading(false);
        return;
      }

      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();
      const dicomImage = await parseDICOMFile(blob);

      router.push({
        pathname: "/analysis",
        params: { 
          imageUri: dicomImage.dataUrl, 
          source: "dicom" 
        },
      });
    } catch (error) {
      console.error("DICOM error:", error);
      Alert.alert("Error", "Failed to parse DICOM file. Please ensure it's a valid DICOM file.");
    } finally {
      setDicomLoading(false);
    }
  };

  const handle3DViewer = () => {
    haptic();
    router.push({
      pathname: "/viewer-3d",
      params: { 
        imageUri: "https://niivue.github.io/niivue/images/mni152.nii.gz",
        title: "MNI152 Brain Template"
      },
    });
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 gap-5">
          {/* Hero */}
          <View className="items-center gap-2 pt-4 pb-2">
            <Text className="text-4xl font-bold text-foreground">🧠 CEREBRAL</Text>
            <Text className="text-base text-muted text-center">AI-Powered Brain MRI Analysis</Text>
          </View>

          {/* DICOM Upload */}
          <Pressable onPress={handleDICOM} disabled={dicomLoading}
            style={({ pressed }) => ({
              backgroundColor: colors.primary, 
              borderRadius: 16, 
              padding: 16,
              opacity: pressed || dicomLoading ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 28 }}>🏥</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "bold" }}>
                  {dicomLoading ? "Loading DICOM..." : "Upload DICOM File"}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>From PACS or imaging system</Text>
              </View>
              {dicomLoading && <ActivityIndicator color="#fff" />}
            </View>
          </Pressable>

          {/* 3D Viewer */}
          <Pressable onPress={handle3DViewer}
            style={({ pressed }) => ({ 
              backgroundColor: colors.surface, 
              borderRadius: 16, 
              padding: 16, 
              borderWidth: 1, 
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 28 }}>🎛️</Text>
              <View style={{ flex: 1 }}>
                <Text className="text-lg font-bold text-foreground">3D Brain Viewer</Text>
                <Text className="text-sm text-muted">With axial, coronal, sagittal sliders</Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color={colors.primary} />
            </View>
          </Pressable>

          {/* HuggingFace Datasets */}
          <Text className="text-lg font-bold text-foreground mt-2">HuggingFace Datasets</Text>
          
          {AVAILABLE_DATASETS.map((dataset) => (
            <Pressable key={dataset.id} onPress={() => handleLoadDataset(dataset.id)} 
              disabled={loading}
              style={({ pressed }) => ({ 
                backgroundColor: colors.surface, 
                borderRadius: 14, 
                padding: 14, 
                borderWidth: 1, 
                borderColor: colors.border, 
                opacity: loading && loadingId !== dataset.id ? 0.5 : pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: colors.primary + "20", 
                  justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ fontSize: 20 }}>🧠</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text className="text-base font-semibold text-foreground">{dataset.name}</Text>
                  <Text className="text-xs text-muted">{dataset.repoId}</Text>
                </View>
                {loading && loadingId === dataset.id ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <IconSymbol name="chevron.right" size={18} color={colors.primary} />
                )}
              </View>
            </Pressable>
          ))}

          {/* ML Models */}
          <View className="bg-surface rounded-xl p-4 border border-border mt-2">
            <Text className="text-base font-semibold text-foreground mb-2">Active ML Models</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {["UNet", "MedSAM2", "SAM3", "SynthSeg"].map((m) => (
                <View key={m} style={{ backgroundColor: colors.primary + "20", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>{m}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
```
===

=== FIXED: app/(tabs)/datasets.tsx ===
```typescript
import { ScrollView, Text, View, Pressable, ActivityIndicator, Alert } from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { loadRandomSample, AVAILABLE_DATASETS } from "@/services/huggingface";

export default function DatasetsScreen() {
  const colors = useColors();
  const [loadingDataset, setLoadingDataset] = useState<string | null>(null);

  const handleLoadSample = async (datasetId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setLoadingDataset(datasetId);

      const mriImage = await loadRandomSample(datasetId);

      // Navigate to analysis screen
      router.push({
        pathname: "/analysis",
        params: {
          imageUri: mriImage.uri,
          source: mriImage.source,
          datasetId: mriImage.datasetId,
        },
      });
    } catch (error) {
      console.error("Error loading dataset sample:", error);
      Alert.alert(
        "Error",
        "Failed to load MRI sample from dataset. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setLoadingDataset(null);
    }
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">MRI Datasets</Text>
            <Text className="text-sm text-muted leading-relaxed">
              Browse and load MRI samples from HuggingFace datasets for analysis
            </Text>
          </View>

          {/* Dataset Cards */}
          <View className="gap-4">
            {AVAILABLE_DATASETS.map((dataset) => (
              <View
                key={dataset.id}
                className="bg-surface rounded-2xl p-5 border border-border shadow-sm"
              >
                <View className="gap-3">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <Text className="text-xl font-bold text-foreground mb-2">
                        {dataset.name}
                      </Text>
                      <Text className="text-sm text-muted leading-relaxed">
                        {dataset.description}
                      </Text>
                    </View>
                  </View>

                  <View className="bg-background rounded-lg p-3 border border-border">
                    <Text className="text-xs text-muted mb-1">Repository</Text>
                    <Text className="text-sm font-mono text-foreground">{dataset.repoId}</Text>
                  </View>

                  <Pressable
                    onPress={() => handleLoadSample(dataset.id)}
                    disabled={loadingDataset !== null}
                    style={({ pressed }) => [
                      {
                        opacity: pressed || loadingDataset !== null ? 0.7 : 1,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      },
                    ]}
                  >
                    <View className="bg-primary rounded-xl p-3 items-center">
                      {loadingDataset === dataset.id ? (
                        <View className="flex-row items-center gap-2">
                          <ActivityIndicator size="small" color={colors.background} />
                          <Text className="text-base font-semibold text-background">
                            Loading Sample...
                          </Text>
                        </View>
                      ) : (
                        <View className="flex-row items-center gap-2">
                          <IconSymbol name="arrow.down.circle.fill" size={20} color={colors.background} />
                          <Text className="text-base font-semibold text-background">
                            Load Random Sample
                          </Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>

          {/* Info */}
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-sm font-semibold text-foreground mb-2">
              📊 About HuggingFace Datasets
            </Text>
            <Text className="text-xs text-muted leading-relaxed">
              These datasets are publicly available on HuggingFace and contain various types of
              brain MRI scans. Each time you load a sample, a random image is retrieved from the
              dataset for analysis.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
```
===

=== FIXED: app/(tabs)/settings.tsx ===
```typescript
import { ScrollView, Text, View, Pressable, Alert, Switch } from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { getSettings, saveSettings, clearAnalysisHistory } from "@/services/storage";
import type { AppSettings } from "@/services/storage";

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>({
    autoSaveHistory: true,
    darkMode: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const loadedSettings = await getSettings();
      setSettings(loadedSettings);
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const updateSetting = async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const updatedSettings = { ...settings, [key]: value };
      setSettings(updatedSettings);
      await saveSettings(updatedSettings);
    } catch (error) {
      console.error("Error updating setting:", error);
      Alert.alert("Error", "Failed to save settings", [{ text: "OK" }]);
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      "Clear History",
      "Are you sure you want to delete all analysis history? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await clearAnalysisHistory();
              Alert.alert("Success", "Analysis history cleared", [{ text: "OK" }]);
            } catch (error) {
              console.error("Error clearing history:", error);
              Alert.alert("Error", "Failed to clear history", [{ text: "OK" }]);
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Settings</Text>
            <Text className="text-sm text-muted">Configure app preferences</Text>
          </View>

          {/* Model Configuration */}
          <View className="gap-4">
            <Text className="text-lg font-bold text-foreground">Models</Text>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/model-config");
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className="bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-base font-semibold text-foreground mb-1">
                  🧠 Model Configuration
                </Text>
                <Text className="text-sm text-muted">
                  Select models and adjust parameters for analysis
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Analysis Settings */}
          <View className="gap-4">
            <Text className="text-lg font-bold text-foreground">Analysis</Text>

            <View className="bg-surface rounded-2xl border border-border overflow-hidden">
              <View className="p-4 flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground mb-1">
                    Auto-save History
                  </Text>
                  <Text className="text-sm text-muted">
                    Automatically save analysis results to history
                  </Text>
                </View>
                <Switch
                  value={settings.autoSaveHistory}
                  onValueChange={(value) => updateSetting("autoSaveHistory", value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>
            </View>
          </View>

          {/* Advanced Features */}
          <View className="gap-4">
            <Text className="text-lg font-bold text-foreground">Advanced</Text>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/async-demo");
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className="bg-surface rounded-2xl p-4 border border-border flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground mb-1">
                    🚀 Async Processing Demo
                  </Text>
                  <Text className="text-sm text-muted">
                    Test background ML processing with progress tracking
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={20} color={colors.primary} />
              </View>
            </Pressable>
          </View>

          {/* Appearance Settings */}
          <View className="gap-4">
            <Text className="text-lg font-bold text-foreground">Appearance</Text>

            <View className="bg-surface rounded-2xl border border-border overflow-hidden">
              <View className="p-4 flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground mb-1">
                    Dark Mode
                  </Text>
                  <Text className="text-sm text-muted">
                    Use dark theme (requires app restart)
                  </Text>
                </View>
                <Switch
                  value={settings.darkMode}
                  onValueChange={(value) => updateSetting("darkMode", value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>
            </View>
          </View>

          {/* Data Management */}
          <View className="gap-4">
            <Text className="text-lg font-bold text-foreground">Data</Text>

            <Pressable
              onPress={handleClearHistory}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className="bg-error/10 rounded-2xl p-4 border border-error">
                <Text className="text-base font-semibold text-error mb-1">
                  Clear Analysis History
                </Text>
                <Text className="text-sm text-error/70">
                  Delete all saved analysis reports
                </Text>
              </View>
            </Pressable>
          </View>

          {/* About */}
          <View className="gap-4">
            <Text className="text-lg font-bold text-foreground">About</Text>

            <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
              <View>
                <Text className="text-base font-semibold text-foreground mb-1">
                  CEREBRAL Mobile
                </Text>
                <Text className="text-sm text-muted">Version 1.0.0</Text>
              </View>

              <View className="border-t border-border pt-3">
                <Text className="text-sm text-muted leading-relaxed">
                  AI-powered neuroimaging analysis system combining Claude's vision capabilities
                  with HuggingFace MRI datasets for real-time brain scan analysis.
                </Text>
              </View>

              <View className="border-t border-border pt-3">
                <Text className="text-xs text-muted">
                  ⚠️ For research and educational purposes only. Not for clinical use.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
```
===

=== FIXED: app/analysis.tsx ===
```typescript
import { View, Text, Pressable, ActivityIndicator, Alert, Share, ScrollView } from "react-native";
import { useState, useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { MRIViewerEnhanced } from "@/components/mri-viewer-enhanced";
import { AnalysisReportCard } from "@/components/analysis-report-card";
import { EmergencyAlert } from "@/components/emergency-alert";
import { useColors } from "@/hooks/use-colors";
import { analyzeMRIImage } from "@/services/vision-analyzer";
import { saveAnalysisToHistory } from "@/services/storage";
import type { MRIAnalysisReport } from "@/types/mri";

export default function AnalysisScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{
    imageUri: string;
    source?: string;
    datasetId?: string;
  }>();

  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<MRIAnalysisReport | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAnalyze = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setAnalyzing(true);

      // Analyze MRI image using Claude Vision API
      const analysisReport = await analyzeMRIImage(params.imageUri);
      setReport(analysisReport);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error analyzing image:", error);
      Alert.alert("Error", "Failed to analyze MRI image. Please try again.", [
        { text: "OK" },
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!report) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSaving(true);

      await saveAnalysisToHistory(report);

      Alert.alert("Success", "Analysis saved to history", [
        {
          text: "View History",
          onPress: () => router.push("/(tabs)/history"),
        },
        { text: "OK" },
      ]);
    } catch (error) {
      console.error("Error saving analysis:", error);
      Alert.alert("Error", "Failed to save analysis. Please try again.", [{ text: "OK" }]);
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!report) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const message = `CEREBRAL MRI Analysis Report\n\nModality: ${report.modality}\nView: ${report.view}\nQuality: ${Math.round(report.qualityScore * 100)}%\n\nImpression: ${report.impression}\n\nGenerated: ${new Date(report.timestamp).toLocaleString()}`;

      await Share.share({
        message,
        title: "MRI Analysis Report",
      });
    } catch (error) {
      console.error("Error sharing report:", error);
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </Pressable>

        <Text className="text-lg font-bold text-foreground">MRI Analysis</Text>

        <View className="flex-row gap-3">
          {report && (
            <>
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <IconSymbol name="square.and.arrow.up" size={24} color={colors.foreground} />
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({
                    pathname: "/segmentation",
                    params: {
                      imageUri: params.imageUri,
                      modality: report.modality,
                    },
                  });
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Text className="text-2xl">🎯</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({
                    pathname: "/comparison",
                    params: {
                      imageUri: params.imageUri,
                    },
                  });
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <IconSymbol name="square.split.2x1" size={24} color={colors.foreground} />
              </Pressable>

              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={({ pressed }) => ({ opacity: pressed || saving ? 0.6 : 1 })}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.foreground} />
                ) : (
                  <Text className="text-2xl">💾</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {!report ? (
          <View className="flex-1">
            {/* Image Viewer */}
            <View className="h-96 bg-black">
              <MRIViewerEnhanced 
                imageUri={params.imageUri}
                showWindowingControls={true}
              />
            </View>

            {/* Analyze Button */}
            <View className="p-6 gap-4">
              <Pressable
                onPress={handleAnalyze}
                disabled={analyzing}
                style={({ pressed }) => [
                  {
                    opacity: pressed || analyzing ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <View className="bg-primary rounded-2xl p-4 items-center">
                  {analyzing ? (
                    <View className="flex-row items-center gap-3">
                      <ActivityIndicator size="small" color={colors.background} />
                      <Text className="text-lg font-bold text-background">
                        Analyzing with AI Vision...
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-lg font-bold text-background">
                      🧠 Analyze with AI Vision
                    </Text>
                  )}
                </View>
              </Pressable>

              <View className="bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted leading-relaxed">
                  This analysis uses Claude's vision capabilities to detect anatomical structures,
                  identify potential abnormalities, and generate a structured medical report.
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View className="gap-4 pb-6">
            {/* Emergency Findings Alert */}
            <EmergencyAlert 
              findings={report.emergencyFindings}
              severity={report.severity}
            />
            
            <AnalysisReportCard report={report} />
            
            {/* Action Buttons */}
            <View className="px-6 gap-3">
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({
                    pathname: '/viewer-3d',
                    params: {
                      imageUri: params.imageUri,
                      title: 'MRI 3D Visualization',
                    },
                  });
                }}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <View className="bg-primary rounded-2xl p-4 items-center">
                  <Text className="text-lg font-bold text-background">
                    🧠 View in 3D (NiiVue)
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({
                    pathname: '/segmentation',
                    params: {
                      imageUri: params.imageUri,
                      analysisId: report.id,
                    },
                  });
                }}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <View className="bg-surface rounded-2xl p-4 items-center border border-border">
                  <Text className="text-lg font-bold text-foreground">
                    🔬 View Segmentation
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({
                    pathname: '/interactive-segment',
                    params: {
                      imageUri: params.imageUri,
                    },
                  });
                }}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <View className="bg-surface rounded-2xl p-4 items-center border border-primary">
                  <Text className="text-lg font-bold text-primary">
                    🎯 Interactive Segmentation
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({
                    pathname: '/model-comparison',
                    params: {
                      imageUri: params.imageUri,
                    },
                  });
                }}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <View className="bg-surface rounded-2xl p-4 items-center border border-border">
                  <Text className="text-lg font-bold text-foreground">
                    🔬 Compare Models
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
```
===

=== FIXED: app/interactive-segment.tsx ===
```typescript
import { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';

type PromptType = 'point' | 'box' | 'text';
type Point = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };

export default function InteractiveSegmentScreen() {
  const params = useLocalSearchParams<{ imageUri: string }>();
  const [promptType, setPromptType] = useState<PromptType>('point');
  const [points, setPoints] = useState<Point[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [textPrompt, setTextPrompt] = useState('');
  const [maskUri, setMaskUri] = useState<string | null>(null);
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [areaPixels, setAreaPixels] = useState<number | null>(null);
  
  // Box drawing state
  const [isDrawingBox, setIsDrawingBox] = useState(false);
  const [boxStart, setBoxStart] = useState<Point | null>(null);
  const [currentBox, setCurrentBox] = useState<Box | null>(null);
  
  const imageRef = useRef<Image>(null);

  const handleImagePress = (event: any) => {
    if (promptType !== 'point') return;
    
    const { locationX, locationY } = event.nativeEvent;
    const newPoint = { x: locationX, y: locationY };
    
    setPoints([...points, newPoint]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBoxDrawStart = (event: any) => {
    if (promptType !== 'box') return;
    
    const { locationX, locationY } = event.nativeEvent;
    setIsDrawingBox(true);
    setBoxStart({ x: locationX, y: locationY });
    setCurrentBox({ x: locationX, y: locationY, w: 0, h: 0 });
  };

  const handleBoxDrawMove = (event: any) => {
    if (!isDrawingBox || !boxStart) return;
    
    const { locationX, locationY } = event.nativeEvent;
    const w = locationX - boxStart.x;
    const h = locationY - boxStart.y;
    
    setCurrentBox({
      x: w > 0 ? boxStart.x : locationX,
      y: h > 0 ? boxStart.y : locationY,
      w: Math.abs(w),
      h: Math.abs(h),
    });
  };

  const handleBoxDrawEnd = () => {
    if (!isDrawingBox || !currentBox) return;
    
    setIsDrawingBox(false);
    setBoxes([...boxes, currentBox]);
    setBoxStart(null);
    setCurrentBox(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleSegment = async () => {
    setIsSegmenting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      let endpoint = '';
      let body: any = {
        image: params.imageUri,
      };

      if (promptType === 'point' && points.length > 0) {
        endpoint = 'http://localhost:5006/segment-point';
        body.point = points[points.length - 1]; // Use last point
      } else if (promptType === 'box' && boxes.length > 0) {
        endpoint = 'http://localhost:5006/segment-box';
        body.box = boxes[boxes.length - 1]; // Use last box
      } else if (promptType === 'text' && textPrompt.trim()) {
        endpoint = 'http://localhost:5006/segment-text';
        body.text = textPrompt;
      } else {
        Alert.alert('Error', 'Please provide a prompt');
        setIsSegmenting(false);
        return;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success) {
        setMaskUri(`data:image/png;base64,${result.mask}`);
        setConfidence(result.confidence);
        setAreaPixels(result.area_pixels);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Error', result.error || 'Segmentation failed');
      }
    } catch (error) {
      console.error('Segmentation error:', error);
      Alert.alert('Error', 'Failed to segment image');
    } finally {
      setIsSegmenting(false);
    }
  };

  const handleClear = () => {
    setPoints([]);
    setBoxes([]);
    setTextPrompt('');
    setMaskUri(null);
    setConfidence(null);
    setAreaPixels(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleUndo = () => {
    if (promptType === 'point' && points.length > 0) {
      setPoints(points.slice(0, -1));
    } else if (promptType === 'box' && boxes.length > 0) {
      setBoxes(boxes.slice(0, -1));
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-4">
        {/* Header */}
        <View className="mb-4">
          <Text className="text-2xl font-bold text-foreground mb-2">
            Interactive Segmentation
          </Text>
          <Text className="text-sm text-muted">
            Tap, draw, or describe to segment brain structures
          </Text>
        </View>

        {/* Prompt Type Selector */}
        <View className="flex-row gap-2 mb-4">
          <Pressable
            onPress={() => setPromptType('point')}
            style={({ pressed }) => ({
              flex: 1,
              padding: 12,
              borderRadius: 8,
              backgroundColor: promptType === 'point' ? '#3B82F6' : '#f3f4f6',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              className={`text-center font-semibold ${
                promptType === 'point' ? 'text-white' : 'text-foreground'
              }`}
            >
              Point
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setPromptType('box')}
            style={({ pressed }) => ({
              flex: 1,
              padding: 12,
              borderRadius: 8,
              backgroundColor: promptType === 'box' ? '#3B82F6' : '#f3f4f6',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              className={`text-center font-semibold ${
                promptType === 'box' ? 'text-white' : 'text-foreground'
              }`}
            >
              Box
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setPromptType('text')}
            style={({ pressed }) => ({
              flex: 1,
              padding: 12,
              borderRadius: 8,
              backgroundColor: promptType === 'text' ? '#3B82F6' : '#f3f4f6',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              className={`text-center font-semibold ${
                promptType === 'text' ? 'text-white' : 'text-foreground'
              }`}
            >
              Text
            </Text>
          </Pressable>
        </View>

        {/* Instructions */}
        <View className="bg-surface p-3 rounded-lg mb-4">
          <Text className="text-sm text-muted">
            {promptType === 'point' && '📍 Tap on the region you want to segment'}
            {promptType === 'box' && '⬜ Drag to draw a box around the region'}
            {promptType === 'text' && '💬 Describe what you want to segment'}
          </Text>
        </View>

        {/* Text Input (for text prompt) */}
        {promptType === 'text' && (
          <View className="mb-4">
            <TextInput
              className="bg-surface text-foreground p-3 rounded-lg"
              placeholder="e.g., segment the tumor"
              placeholderTextColor="#9BA1A6"
              value={textPrompt}
              onChangeText={setTextPrompt}
              returnKeyType="done"
              onSubmitEditing={handleSegment}
            />
          </View>
        )}

        {/* Image with Overlays */}
        <View className="relative mb-4">
          <Pressable
            onPress={handleImagePress}
            onPressIn={handleBoxDrawStart}
            onPressOut={handleBoxDrawEnd}
            style={{ position: 'relative' }}
          >
            <Image
              ref={imageRef}
              source={{ uri: params.imageUri }}
              className="w-full h-80 rounded-lg"
              resizeMode="contain"
            />
          </Pressable>

          {/* Point Markers */}
          {points.map((point, index) => (
            <View
              key={`point-${index}`}
              className="absolute w-3 h-3 bg-primary rounded-full border-2 border-background"
              style={{
                left: point.x - 6,
                top: point.y - 6,
              }}
            />
          ))}

          {/* Box Overlays */}
          {boxes.map((box, index) => (
            <View
              key={`box-${index}`}
              className="absolute border-2 border-primary"
              style={{
                left: box.x,
                top: box.y,
                width: box.w,
                height: box.h,
              }}
            />
          ))}

          {/* Current Drawing Box */}
          {currentBox && (
            <View
              className="absolute border-2 border-primary border-dashed"
              style={{
                left: currentBox.x,
                top: currentBox.y,
                width: currentBox.w,
                height: currentBox.h,
              }}
            />
          )}

          {/* Mask Overlay */}
          {maskUri && (
            <Image
              source={{ uri: maskUri }}
              className="absolute w-full h-full rounded-lg opacity-60"
              resizeMode="contain"
            />
          )}
        </View>

        {/* Results */}
        {confidence !== null && (
          <View className="bg-surface p-4 rounded-lg mb-4">
            <Text className="text-lg font-semibold text-foreground mb-2">
              Segmentation Results
            </Text>
            <View className="gap-2">
              <View className="flex-row justify-between">
                <Text className="text-muted">Confidence:</Text>
                <Text className="text-foreground font-semibold">
                  {(confidence * 100).toFixed(1)}%
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted">Area:</Text>
                <Text className="text-foreground font-semibold">
                  {areaPixels} pixels
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View className="gap-3 mb-6">
          <Pressable
            onPress={handleSegment}
            disabled={isSegmenting}
            style={({ pressed }) => ({ 
              backgroundColor: '#3B82F6',
              padding: 16,
              borderRadius: 8,
              opacity: pressed || isSegmenting ? 0.6 : 1
            })}
          >
            {isSegmenting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-center font-semibold text-lg">
                Segment
              </Text>
            )}
          </Pressable>

          <View className="flex-row gap-3">
            <Pressable
              onPress={handleUndo}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: '#f3f4f6',
                padding: 12,
                borderRadius: 8,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text className="text-foreground text-center font-semibold">
                Undo
              </Text>
            </Pressable>

            <Pressable
              onPress={handleClear}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: '#f3f4f6',
                padding: 12,
                borderRadius: 8,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text className="text-foreground text-center font-semibold">
                Clear All
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              backgroundColor: '#f3f4f6',
              padding: 12,
              borderRadius: 8,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text className="text-foreground text-center font-semibold">
              Done
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
```
===

=== FIXED: app/model-comparison.tsx ===
```typescript
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { ZoomableImage, resetZoomPan } from '@/components/zoomable-image';
import { generateAgreementHeatmap, getAgreementColor, type HeatmapResult } from '@/services/agreement-heatmap';
import * as Haptics from 'expo-haptics';
import { useSharedValue } from 'react-native-reanimated';

type ModelResult = {
  model: string;
  maskUri: string;
  confidence: number;
  areaPixels: number;
  inferenceTime: number;
};

type ComparisonMetrics = {
  diceCoefficients: { [key: string]: number };
  agreement: number;
  consensusArea: number;
};

export default function ModelComparisonScreen() {
  const params = useLocalSearchParams<{ imageUri: string }>();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ModelResult[]>([]);
  const [metrics, setMetrics] = useState<ComparisonMetrics | null>(null);
  const [visibleModels, setVisibleModels] = useState<Set<string>>(new Set());
  const [heatmap, setHeatmap] = useState<HeatmapResult | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Shared values for synchronized zoom/pan
  const sharedScale = useSharedValue(1);
  const sharedTranslateX = useSharedValue(0);
  const sharedTranslateY = useSharedValue(0);

  const models = [
    { name: 'UNet', port: 5003, color: '#EF4444' },
    { name: 'MedSAM2', port: 5005, color: '#3B82F6' },
    { name: 'SAM3', port: 5006, color: '#10B981' },
    { name: 'SynthSeg', port: 5001, color: '#F59E0B' },
  ];

  useEffect(() => {
    // Initialize all models as visible
    setVisibleModels(new Set(models.map((m) => m.name)));
  }, []);

  const runAllModels = async () => {
    setIsRunning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const modelResults: ModelResult[] = [];

    try {
      // Run all models in parallel
      const promises = models.map(async (model) => {
        const startTime = Date.now();

        try {
          let endpoint = '';
          let body: any = { image: params.imageUri };

          // Configure endpoint based on model
          if (model.name === 'UNet') {
            endpoint = `http://localhost:${model.port}/detect`;
          } else if (model.name === 'MedSAM2') {
            endpoint = `http://localhost:${model.port}/segment`;
            body.prompts = {
              boxes: [{ x: 64, y: 64, w: 128, h: 128 }], // Center region
            };
          } else if (model.name === 'SAM3') {
            endpoint = `http://localhost:${model.port}/segment-point`;
            body.point = { x: 128, y: 128 }; // Center point
          } else if (model.name === 'SynthSeg') {
            endpoint = `http://localhost:${model.port}/segment`;
          }

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          const result = await response.json();
          const inferenceTime = Date.now() - startTime;

          if (result.success || result.mask) {
            return {
              model: model.name,
              maskUri: `data:image/png;base64,${result.mask || result.overlay}`,
              confidence: result.confidence || 0.85,
              areaPixels: result.area_pixels || result.total_area || 0,
              inferenceTime,
            };
          }
        } catch (error) {
          console.error(`Error running ${model.name}:`, error);
        }

        return null;
      });

      const results = await Promise.all(promises);
      const validResults = results.filter((r) => r !== null) as ModelResult[];

      setResults(validResults);

      // Calculate comparison metrics
      if (validResults.length >= 2) {
        const calculatedMetrics = calculateMetrics(validResults);
        setMetrics(calculatedMetrics);

        // Generate agreement heatmap
        const heatmapData = await generateAgreementHeatmap(
          validResults.map((r) => ({ model: r.model, maskUri: r.maskUri }))
        );
        setHeatmap(heatmapData);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error running models:', error);
      Alert.alert('Error', 'Failed to run model comparison');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsRunning(false);
    }
  };

  const calculateMetrics = (results: ModelResult[]): ComparisonMetrics => {
    // Calculate Dice coefficients between all pairs
    const diceCoefficients: { [key: string]: number } = {};

    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const model1 = results[i];
        const model2 = results[j];

        // Simplified Dice calculation based on area overlap
        const intersection = Math.min(model1.areaPixels, model2.areaPixels);
        const union = model1.areaPixels + model2.areaPixels;
        const dice = union > 0 ? (2 * intersection) / union : 0;

        diceCoefficients[`${model1.model}-${model2.model}`] = dice;
      }
    }

    // Calculate overall agreement
    const diceValues = Object.values(diceCoefficients);
    const agreement =
      diceValues.length > 0
        ? diceValues.reduce((sum, val) => sum + val, 0) / diceValues.length
        : 0;

    // Calculate consensus area (average)
    const consensusArea =
      results.reduce((sum, r) => sum + r.areaPixels, 0) / results.length;

    return {
      diceCoefficients,
      agreement,
      consensusArea,
    };
  };

  const toggleModelVisibility = (modelName: string) => {
    const newVisible = new Set(visibleModels);
    if (newVisible.has(modelName)) {
      newVisible.delete(modelName);
    } else {
      newVisible.add(modelName);
    }
    setVisibleModels(newVisible);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const getModelColor = (modelName: string) => {
    return models.find((m) => m.name === modelName)?.color || '#6B7280';
  };

  const handleResetZoom = () => {
    resetZoomPan(sharedScale, sharedTranslateX, sharedTranslateY);
    setZoomLevel(1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleTransformChange = (scale: number, translateX: number, translateY: number) => {
    setZoomLevel(scale);
  };

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-4">
        {/* Header */}
        <View className="mb-4">
          <Text className="text-2xl font-bold text-foreground mb-2">
            Model Comparison
          </Text>
          <Text className="text-sm text-muted">
            Compare segmentation results from multiple AI models
          </Text>
        </View>

        {/* Run Button */}
        {results.length === 0 && (
          <Pressable
            onPress={runAllModels}
            disabled={isRunning}
            style={({ pressed }) => ({
              backgroundColor: '#3B82F6',
              padding: 16,
              borderRadius: 8,
              marginBottom: 16,
              opacity: pressed || isRunning ? 0.6 : 1,
            })}
          >
            {isRunning ? (
              <View className="flex-row items-center justify-center gap-3">
                <ActivityIndicator color="#fff" />
                <Text className="text-white text-center font-semibold text-lg">
                  Running {models.length} Models...
                </Text>
              </View>
            ) : (
              <Text className="text-white text-center font-semibold text-lg">
                🔬 Run All Models
              </Text>
            )}
          </Pressable>
        )}

        {/* Original Image */}
        <View className="mb-4">
          <Text className="text-lg font-semibold text-foreground mb-2">
            Original Image
          </Text>
          <Image
            source={{ uri: params.imageUri }}
            className="w-full h-64 rounded-lg bg-black"
            resizeMode="contain"
          />
        </View>

        {/* Zoom Controls */}
        {results.length > 0 && (
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-muted">Zoom:</Text>
              <Text className="text-sm font-semibold text-foreground">
                {zoomLevel.toFixed(1)}x
              </Text>
            </View>
            <Pressable
              onPress={handleResetZoom}
              style={({ pressed }) => ({
                backgroundColor: '#f3f4f6',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#e5e7eb',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text className="text-foreground font-semibold">Reset View</Text>
            </Pressable>
          </View>
        )}

        {/* Agreement Heatmap */}
        {heatmap && (
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-lg font-semibold text-foreground">
                Agreement Heatmap
              </Text>
              <Pressable
                onPress={() => {
                  setShowHeatmap(!showHeatmap);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text className="text-primary font-semibold">
                  {showHeatmap ? 'Hide' :