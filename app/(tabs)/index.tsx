import { ScrollView, Text, View, Pressable, ActivityIndicator, Alert, Platform, StyleSheet } from "react-native";
import { useState, useCallback } from "react";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { AVAILABLE_DATASETS, loadRandomSample } from "@/services/huggingface";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function HomeScreen() {
  const colors = useColors();
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [dicomLoading, setDicomLoading] = useState(false);

  const haptic = useCallback((style = Haptics.ImpactFeedbackStyle.Medium) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(style);
    }
  }, []);

  const handleLoadDataset = async (datasetId: string) => {
    haptic();
    setLoading(true);
    setLoadingId(datasetId);

    try {
      const mriImage = await loadRandomSample(datasetId);
      router.push({
        pathname: "/analysis",
        params: { imageUri: mriImage.uri, source: "huggingface", datasetId },
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
    haptic(Haptics.ImpactFeedbackStyle.Light);
    setDicomLoading(true);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["*/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets[0]) {
        setDicomLoading(false);
        return;
      }

      const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const dataUri = `data:application/dicom;base64,${base64}`;

      router.push({
        pathname: "/analysis",
        params: { imageUri: dataUri, source: "dicom" },
      });
    } catch (error) {
      console.error("DICOM error:", error);
      Alert.alert("Error", "Failed to process DICOM file.");
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
    <ScreenContainer>
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 120 }} 
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={[styles.logoGlow, { backgroundColor: colors.primary + "30" }]} />
            <Text style={styles.logoEmoji}>🧠</Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>CEREBRAL</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Advanced Neuroimaging Intelligence
          </Text>
          <View style={[styles.badge, { backgroundColor: colors.success + "20" }]}>
            <View style={[styles.badgeDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.badgeText, { color: colors.success }]}>4 AI Models Active</Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* Primary Action - DICOM Upload */}
          <Pressable 
            onPress={handleDICOM} 
            disabled={dicomLoading}
            style={({ pressed }) => [
              styles.primaryCard,
              { backgroundColor: colors.primary },
              pressed && styles.cardPressed,
            ]}
          >
            <View style={styles.primaryCardGlow} />
            <View style={styles.primaryCardContent}>
              <View style={styles.primaryIconContainer}>
                <Text style={styles.primaryIcon}>🏥</Text>
              </View>
              <View style={styles.primaryTextContainer}>
                <Text style={styles.primaryTitle}>
                  {dicomLoading ? "Processing..." : "Import Medical Image"}
                </Text>
                <Text style={styles.primarySubtitle}>
                  DICOM, NIfTI, or standard image formats
                </Text>
              </View>
              {dicomLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View style={styles.primaryArrow}>
                  <Text style={{ color: "#fff", fontSize: 20 }}>→</Text>
                </View>
              )}
            </View>
          </Pressable>

          {/* Secondary Actions Grid */}
          <View style={styles.gridContainer}>
            <Pressable 
              onPress={handle3DViewer}
              style={({ pressed }) => [
                styles.gridCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.cardPressed,
              ]}
            >
              <View style={[styles.gridIconBg, { backgroundColor: colors.primary + "15" }]}>
                <Text style={styles.gridIcon}>🧊</Text>
              </View>
              <Text style={[styles.gridTitle, { color: colors.foreground }]}>3D Viewer</Text>
              <Text style={[styles.gridSubtitle, { color: colors.muted }]}>MPR Navigation</Text>
            </Pressable>

            <Pressable 
              onPress={() => { haptic(); router.push("/model-comparison"); }}
              style={({ pressed }) => [
                styles.gridCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.cardPressed,
              ]}
            >
              <View style={[styles.gridIconBg, { backgroundColor: colors.warning + "15" }]}>
                <Text style={styles.gridIcon}>⚖️</Text>
              </View>
              <Text style={[styles.gridTitle, { color: colors.foreground }]}>Compare</Text>
              <Text style={[styles.gridSubtitle, { color: colors.muted }]}>Multi-Model</Text>
            </Pressable>
          </View>

          {/* Datasets Section */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Sample Datasets
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
              From HuggingFace
            </Text>
          </View>

          <View style={styles.datasetsContainer}>
            {AVAILABLE_DATASETS.map((dataset, index) => (
              <Pressable 
                key={dataset.id} 
                onPress={() => handleLoadDataset(dataset.id)} 
                disabled={loading}
                style={({ pressed }) => [
                  styles.datasetCard,
                  { 
                    backgroundColor: colors.surface, 
                    borderColor: colors.border,
                    opacity: loading && loadingId !== dataset.id ? 0.5 : 1,
                  },
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={[
                  styles.datasetIndex, 
                  { backgroundColor: colors.primary + "15" }
                ]}>
                  <Text style={[styles.datasetIndexText, { color: colors.primary }]}>
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                </View>
                <View style={styles.datasetInfo}>
                  <Text style={[styles.datasetName, { color: colors.foreground }]} numberOfLines={1}>
                    {dataset.name}
                  </Text>
                  <Text style={[styles.datasetRepo, { color: colors.muted }]} numberOfLines={1}>
                    {dataset.repoId}
                  </Text>
                </View>
                {loading && loadingId === dataset.id ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <View style={[styles.datasetArrow, { backgroundColor: colors.primary + "10" }]}>
                    <IconSymbol name="chevron.right" size={16} color={colors.primary} />
                  </View>
                )}
              </Pressable>
            ))}
          </View>

          {/* ML Models Status */}
          <View style={[styles.modelsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modelsHeader}>
              <Text style={[styles.modelsTitle, { color: colors.foreground }]}>
                AI Analysis Pipeline
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: colors.success + "20" }]}>
                <Text style={[styles.statusText, { color: colors.success }]}>Ready</Text>
              </View>
            </View>
            <View style={styles.modelsList}>
              {[
                { name: "UNet", desc: "Lesion Detection", color: "#EF4444" },
                { name: "MedSAM2", desc: "Interactive Segmentation", color: "#F59E0B" },
                { name: "SAM3", desc: "Zero-Shot Analysis", color: "#8B5CF6" },
                { name: "SynthSeg", desc: "Brain Structures", color: "#06B6D4" },
              ].map((model) => (
                <View key={model.name} style={styles.modelItem}>
                  <View style={[styles.modelDot, { backgroundColor: model.color }]} />
                  <View style={styles.modelInfo}>
                    <Text style={[styles.modelName, { color: colors.foreground }]}>{model.name}</Text>
                    <Text style={[styles.modelDesc, { color: colors.muted }]}>{model.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  logoContainer: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logoGlow: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  logoEmoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 16,
    gap: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  primaryCard: {
    borderRadius: 20,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#0a7ea4",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  primaryCardGlow: {
    position: "absolute",
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  primaryCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 16,
  },
  primaryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  primaryIcon: {
    fontSize: 28,
  },
  primaryTextContainer: {
    flex: 1,
  },
  primaryTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  primarySubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    marginTop: 2,
  },
  primaryArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  gridContainer: {
    flexDirection: "row",
    gap: 12,
  },
  gridCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  gridIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  gridIcon: {
    fontSize: 24,
  },
  gridTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  gridSubtitle: {
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  sectionSubtitle: {
    fontSize: 13,
  },
  datasetsContainer: {
    gap: 10,
  },
  datasetCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  datasetIndex: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  datasetIndexText: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  datasetInfo: {
    flex: 1,
  },
  datasetName: {
    fontSize: 15,
    fontWeight: "600",
  },
  datasetRepo: {
    fontSize: 12,
    marginTop: 2,
  },
  datasetArrow: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  modelsCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  modelsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modelsTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modelsList: {
    gap: 12,
  },
  modelItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modelInfo: {
    flex: 1,
  },
  modelName: {
    fontSize: 14,
    fontWeight: "600",
  },
  modelDesc: {
    fontSize: 12,
    marginTop: 1,
  },
});
