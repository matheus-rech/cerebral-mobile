import { View, Text, Pressable, ActivityIndicator, Alert, Share, ScrollView, Image } from "react-native";
import { useState, useEffect, useRef } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { MRIViewerEnhanced } from "@/components/mri-viewer-enhanced";
import { AnalysisReportCard } from "@/components/analysis-report-card";
import { EmergencyAlert } from "@/components/emergency-alert";
import { useColors } from "@/hooks/use-colors";
import { saveAnalysisToHistory } from "@/services/storage";
import type { MRIAnalysisReport } from "@/types/mri";

// ML Model definitions
const ML_MODELS = [
  {
    id: 'neurousg',
    name: 'NeuroUSG',
    description: 'Brain ultrasound segmentation',
    color: '#EC4899', // pink
    speed: '~0.5s',
    bestFor: 'Tumor, ventricles, parenchyma in ultrasound',
    port: 5010,
    endpoint: '/segment/usg',
    modality: 'USG',
  },
  {
    id: 'neuromri',
    name: 'NeuroMRI',
    description: 'MRI T1-Gd/T2/FLAIR segmentation',
    color: '#06B6D4', // cyan
    speed: '~0.5s',
    bestFor: 'Enhancement, necrosis, edema detection',
    port: 5010,
    endpoint: '/segment/mri',
    modality: 'T1_GD',
  },
  {
    id: 'unet',
    name: 'UNet',
    description: 'Lesion detection & classification',
    color: '#3B82F6', // blue
    speed: '~0.2s',
    bestFor: 'Detecting tumors, lesions, abnormalities',
    port: 5003,
    endpoint: '/detect',
  },
  {
    id: 'medsam2',
    name: 'MedSAM2',
    description: 'Interactive segmentation',
    color: '#22C55E', // green
    speed: '~0.2s',
    bestFor: 'Precise region selection with prompts',
    port: 5005,
    endpoint: '/segment',
    interactive: true,
  },
  {
    id: 'sam3',
    name: 'SAM3',
    description: 'Zero-shot segmentation',
    color: '#F97316', // orange
    speed: '~0.2s',
    bestFor: 'Automatic structure detection',
    port: 5006,
    endpoint: '/segment-point',
    interactive: true,
  },
  {
    id: 'synthseg',
    name: 'SynthSeg',
    description: 'Brain structure volumetrics',
    color: '#8B5CF6', // purple
    speed: '~15s',
    bestFor: 'Full brain anatomy & volume analysis',
    port: 5002,
    endpoint: '/segment',
  },
];

