import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { segmentMRIImage } from "@/services/segmentation";
import type { SegmentationResult, MRIModality } from "@/types/mri";

export default function SegmentationScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{
    imageUri: string;
    modality?: MRIModality;
  }>();

  const [segmenting, setSegmenting] = useState(false);
  const [result, setResult] = useState<SegmentationResult | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);

  const handleSegment = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSegmenting(true);

      // Call real segmentation API
      const segmentationResult = await segmentMRIImage(
        params.imageUri,
        params.modality || "T2-weighted"
      );
      setResult(segmentationResult);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error segmenting image:", error);
      Alert.alert("Error", "Failed to segment MRI image. Please try again.", [
        { text: "OK" },
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSegmenting(false);
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

        <Text className="text-lg font-bold text-foreground">Segmentation</Text>

        <View style={{ width: 24 }} />
      </View>

      {/* Content */}
      <ScrollView className="flex-1">
        <View className="p-4 gap-4">
          {/* Image Display */}
          <View className="bg-black rounded-2xl overflow-hidden" style={{ height: 300 }}>
            <Image
              source={{ uri: params.imageUri }}
              style={{ width: "100%", height: "100%" }}
              contentFit="contain"
            />
            {result && (
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: `rgba(255, 0, 0, ${overlayOpacity * 0.3})`,
                }}
              />
            )}
          </View>

          {result && (
            <View className="bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-base font-semibold text-foreground mb-3">
                Overlay Opacity
              </Text>
              <Slider
                style={{ width: "100%", height: 40 }}
                minimumValue={0}
                maximumValue={1}
                value={overlayOpacity}
                onValueChange={setOverlayOpacity}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
              <Text className="text-sm text-muted text-center mt-2">
                {Math.round(overlayOpacity * 100)}%
              </Text>
            </View>
          )}

          {!result ? (
            <Pressable
              onPress={handleSegment}
              disabled={segmenting}
              style={({ pressed }) => [
                {
                  opacity: pressed || segmenting ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <View className="bg-primary rounded-2xl p-4 items-center">
                {segmenting ? (
                  <View className="flex-row items-center gap-3">
                    <ActivityIndicator size="small" color={colors.background} />
                    <Text className="text-lg font-bold text-background">
                      Segmenting...
                    </Text>
                  </View>
                ) : (
                  <Text className="text-lg font-bold text-background">
                    🎯 Run Segmentation
                  </Text>
                )}
              </View>
            </Pressable>
          ) : (
            <>
              {/* Statistics */}
              <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
                <Text className="text-lg font-bold text-foreground">
                  Segmentation Statistics
                </Text>

                <View className="flex-row justify-between items-center py-2 border-b border-border">
                  <Text className="text-sm text-muted">Total Pixels</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {result.statistics.totalPixels.toLocaleString()}
                  </Text>
                </View>

                <View className="flex-row justify-between items-center py-2 border-b border-border">
                  <Text className="text-sm text-muted">Segmented Pixels</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {result.statistics.segmentedPixels.toLocaleString()}
                  </Text>
                </View>

                <View className="flex-row justify-between items-center py-2">
                  <Text className="text-sm text-muted">Segmented Area</Text>
                  <Text className="text-sm font-semibold text-primary">
                    {result.statistics.segmentedPercentage.toFixed(2)}%
                  </Text>
                </View>
              </View>

              {/* Regions */}
              <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
                <Text className="text-lg font-bold text-foreground">Detected Regions</Text>

                {result.statistics.regions.map((region, index) => (
                  <View
                    key={index}
                    className="bg-background rounded-lg p-3 border border-border"
                  >
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className="text-sm font-semibold text-foreground">
                        {region.label}
                      </Text>
                      <Text className="text-sm font-semibold text-primary">
                        {region.percentage.toFixed(2)}%
                      </Text>
                    </View>
                    <Text className="text-xs text-muted">
                      Area: {region.area.toLocaleString()} pixels
                    </Text>
                  </View>
                ))}
              </View>

              {/* Info */}
              <View className="bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted leading-relaxed">
                  Segmentation highlights regions of interest in the MRI scan, such as
                  hyperintense areas that may indicate lesions, tumors, or other abnormalities.
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
