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
        pathname: "/analysis" as any,
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
                          <IconSymbol name="arrow.left" size={20} color={colors.background} />
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
