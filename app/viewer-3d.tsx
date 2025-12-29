import { useState } from "react";
import { View, Text, Pressable, Dimensions, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { NiiVueViewer } from "@/components/niivue-viewer";
import { useColors } from "@/hooks/use-colors";

// Available AI models for analysis
const AI_MODELS = [
  {
    id: "unet",
    name: "UNet",
    description: "Lesion detection & classification",
    useCase: "Best for: Detecting tumors, lesions, abnormalities",
    speed: "Fast (~0.2s)",
    color: "#0a7ea4",
  },
  {
    id: "medsam2",
    name: "MedSAM2",
    description: "Interactive segmentation with prompts",
    useCase: "Best for: Precise region selection with point/box prompts",
    speed: "Fast (~0.2s)",
    color: "#22c55e",
  },
  {
    id: "sam3",
    name: "SAM3",
    description: "Zero-shot segmentation",
    useCase: "Best for: Automatic structure detection without training",
    speed: "Fast (~0.2s)",
    color: "#f59e0b",
  },
  {
    id: "synthseg",
    name: "SynthSeg",
    description: "Brain structure volumetrics",
    useCase: "Best for: Full brain anatomy analysis & volume measurements",
    speed: "Thorough (~15s)",
    color: "#8b5cf6",
  },
];

export default function Viewer3DScreen() {
  const params = useLocalSearchParams<{
    imageUri: string;
    segmentationUri?: string;
    title?: string;
  }>();
  const colors = useColors();
  const [selectedModel, setSelectedModel] = useState<string>("unet");
  const [showModelPicker, setShowModelPicker] = useState(false);

  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
  // Make viewer take most of the screen
  const viewerWidth = screenWidth - 32;
  const viewerHeight = screenHeight * 0.65;

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
    setShowModelPicker(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleAnalyze = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate to analysis with selected model
    router.push({
      pathname: "/analysis",
      params: {
        imageUri: params.imageUri,
        model: selectedModel,
      },
    });
  };

  const currentModel = AI_MODELS.find((m) => m.id === selectedModel)!;

  if (!params.imageUri) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <Text className="text-xl font-bold text-foreground mb-2">
            No Image Provided
          </Text>
          <Pressable onPress={handleBack}>
            <View className="bg-primary px-6 py-3 rounded-full">
              <Text className="text-background font-semibold">Go Back</Text>
            </View>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <View className="flex-1">
        {/* Compact Header */}
        <View className="flex-row items-center px-4 py-2 gap-3">
          <Pressable onPress={handleBack} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <View className="bg-surface p-2 rounded-full border border-border">
              <Text className="text-foreground text-base">←</Text>
            </View>
          </Pressable>
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground" numberOfLines={1}>
              {params.title || "3D Brain Viewer"}
            </Text>
          </View>
        </View>

        {/* Full-width NiiVue Viewer */}
        <View style={[styles.viewerContainer, { height: viewerHeight }]}>
          <NiiVueViewer
            imageUri={params.imageUri}
            segmentationUri={params.segmentationUri}
            width={viewerWidth}
            height={viewerHeight}
          />
        </View>

        {/* Model Selector - Always visible at bottom */}
        <View className="px-4 py-3 bg-background border-t border-border">
          {/* Current Model Display */}
          <Pressable
            onPress={() => setShowModelPicker(!showModelPicker)}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <View 
              className="flex-row items-center justify-between p-3 rounded-xl"
              style={{ backgroundColor: currentModel.color + "20" }}
            >
              <View className="flex-row items-center gap-3">
                <View 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: currentModel.color }}
                />
                <View>
                  <Text className="text-base font-bold text-foreground">
                    {currentModel.name}
                  </Text>
                  <Text className="text-xs text-muted">
                    {currentModel.description}
                  </Text>
                </View>
              </View>
              <Text className="text-muted text-lg">
                {showModelPicker ? "▲" : "▼"}
              </Text>
            </View>
          </Pressable>

          {/* Model Picker Dropdown */}
          {showModelPicker && (
            <View className="mt-2 bg-surface rounded-xl border border-border overflow-hidden">
              {AI_MODELS.map((model) => (
                <Pressable
                  key={model.id}
                  onPress={() => handleModelSelect(model.id)}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    backgroundColor: selectedModel === model.id ? model.color + "15" : "transparent",
                  })}
                >
                  <View className="p-3 border-b border-border/50">
                    <View className="flex-row items-center gap-3">
                      <View
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: model.color }}
                      />
                      <View className="flex-1">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-base font-bold text-foreground">
                            {model.name}
                          </Text>
                          <Text className="text-xs text-muted">{model.speed}</Text>
                        </View>
                        <Text className="text-xs text-muted mt-0.5">
                          {model.description}
                        </Text>
                        <Text className="text-xs text-primary mt-1">
                          {model.useCase}
                        </Text>
                      </View>
                      {selectedModel === model.id && (
                        <Text className="text-primary text-lg">✓</Text>
                      )}
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <View className="flex-row gap-2 mt-3">
            {/* Interactive Segment Button (for MedSAM2/SAM3) */}
            {(selectedModel === 'medsam2' || selectedModel === 'sam3') && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push({
                    pathname: '/interactive-segment',
                    params: {
                      imageUri: params.imageUri,
                      model: selectedModel,
                    },
                  });
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
              >
                <View
                  className="p-4 rounded-xl flex-row items-center justify-center gap-2 border-2"
                  style={{ borderColor: currentModel.color, backgroundColor: currentModel.color + '15' }}
                >
                  <Text style={{ color: currentModel.color }} className="font-bold text-base">
                    📍 Interactive
                  </Text>
                </View>
              </Pressable>
            )}

            {/* Analyze Button */}
            <Pressable
              onPress={handleAnalyze}
              style={({ pressed }) => ({
                flex: selectedModel === 'medsam2' || selectedModel === 'sam3' ? 1 : undefined,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <View
                className="p-4 rounded-xl flex-row items-center justify-center gap-2"
                style={{ backgroundColor: currentModel.color }}
              >
                <Text className="text-white font-bold text-base">
                  {selectedModel === 'medsam2' || selectedModel === 'sam3' ? '🔬 Auto' : `Analyze with ${currentModel.name}`}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  viewerContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#0a0a0a",
  },
});
