import { ScrollView, Text, View, Pressable, Alert, Switch } from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getSettings, saveSettings, clearAnalysisHistory } from "@/services/storage";
import type { AppSettings } from "@/services/storage";

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>({
    autoSaveHistory: true,
    darkMode: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const loadedSettings = await getSettings();
      setSettings(loadedSettings);
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const updateSetting = async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const updatedSettings = { ...settings, [key]: value };
      setSettings(updatedSettings);
      await saveSettings(updatedSettings);
    } catch (error) {
      console.error("Error updating setting:", error);
      Alert.alert("Error", "Failed to save settings", [{ text: "OK" }]);
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      "Clear History",
      "Are you sure you want to delete all analysis history? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await clearAnalysisHistory();
              Alert.alert("Success", "Analysis history cleared", [{ text: "OK" }]);
            } catch (error) {
              console.error("Error clearing history:", error);
              Alert.alert("Error", "Failed to clear history", [{ text: "OK" }]);
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Settings</Text>
            <Text className="text-sm text-muted">Configure app preferences</Text>
          </View>

          {/* Model Configuration */}
          <View className="gap-4">
            <Text className="text-lg font-bold text-foreground">Models</Text>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/model-config');
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className="bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-base font-semibold text-foreground mb-1">
                  🧠 Model Configuration
                </Text>
                <Text className="text-sm text-muted">
                  Select models and adjust parameters for analysis
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/ml-settings');
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className="bg-primary/10 rounded-2xl p-4 border border-primary">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground mb-1">
                      ⚙️ ML Backend & Processing
                    </Text>
                    <Text className="text-sm text-muted">
                      Switch between local and NeuroSAM3 cloud, configure CT windowing, colormaps
                    </Text>
                  </View>
                  <Text className="text-primary font-semibold">→</Text>
                </View>
              </View>
            </Pressable>
          </View>

          {/* Analysis Settings */}
          <View className="gap-4">
            <Text className="text-lg font-bold text-foreground">Analysis</Text>

            <View className="bg-surface rounded-2xl border border-border overflow-hidden">
              <View className="p-4 flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground mb-1">
                    Auto-save History
                  </Text>
                  <Text className="text-sm text-muted">
                    Automatically save analysis results to history
                  </Text>
                </View>
                <Switch
                  value={settings.autoSaveHistory}
                  onValueChange={(value) => updateSetting("autoSaveHistory", value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>
            </View>
          </View>

          {/* Advanced Features */}
          <View className="gap-4">
            <Text className="text-lg font-bold text-foreground">Advanced</Text>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/async-demo');
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className="bg-surface rounded-2xl p-4 border border-border flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground mb-1">
                    🚀 Async Processing Demo
                  </Text>
                  <Text className="text-sm text-muted">
                    Test background ML processing with progress tracking
                  </Text>
                </View>
                <Text className="text-primary font-semibold">→</Text>
              </View>
            </Pressable>
          </View>

          {/* Appearance Settings */}
          <View className="gap-4">
            <Text className="text-lg font-bold text-foreground">Appearance</Text>

            <View className="bg-surface rounded-2xl border border-border overflow-hidden">
              <View className="p-4 flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground mb-1">
                    Dark Mode
                  </Text>
                  <Text className="text-sm text-muted">
                    Use dark theme (requires app restart)
                  </Text>
                </View>
                <Switch
                  value={settings.darkMode}
                  onValueChange={(value) => updateSetting("darkMode", value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>
            </View>
          </View>

          {/* Data Management */}
          <View className="gap-4">
            <Text className="text-lg font-bold text-foreground">Data</Text>

            <Pressable
              onPress={handleClearHistory}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className="bg-error/10 rounded-2xl p-4 border border-error">
                <Text className="text-base font-semibold text-error mb-1">
                  Clear Analysis History
                </Text>
                <Text className="text-sm text-error/70">
                  Delete all saved analysis reports
                </Text>
              </View>
            </Pressable>
          </View>

          {/* About */}
          <View className="gap-4">
            <Text className="text-lg font-bold text-foreground">About</Text>

            <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
              <View>
                <Text className="text-base font-semibold text-foreground mb-1">
                  CEREBRAL Mobile
                </Text>
                <Text className="text-sm text-muted">Version 1.0.0</Text>
              </View>

              <View className="border-t border-border pt-3">
                <Text className="text-sm text-muted leading-relaxed">
                  AI-powered neuroimaging analysis system combining Claude's vision capabilities
                  with HuggingFace MRI datasets for real-time brain scan analysis.
                </Text>
              </View>

              <View className="border-t border-border pt-3">
                <Text className="text-xs text-muted">
                  ⚠️ For research and educational purposes only. Not for clinical use.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
