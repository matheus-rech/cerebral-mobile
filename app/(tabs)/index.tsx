import { ScrollView, Text, View, Pressable, ActivityIndicator, Alert } from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { loadRandomSample, AVAILABLE_DATASETS } from "@/services/huggingface";
import type { MRIImage } from "@/types/mri";

export default function HomeScreen() {
  const colors = useColors();
  const [loading, setLoading] = useState(false);
  const [loadingDataset, setLoadingDataset] = useState<string | null>(null);

  const handleLoadFromDataset = async (datasetId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setLoadingDataset(datasetId);
      setLoading(true);

      const mriImage = await loadRandomSample(datasetId);
      
      // Navigate to analysis screen with the loaded image
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
      setLoading(false);
      setLoadingDataset(null);
    }
  };

  const handleUploadImage = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please grant photo library access to upload MRI images.",
          [{ text: "OK" }]
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        
        // Navigate to analysis screen with the uploaded image
        router.push({
          pathname: "/analysis",
          params: {
            imageUri,
            source: "upload",
          },
        });
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      Alert.alert("Error", "Failed to upload image. Please try again.", [{ text: "OK" }]);
    }
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-6">
          {/* Hero Section */}
          <View className="items-center gap-3 pt-4">
            <Text className="text-4xl font-bold text-foreground">🧠 CEREBRAL</Text>
            <Text className="text-base text-muted text-center leading-relaxed">
              AI-powered neuroimaging analysis for brain MRI scans
            </Text>
          </View>

          {/* Quick Actions */}
          <View className="gap-4">
            <Text className="text-xl font-bold text-foreground">Quick Actions</Text>

            {/* Upload Image Card */}
            <Pressable
              onPress={handleUploadImage}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <View className="bg-primary rounded-2xl p-6 shadow-sm">
                <View className="flex-row items-center gap-4">
                  <View className="bg-background/20 rounded-full p-3">
                    <IconSymbol name="photo" size={32} color={colors.background} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xl font-bold text-background mb-1">
                      Upload MRI Image
                    </Text>
                    <Text className="text-sm text-background/80">
                      Analyze your own brain scan
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>

            {/* Dataset Cards */}
            <Text className="text-lg font-semibold text-foreground mt-2">
              Load from HuggingFace Datasets
            </Text>

            {AVAILABLE_DATASETS.map((dataset) => (
              <Pressable
                key={dataset.id}
                onPress={() => handleLoadFromDataset(dataset.id)}
                disabled={loading}
                style={({ pressed }) => [
                  {
                    opacity: pressed || loading ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <View className="bg-surface rounded-2xl p-4 border border-border shadow-sm">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-lg font-semibold text-foreground mb-1">
                        {dataset.name}
                      </Text>
                      <Text className="text-sm text-muted">{dataset.description}</Text>
                    </View>
                    
                    {loadingDataset === dataset.id ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <View className="bg-primary/10 rounded-full p-2">
                        <IconSymbol name="arrow.left" size={20} color={colors.primary} />
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            ))}
          </View>

          {/* Info Section */}
          <View className="bg-surface rounded-2xl p-4 border border-border mt-4">
            <Text className="text-sm font-semibold text-foreground mb-2">
              ⚠️ Research Use Only
            </Text>
            <Text className="text-xs text-muted leading-relaxed">
              This application is designed for research and educational purposes. Results should
              not be used for clinical decision-making without proper medical consultation.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
