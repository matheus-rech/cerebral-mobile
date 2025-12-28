import { ScrollView, Text, View, Pressable, Alert, RefreshControl } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { getAnalysisHistory, deleteAnalysisFromHistory } from "@/services/storage";
import type { MRIAnalysisReport, FindingStatus } from "@/types/mri";

function getStatusColor(status: FindingStatus): string {
  switch (status) {
    case "normal":
      return "bg-success";
    case "abnormal":
      return "bg-error";
    case "uncertain":
      return "bg-warning";
  }
}

function getStatusIcon(status: FindingStatus): string {
  switch (status) {
    case "normal":
      return "✅";
    case "abnormal":
      return "⚠️";
    case "uncertain":
      return "❓";
  }
}

export default function HistoryScreen() {
  const colors = useColors();
  const [history, setHistory] = useState<MRIAnalysisReport[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadHistory = async () => {
    try {
      const historyData = await getAnalysisHistory();
      setHistory(historyData);
    } catch (error) {
      console.error("Error loading history:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const handleDelete = async (analysisId: string) => {
    Alert.alert(
      "Delete Analysis",
      "Are you sure you want to delete this analysis?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await deleteAnalysisFromHistory(analysisId);
              await loadHistory();
            } catch (error) {
              console.error("Error deleting analysis:", error);
              Alert.alert("Error", "Failed to delete analysis", [{ text: "OK" }]);
            }
          },
        },
      ]
    );
  };

  const toggleExpand = (analysisId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedId(expandedId === analysisId ? null : analysisId);
  };

  if (history.length === 0) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center gap-4">
          <Text className="text-6xl">📋</Text>
          <Text className="text-xl font-bold text-foreground">No Analysis History</Text>
          <Text className="text-sm text-muted text-center">
            Your analyzed MRI scans will appear here
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View className="flex-1 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Analysis History</Text>
            <Text className="text-sm text-muted">
              {history.length} {history.length === 1 ? "analysis" : "analyses"}
            </Text>
          </View>

          {/* History List */}
          <View className="gap-4">
            {history.map((report) => {
              const hasAbnormalities = report.anatomicalFindings.some(
                (f) => f.status === "abnormal"
              );
              const overallStatus: FindingStatus = hasAbnormalities ? "abnormal" : "normal";
              const isExpanded = expandedId === report.id;

              return (
                <View
                  key={report.id}
                  className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden"
                >
                  <Pressable
                    onPress={() => toggleExpand(report.id)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <View className="p-4">
                      <View className="flex-row gap-4">
                        {/* Thumbnail */}
                        <View className="w-20 h-20 bg-black rounded-lg overflow-hidden">
                          <Image
                            source={{ uri: report.imageUri }}
                            style={{ width: "100%", height: "100%" }}
                            contentFit="cover"
                          />
                        </View>

                        {/* Info */}
                        <View className="flex-1 gap-2">
                          <View className="flex-row items-center justify-between">
                            <Text className="text-base font-bold text-foreground">
                              {report.modality}
                            </Text>
                            <View
                              className={`${getStatusColor(overallStatus)} px-2 py-1 rounded-full flex-row items-center gap-1`}
                            >
                              <Text className="text-xs">{getStatusIcon(overallStatus)}</Text>
                              <Text className="text-xs font-semibold text-white">
                                {overallStatus.toUpperCase()}
                              </Text>
                            </View>
                          </View>

                          <Text className="text-sm text-muted">
                            {report.view} • Quality: {Math.round(report.qualityScore * 100)}%
                          </Text>

                          <Text className="text-xs text-muted">
                            {new Date(report.timestamp).toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <View className="border-t border-border p-4 gap-3">
                      <Text className="text-sm font-semibold text-foreground">Impression</Text>
                      <Text className="text-sm text-muted leading-relaxed">
                        {report.impression}
                      </Text>

                      <Text className="text-sm font-semibold text-foreground mt-2">
                        Findings ({report.anatomicalFindings.length})
                      </Text>
                      <View className="gap-2">
                        {report.anatomicalFindings.map((finding, index) => (
                          <View key={index} className="flex-row items-center gap-2">
                            <Text className="text-sm">{getStatusIcon(finding.status)}</Text>
                            <Text className="text-sm text-foreground flex-1">
                              {finding.structure}
                            </Text>
                          </View>
                        ))}
                      </View>

                      <Pressable
                        onPress={() => handleDelete(report.id)}
                        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                      >
                        <View className="bg-error/10 rounded-lg p-3 flex-row items-center justify-center gap-2 mt-2">
                          <IconSymbol name="trash" size={18} color={colors.error} />
                          <Text className="text-sm font-semibold text-error">Delete</Text>
                        </View>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
