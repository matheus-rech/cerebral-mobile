import { View, Text, Pressable, ActivityIndicator, Alert, Share } from "react-native";
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
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
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
                    pathname: "/segmentation" as any,
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
      <View className="flex-1">
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
          <View className="gap-4">
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
      </View>
    </ScreenContainer>
  );
}