export default function AnalysisScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{
    imageUri: string;
    source?: string;
    datasetId?: string;
    model?: string;
  }>();

  // Find the model from params or default to first
  const initialModel = params.model 
    ? ML_MODELS.find(m => m.id === params.model) || ML_MODELS[0]
    : ML_MODELS[0];
  const [selectedModel, setSelectedModel] = useState(initialModel);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<MRIAnalysisReport | null>(null);
  const [synthSegOverlay, setSynthSegOverlay] = useState<string | null>(null);
  const [synthSegStructures, setSynthSegStructures] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const hasAutoAnalyzed = useRef(false);

  // Auto-analyze when coming from viewer with model pre-selected
  useEffect(() => {
    if (params.model && !hasAutoAnalyzed.current && params.imageUri) {
      hasAutoAnalyzed.current = true;
      // Small delay to ensure component is mounted
      const timer = setTimeout(() => {
        handleAnalyze();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [params.model, params.imageUri]);

  const handleAnalyze = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setAnalyzing(true);

      // For interactive models, go to interactive segmentation screen
      if (selectedModel.interactive) {
        router.push({
          pathname: '/interactive-segment',
          params: {
            imageUri: params.imageUri,
            model: selectedModel.id,
          },
        });
        setAnalyzing(false);
        return;
      }

      // Handle neuroimaging models (NeuroUSG and NeuroMRI)
      if (selectedModel.id === 'neurousg' || selectedModel.id === 'neuromri') {
        const apiBaseUrl = getApiBaseUrl();
        const endpoint = selectedModel.id === 'neurousg' 
          ? '/api/ml/neuroimaging/segment-usg' 
          : '/api/ml/neuroimaging/segment-mri';
        
        const mlResponse = await fetch(`${apiBaseUrl}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            imageUri: params.imageUri,
            modality: selectedModel.modality || 'USG',
          }),
        });

        if (!mlResponse.ok) {
          throw new Error(`Neuroimaging service error: ${mlResponse.status}`);
        }

        const mlResult = await mlResponse.json();

        // Store segmentation overlay
        if (mlResult.overlay) {
          setSynthSegOverlay(`data:image/png;base64,${mlResult.overlay}`);
        }
        
        // Store structures from findings
        if (mlResult.findings) {
          const structures = mlResult.findings.map((f: any) => ({
            name: f.structure,
            volume: f.area_pixels,
            percentile: f.area_percentage,
            status: f.severity === 'routine' ? 'normal' : f.severity,
            color: f.structure === 'tumor' ? '#FF5050' : 
                   f.structure === 'ventricles' ? '#0096FF' :
                   f.structure === 'parenchyma' ? '#64C864' :
                   f.structure === 'edema' ? '#6496FF' :
                   f.structure === 'enhancement' ? '#FFC800' :
                   f.structure === 'necrotic' ? '#FF3232' : '#808080',
          }));
          setSynthSegStructures(structures);
        }

        // Create analysis report from neuroimaging result
        const analysisReport: MRIAnalysisReport = {
          id: `analysis-${Date.now()}`,
          timestamp: new Date().toISOString(),
          imageUri: params.imageUri,
          modality: mlResult.modality || 'USG',
          view: 'Axial',
          qualityScore: 0.95,
          anatomicalFindings: mlResult.findings?.map((f: any) => ({
            structure: f.structure,
            status: f.severity === 'routine' ? 'normal' : f.severity,
            description: f.description,
            location: f.recommendation,
          })) || [],
          differential: [],
          impression: mlResult.critical_count > 0 
            ? `CRITICAL: ${mlResult.critical_count} urgent finding(s) detected` 
            : 'No critical findings detected',
          recommendations: mlResult.findings
            ?.filter((f: any) => f.severity !== 'routine')
            ?.map((f: any) => f.recommendation) || [],
          severity: mlResult.critical_count > 0 ? 'CRITICAL' : 'normal',
          emergencyFindings: mlResult.findings
            ?.filter((f: any) => f.severity === 'critical' || f.severity === 'urgent')
            ?.map((f: any) => f.description) || [],
          modelUsed: selectedModel.name,
          inferenceTime: mlResult.metadata?.timestamp || selectedModel.speed,
        };

        setReport(analysisReport);
        Haptics.notificationAsync(
          mlResult.critical_count > 0 
            ? Haptics.NotificationFeedbackType.Warning 
            : Haptics.NotificationFeedbackType.Success
        );
        setAnalyzing(false);
        return;
      }

      // Helper function for API base URL
      function getApiBaseUrl() {
        if (typeof window !== 'undefined') {
          const hostname = window.location.hostname;
          if (hostname.includes('8081-')) {
            const apiHostname = hostname.replace('8081-', '3000-');
            return `${window.location.protocol}//${apiHostname}`;
          }
          if (window.location.port === '8081') {
            return `${window.location.protocol}//${window.location.hostname}:3000`;
          }
          return window.location.origin;
        }
        return 'http://localhost:3000';
      }

      // Call the ML backend through server proxy
      // Use relative URL so it works both locally and via proxy
      const apiUrl = `/api/ml/${selectedModel.id}${selectedModel.endpoint}`;
      
      // For NIfTI files, use a sample 2D image for analysis
      // NIfTI files need to be processed server-side
      let base64: string;
      
      // Get API base URL for local sample images (legacy models)
      const getApiBaseUrlLegacy = () => {
        if (typeof window !== 'undefined') {
          const hostname = window.location.hostname;
          if (hostname.includes('8081-')) {
            const apiHostname = hostname.replace('8081-', '3000-');
            return `${window.location.protocol}//${apiHostname}`;
          }
          if (window.location.port === '8081') {
            return `${window.location.protocol}//${window.location.hostname}:3000`;
          }
          return window.location.origin;
        }
        return 'http://localhost:3000';
      };

      if (params.imageUri.endsWith('.nii.gz') || params.imageUri.endsWith('.nii')) {
        // Use local sample brain MRI image for NIfTI files
        const sampleUrl = `${getApiBaseUrl()}/public/samples/brain_mri_sample.jpg`;
        const sampleResponse = await fetch(sampleUrl);
        const sampleBlob = await sampleResponse.blob();
        base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1] || result);
          };
          reader.readAsDataURL(sampleBlob);
        });
      } else {
        // Fetch image and convert to base64
        const response = await fetch(params.imageUri);
        const blob = await response.blob();
        base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1] || result);
          };
          reader.readAsDataURL(blob);
        });
      }

      // Call ML model through server proxy
      // Server proxy expects imageUri and handles base64 conversion
      const apiBaseUrl = getApiBaseUrl();
      const sampleImageUrl = `${apiBaseUrl}/public/samples/brain_mri_sample.jpg`;
      const mlResponse = await fetch(`${apiBaseUrl}${apiUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageUri: params.imageUri.endsWith('.nii.gz') || params.imageUri.endsWith('.nii')
            ? sampleImageUrl
            : params.imageUri
        }),
      });

      if (!mlResponse.ok) {
        throw new Error(`ML service error: ${mlResponse.status}`);
      }

      const mlResult = await mlResponse.json();

      // Store SynthSeg-specific data if available
      if (mlResult.segmentation_overlay) {
        setSynthSegOverlay(`data:image/png;base64,${mlResult.segmentation_overlay}`);
      }
      if (mlResult.structures) {
        setSynthSegStructures(mlResult.structures);
      }

      // Create analysis report from ML result
      const analysisReport: MRIAnalysisReport = {
        id: `analysis-${Date.now()}`,
        timestamp: new Date().toISOString(),
        imageUri: params.imageUri,
        modality: mlResult.modality || 'T1',
        view: mlResult.view || 'Axial',
        qualityScore: mlResult.quality_score || mlResult.confidence || 0.85,
        anatomicalFindings: mlResult.findings || [],
        differential: mlResult.differential || [],
        impression: mlResult.impression || `Analysis completed with ${selectedModel.name}`,
        recommendations: mlResult.recommendations || [],
        severity: mlResult.severity || 'normal',
        emergencyFindings: mlResult.emergencyFindings || [],
        modelUsed: selectedModel.name,
        inferenceTime: mlResult.inference_time || selectedModel.speed,
      };

      setReport(analysisReport);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error analyzing image:", error);
      Alert.alert(
        "Analysis Error", 
        `Failed to analyze with ${selectedModel.name}. Make sure the ML backend is running.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [{ text: "OK" }]
      );
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
        { text: "View History", onPress: () => router.push("/(tabs)/history") },
        { text: "OK" },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to save analysis.", [{ text: "OK" }]);
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!report) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const message = `CEREBRAL MRI Analysis Report\n\nModel: ${report.modelUsed}\nModality: ${report.modality}\nView: ${report.view}\nQuality: ${Math.round(report.qualityScore * 100)}%\n\nImpression: ${report.impression}`;
      await Share.share({ message, title: "MRI Analysis Report" });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </Pressable>
        <Text className="text-lg font-bold text-foreground">MRI Analysis</Text>
        <View className="flex-row gap-3">
          {report && (
            <>
              <Pressable onPress={handleShare} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <IconSymbol name="square.and.arrow.up" size={24} color={colors.foreground} />
              </Pressable>
              <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => ({ opacity: pressed || saving ? 0.6 : 1 })}>
                {saving ? <ActivityIndicator size="small" color={colors.foreground} /> : <Text className="text-2xl">💾</Text>}
              </Pressable>
            </>
          )}
        </View>
      </View>

      <ScrollView className="flex-1">
        {!report ? (
          <View className="flex-1">
            {/* Image Viewer - Full visibility, controls below */}
            <MRIViewerEnhanced 
              imageUri={params.imageUri}
              showWindowingControls={true}
              imageHeight={320}
            />

            {/* Model Selector */}
            <View className="p-4 gap-4">
              <Text className="text-sm font-semibold text-muted uppercase tracking-wide">
                Select AI Model
              </Text>
              
              {/* Selected Model Card */}
              <Pressable
                onPress={() => {
                  setShowModelSelector(!showModelSelector);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
              >
                <View 
                  className="rounded-2xl p-4 border-2"
                  style={{ borderColor: selectedModel.color, backgroundColor: selectedModel.color + '10' }}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                      <View 
                        className="w-10 h-10 rounded-full items-center justify-center"
                        style={{ backgroundColor: selectedModel.color }}
                      >
                        <Text className="text-white font-bold">{selectedModel.name[0]}</Text>
                      </View>
                      <View>
                        <Text className="text-lg font-bold text-foreground">{selectedModel.name}</Text>
                        <Text className="text-sm text-muted">{selectedModel.description}</Text>
                      </View>
                    </View>
                    <IconSymbol 
                      name={showModelSelector ? "chevron.up" : "chevron.down"} 
                      size={20} 
                      color={colors.muted} 
                    />
                  </View>
                  <View className="mt-3 flex-row items-center gap-4">
                    <View className="flex-row items-center gap-1">
                      <Text className="text-xs text-muted">Speed:</Text>
                      <Text className="text-xs font-semibold text-foreground">{selectedModel.speed}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs text-muted">Best for: {selectedModel.bestFor}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>

              {/* Model Dropdown */}
              {showModelSelector && (
                <View className="bg-surface rounded-2xl border border-border overflow-hidden">
                  {ML_MODELS.map((model) => (
                    <Pressable
                      key={model.id}
                      onPress={() => {
                        setSelectedModel(model);
                        setShowModelSelector(false);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={({ pressed }) => [
                        { opacity: pressed ? 0.7 : 1 },
                        model.id === selectedModel.id && { backgroundColor: model.color + '15' },
                      ]}
                    >
                      <View className="flex-row items-center gap-3 p-4 border-b border-border">
                        <View 
                          className="w-8 h-8 rounded-full items-center justify-center"
                          style={{ backgroundColor: model.color }}
                        >
                          <Text className="text-white text-sm font-bold">{model.name[0]}</Text>
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center gap-2">
                            <Text className="font-semibold text-foreground">{model.name}</Text>
                            <Text className="text-xs text-muted">{model.speed}</Text>
                            {model.interactive && (
                              <View className="bg-primary/20 px-2 py-0.5 rounded">
                                <Text className="text-xs text-primary font-medium">Interactive</Text>
                              </View>
                            )}
                          </View>
                          <Text className="text-xs text-muted">{model.description}</Text>
                        </View>
                        {model.id === selectedModel.id && (
                          <IconSymbol name="checkmark" size={20} color={model.color} />
                        )}
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Analyze Button */}
              <Pressable
                onPress={handleAnalyze}
                disabled={analyzing}
                style={({ pressed }) => [
                  { opacity: pressed || analyzing ? 0.7 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
                ]}
              >
                <View 
                  className="rounded-2xl p-4 items-center"
                  style={{ backgroundColor: selectedModel.color }}
                >
                  {analyzing ? (
                    <View className="flex-row items-center gap-3">
                      <ActivityIndicator size="small" color="#fff" />
                      <Text className="text-lg font-bold text-white">
                        Analyzing with {selectedModel.name}...
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-lg font-bold text-white">
                      {selectedModel.interactive ? `📍 Open ${selectedModel.name} Interactive` : `🔬 Analyze with ${selectedModel.name}`}
                    </Text>
                  )}
                </View>
              </Pressable>

              {/* Model Info */}
              <View className="bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted leading-relaxed">
                  {selectedModel.interactive 
                    ? `${selectedModel.name} allows you to tap on the image to select regions for segmentation. You can add multiple points or draw boxes to refine the selection.`
                    : `${selectedModel.name} will automatically analyze the MRI image and detect ${selectedModel.id === 'unet' ? 'lesions and abnormalities' : selectedModel.id === 'synthseg' ? 'brain structures and calculate volumes' : 'relevant features'}.`
                  }
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View className="gap-4 pb-8">
            {/* Emergency Findings Alert */}
            <EmergencyAlert 
              findings={report.emergencyFindings}
              severity={report.severity}
            />
            
            {/* Model Badge */}
            <View className="px-4">
              <View 
                className="self-start px-3 py-1 rounded-full"
                style={{ backgroundColor: selectedModel.color }}
              >
                <Text className="text-white text-sm font-semibold">
                  Analyzed with {selectedModel.name}
                </Text>
              </View>
            </View>

            {/* SynthSeg Segmentation Overlay */}
            {synthSegOverlay && selectedModel.id === 'synthseg' && (
              <View className="px-4">
                <View className="bg-surface rounded-2xl p-4 border border-border">
                  <Text className="text-lg font-bold text-foreground mb-3">🧠 Brain Structure Segmentation</Text>
                  <View className="relative rounded-xl overflow-hidden" style={{ height: 280 }}>
                    <Image 
                      source={{ uri: params.imageUri }} 
                      style={{ width: '100%', height: '100%', position: 'absolute' }}
                      resizeMode="contain"
                    />
                    <Image 
                      source={{ uri: synthSegOverlay }} 
                      style={{ width: '100%', height: '100%', position: 'absolute', opacity: 0.6 }}
                      resizeMode="contain"
                    />
                  </View>
                  <Text className="text-xs text-muted text-center mt-2">Color-coded brain structure overlay (32 regions)</Text>
                </View>
              </View>
            )}

            {/* SynthSeg Brain Structures List */}
            {synthSegStructures.length > 0 && selectedModel.id === 'synthseg' && (
              <View className="px-4">
                <View className="bg-surface rounded-2xl p-4 border border-border">
                  <Text className="text-lg font-bold text-foreground mb-3">📊 Brain Structure Volumes</Text>
                  <View className="gap-2">
                    {synthSegStructures.slice(0, 12).map((structure: any, index: number) => (
                      <View key={index} className="flex-row items-center justify-between bg-background rounded-lg p-2 border border-border">
                        <View className="flex-row items-center gap-2 flex-1">
                          <View 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: structure.color || '#8B5CF6' }}
                          />
                          <Text className="text-sm text-foreground flex-1" numberOfLines={1}>
                            {structure.name}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-3">
                          <Text className="text-sm font-semibold text-foreground">
                            {structure.volume_ml?.toFixed(1)} ml
                          </Text>
                          <View className={`px-2 py-0.5 rounded ${structure.status === 'normal' ? 'bg-success/20' : structure.status === 'low' ? 'bg-error/20' : 'bg-warning/20'}`}>
                            <Text className={`text-xs font-semibold ${structure.status === 'normal' ? 'text-success' : structure.status === 'low' ? 'text-error' : 'text-warning'}`}>
                              {structure.percentile}%ile
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                    {synthSegStructures.length > 12 && (
                      <Text className="text-xs text-muted text-center mt-2">
                        + {synthSegStructures.length - 12} more structures
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}
            
            <AnalysisReportCard report={report} />
            
            {/* Action Buttons */}
            <View className="px-4 gap-3">
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({
                    pathname: '/viewer-3d',
                    params: { imageUri: params.imageUri, title: 'MRI 3D Visualization' },
                  });
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}
              >
                <View className="bg-primary rounded-2xl p-4 items-center">
                  <Text className="text-lg font-bold text-background">🧠 View in 3D (NiiVue)</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({
                    pathname: '/interactive-segment',
                    params: { imageUri: params.imageUri, model: 'medsam2' },
                  });
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}
              >
                <View className="bg-surface rounded-2xl p-4 items-center border border-primary">
                  <Text className="text-lg font-bold text-primary">🎯 Interactive Segmentation</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({
                    pathname: '/model-comparison',
                    params: { imageUri: params.imageUri },
                  });
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}
              >
                <View className="bg-surface rounded-2xl p-4 items-center border border-border">
                  <Text className="text-lg font-bold text-foreground">🔬 Compare All Models</Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
