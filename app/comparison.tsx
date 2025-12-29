import { useLocalSearchParams, router } from "expo-router";
import { MRIComparisonView } from "@/components/mri-comparison-view";

export default function ComparisonScreen() {
  const params = useLocalSearchParams<{
    imageUri: string;
    overlayUri?: string;
  }>();

  return (
    <MRIComparisonView
      originalUri={params.imageUri}
      overlayUri={params.overlayUri}
      onClose={() => router.back()}
    />
  );
}
