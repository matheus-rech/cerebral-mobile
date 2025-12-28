import { useState } from "react";
import { View, Text, ScrollView, Pressable, Dimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { NiiVueViewer } from "@/components/niivue-viewer";
import { useColors } from "@/hooks/use-colors";

/**
 * 3D Viewer Screen
 * Interactive 3D visualization of MRI scans using NiiVue
 */
export default function Viewer3DScreen() {
  const params = useLocalSearchParams<{
    imageUri: string;
    segmentationUri?: string;
    title?: string;
  }>();
  const colors = useColors();

  const { width: screenWidth } = Dimensions.get("window");
  const viewerSize = Math.min(screenWidth - 32, 600);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  if (!params.imageUri) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <Text className="text-xl font-bold text-foreground mb-2">
            No Image Provided
          </Text>
          <Text className="text-base text-muted text-center mb-6">
            Please provide an MRI image to visualize.
          </Text>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View className="bg-primary px-6 py-3 rounded-full">
              <Text className="text-background font-semibold">Go Back</Text>
            </View>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 p-4 gap-6">
          {/* Header */}
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View className="bg-surface p-3 rounded-full border border-border">
                <Text className="text-foreground text-lg">←</Text>
              </View>
            </Pressable>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">
                {params.title || "3D Brain Viewer"}
              </Text>
              <Text className="text-sm text-muted mt-1">
                Interactive 3D visualization
              </Text>
            </View>
          </View>

          {/* 3D Viewer */}
          <View className="bg-surface rounded-2xl overflow-hidden border border-border">
            <NiiVueViewer
              imageUri={params.imageUri}
              segmentationUri={params.segmentationUri}
              width={viewerSize}
              height={viewerSize}
            />
          </View>

          {/* Instructions */}
          <View className="bg-surface rounded-2xl p-6 border border-border gap-4">
            <Text className="text-lg font-bold text-foreground">
              🎮 Viewer Controls
            </Text>

            <View className="gap-3">
              <View className="flex-row gap-3">
                <View className="bg-primary/20 px-3 py-1 rounded-lg">
                  <Text className="text-primary font-semibold text-sm">
                    Axial
                  </Text>
                </View>
                <Text className="text-sm text-muted flex-1">
                  View brain from top-down (horizontal slices)
                </Text>
              </View>

              <View className="flex-row gap-3">
                <View className="bg-primary/20 px-3 py-1 rounded-lg">
                  <Text className="text-primary font-semibold text-sm">
                    Coronal
                  </Text>
                </View>
                <Text className="text-sm text-muted flex-1">
                  View brain from front-back (vertical slices)
                </Text>
              </View>

              <View className="flex-row gap-3">
                <View className="bg-primary/20 px-3 py-1 rounded-lg">
                  <Text className="text-primary font-semibold text-sm">
                    Sagittal
                  </Text>
                </View>
                <Text className="text-sm text-muted flex-1">
                  View brain from side (left-right slices)
                </Text>
              </View>

              <View className="flex-row gap-3">
                <View className="bg-primary/20 px-3 py-1 rounded-lg">
                  <Text className="text-primary font-semibold text-sm">3D</Text>
                </View>
                <Text className="text-sm text-muted flex-1">
                  Interactive 3D volume rendering
                </Text>
              </View>

              {params.segmentationUri && (
                <View className="flex-row gap-3">
                  <View className="bg-primary/20 px-3 py-1 rounded-lg">
                    <Text className="text-primary font-semibold text-sm">
                      Toggle Seg
                    </Text>
                  </View>
                  <Text className="text-sm text-muted flex-1">
                    Show/hide segmentation overlay
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Features */}
          <View className="bg-surface rounded-2xl p-6 border border-border gap-3">
            <Text className="text-lg font-bold text-foreground mb-2">
              ✨ Features
            </Text>

            <View className="flex-row items-start gap-3">
              <Text className="text-foreground text-base">🔄</Text>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">
                  Interactive Rotation
                </Text>
                <Text className="text-sm text-muted mt-1">
                  Drag to rotate the 3D view in any direction
                </Text>
              </View>
            </View>

            <View className="flex-row items-start gap-3">
              <Text className="text-foreground text-base">🔍</Text>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">
                  Zoom & Pan
                </Text>
                <Text className="text-sm text-muted mt-1">
                  Pinch to zoom, two-finger drag to pan
                </Text>
              </View>
            </View>

            <View className="flex-row items-start gap-3">
              <Text className="text-foreground text-base">📍</Text>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">
                  Crosshair Navigation
                </Text>
                <Text className="text-sm text-muted mt-1">
                  Click to navigate through slices
                </Text>
              </View>
            </View>

            <View className="flex-row items-start gap-3">
              <Text className="text-foreground text-base">🎨</Text>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">
                  Overlay Visualization
                </Text>
                <Text className="text-sm text-muted mt-1">
                  View segmentation results overlaid on original scan
                </Text>
              </View>
            </View>
          </View>

          {/* Technical Info */}
          <View className="bg-surface rounded-2xl p-6 border border-border">
            <Text className="text-sm text-muted leading-relaxed">
              <Text className="font-semibold text-foreground">
                Powered by NiiVue
              </Text>
              {"\n"}
              NiiVue is a WebGL-based medical image viewer that provides
              high-performance 3D visualization of neuroimaging data directly in
              the browser. It supports multiple viewing modes, interactive
              controls, and real-time rendering of volumetric data.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
