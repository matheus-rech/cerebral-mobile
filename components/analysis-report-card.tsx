/**
 * Analysis Report Card Component
 * Displays structured MRI analysis results
 */

import { View, Text, ScrollView } from 'react-native';
import type { MRIAnalysisReport, FindingStatus } from '@/types/mri';
import { cn } from '@/lib/utils';

interface AnalysisReportCardProps {
  report: MRIAnalysisReport;
  className?: string;
}

function getStatusIcon(status: FindingStatus): string {
  switch (status) {
    case 'normal':
      return '✅';
    case 'abnormal':
      return '⚠️';
    case 'uncertain':
      return '❓';
  }
}

function getStatusColor(status: FindingStatus): string {
  switch (status) {
    case 'normal':
      return 'text-success';
    case 'abnormal':
      return 'text-error';
    case 'uncertain':
      return 'text-warning';
  }
}

export function AnalysisReportCard({ report, className }: AnalysisReportCardProps) {
  const qualityPercentage = Math.round(report.qualityScore * 100);
  const hasAbnormalities = report.anatomicalFindings.some((f) => f.status === 'abnormal');

  return (
    <ScrollView className={cn('flex-1', className)}>
      <View className="p-4 gap-4">
        {/* Header Info */}
        <View className="bg-surface rounded-2xl p-4 border border-border">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-lg font-bold text-foreground">MRI Analysis Report</Text>
            <View className="bg-primary px-3 py-1 rounded-full">
              <Text className="text-background text-sm font-semibold">
                Quality: {qualityPercentage}%
              </Text>
            </View>
          </View>
          
          <View className="flex-row gap-4 mt-2">
            <View className="flex-1">
              <Text className="text-xs text-muted">Modality</Text>
              <Text className="text-sm font-semibold text-foreground">{report.modality}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-xs text-muted">View</Text>
              <Text className="text-sm font-semibold text-foreground">{report.view}</Text>
            </View>
          </View>
        </View>

        {/* Anatomical Findings */}
        <View className="bg-surface rounded-2xl p-4 border border-border">
          <Text className="text-lg font-bold text-foreground mb-3">Anatomical Findings</Text>
          
          <View className="gap-2">
            {report.anatomicalFindings.map((finding, index) => (
              <View
                key={index}
                className="bg-background rounded-lg p-3 border border-border"
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-sm font-semibold text-foreground flex-1">
                    {finding.structure}
                  </Text>
                  <View className="flex-row items-center gap-1">
                    <Text className="text-base">{getStatusIcon(finding.status)}</Text>
                    <Text className={cn('text-xs font-semibold', getStatusColor(finding.status))}>
                      {finding.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                
                <Text className="text-sm text-muted mb-1">{finding.observation}</Text>
                
                <View className="flex-row justify-between items-center mt-1">
                  {finding.location && (
                    <Text className="text-xs text-muted">📍 {finding.location}</Text>
                  )}
                  <Text className="text-xs text-muted">
                    Confidence: {Math.round(finding.confidence * 100)}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Impression */}
        <View
          className={cn(
            'rounded-2xl p-4 border-2',
            hasAbnormalities
              ? 'bg-error/10 border-error'
              : 'bg-success/10 border-success'
          )}
        >
          <Text className="text-lg font-bold text-foreground mb-2">Impression</Text>
          <Text className="text-sm text-foreground leading-relaxed">{report.impression}</Text>
        </View>

        {/* Differential Diagnosis */}
        {report.differential.length > 0 && (
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-lg font-bold text-foreground mb-3">
              Differential Diagnosis
            </Text>
            <View className="gap-2">
              {report.differential.map((diagnosis, index) => (
                <View key={index} className="flex-row items-start gap-2">
                  <Text className="text-sm text-primary font-semibold">{index + 1}.</Text>
                  <Text className="text-sm text-foreground flex-1">{diagnosis}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recommendations */}
        <View className="bg-surface rounded-2xl p-4 border border-border">
          <Text className="text-lg font-bold text-foreground mb-3">Recommendations</Text>
          <View className="gap-2">
            {report.recommendations.map((recommendation, index) => (
              <View key={index} className="flex-row items-start gap-2">
                <Text className="text-base">•</Text>
                <Text className="text-sm text-foreground flex-1">{recommendation}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Timestamp */}
        <View className="items-center py-2">
          <Text className="text-xs text-muted">
            Generated: {new Date(report.timestamp).toLocaleString()}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
