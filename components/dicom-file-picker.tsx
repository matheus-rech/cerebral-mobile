import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/use-colors";
import { parseDICOMFile, formatPatientInfo, formatStudyInfo, type DICOMImage } from "@/services/dicom-parser";

interface DICOMFilePickerProps {
  onDICOMParsed: (dicomImage: DICOMImage) => void;
}

/**
 * DICOM File Picker Component
 * Allows users to select and parse DICOM files from their device
 */
export function DICOMFilePicker({ onDICOMParsed }: DICOMFilePickerProps) {
  const colors = useColors();
  const [parsing, setParsing] = useState(false);

  const handlePickDICOM = async () => {
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Pick DICOM file
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/dicom", "*/*"], // Accept DICOM and all files (DICOM often has no extension)
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];

      if (!file) {
        return;
      }

      setParsing(true);

      try {
        // Fetch file as blob
        const response = await fetch(file.uri);
        const blob = await response.blob();

        // Parse DICOM file
        const dicomImage = await parseDICOMFile(blob);

        // Success
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        onDICOMParsed(dicomImage);
      } catch (error) {
        console.error("Error parsing DICOM:", error);
        Alert.alert(
          "DICOM Parse Error",
          "Failed to parse DICOM file. Please ensure it is a valid DICOM file from a medical imaging system.",
          [{ text: "OK" }]
        );
      } finally {
        setParsing(false);
      }
    } catch (error) {
      console.error("Error picking DICOM file:", error);
      setParsing(false);
    }
  };

  return (
    <Pressable
      onPress={handlePickDICOM}
      disabled={parsing}
      style={({ pressed }) => ({
        opacity: pressed || parsing ? 0.7 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <View className="bg-primary rounded-2xl p-6 border-2 border-primary/20">
        <View className="flex-row items-center gap-4">
          <View className="bg-background/20 p-4 rounded-full">
            <Text className="text-3xl">🏥</Text>
          </View>
          <View className="flex-1">
            {parsing ? (
              <View className="flex-row items-center gap-3">
                <ActivityIndicator size="small" color={colors.background} />
                <Text className="text-lg font-bold text-background">
                  Parsing DICOM File...
                </Text>
              </View>
            ) : (
              <>
                <Text className="text-xl font-bold text-background">
                  Upload DICOM File
                </Text>
                <Text className="text-sm text-background/80 mt-1">
                  From PACS or medical imaging system
                </Text>
              </>
            )}
          </View>
        </View>

        {!parsing && (
          <View className="mt-4 bg-background/10 rounded-xl p-3">
            <Text className="text-xs text-background/90 leading-relaxed">
              <Text className="font-semibold">Supported formats:</Text> DICOM (.dcm, .dicom) files from CT, MRI, and other medical imaging modalities
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
