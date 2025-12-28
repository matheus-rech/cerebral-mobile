import { View, Text } from 'react-native';
import type { EmergencyFinding } from '../types/mri';

interface EmergencyAlertProps {
  findings: EmergencyFinding[];
  severity: 'normal' | 'abnormal' | 'CRITICAL';
}

/**
 * Emergency Alert Component
 * Displays critical findings that require immediate attention
 */
export function EmergencyAlert({ findings, severity }: EmergencyAlertProps) {
  if (severity === 'normal' || findings.length === 0) {
    return null;
  }

  const isCritical = severity === 'CRITICAL';
  const immediateFindings = findings.filter((f) => f.urgency === 'immediate');
  const urgentFindings = findings.filter((f) => f.urgency === 'urgent');

  return (
    <View className="mb-4">
      {/* Critical Alert Banner */}
      {isCritical && (
        <View className="bg-error p-4 rounded-lg mb-3 border-2 border-error">
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-2xl">🚨</Text>
            <Text className="text-lg font-bold text-white">
              CRITICAL FINDINGS - REQUIRES IMMEDIATE ATTENTION
            </Text>
          </View>
          <Text className="text-sm text-white">
            This scan contains findings that may require emergency intervention.
            Contact the attending physician immediately.
          </Text>
        </View>
      )}

      {/* Immediate Findings */}
      {immediateFindings.length > 0 && (
        <View className="bg-error/10 border border-error rounded-lg p-3 mb-2">
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-xl">⚠️</Text>
            <Text className="font-bold text-error">
              Immediate Attention Required ({immediateFindings.length})
            </Text>
          </View>
          {immediateFindings.map((finding, index) => (
            <View key={index} className="mb-2 pl-4 border-l-2 border-error">
              <Text className="font-semibold text-foreground">{finding.finding}</Text>
              <Text className="text-sm text-muted mt-1">{finding.description}</Text>
              {finding.measurement && (
                <Text className="text-sm text-error font-semibold mt-1">
                  Measurement: {finding.measurement}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Urgent Findings */}
      {urgentFindings.length > 0 && (
        <View className="bg-warning/10 border border-warning rounded-lg p-3">
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-xl">⚠️</Text>
            <Text className="font-bold text-warning">
              Urgent Findings ({urgentFindings.length})
            </Text>
          </View>
          {urgentFindings.map((finding, index) => (
            <View key={index} className="mb-2 pl-4 border-l-2 border-warning">
              <Text className="font-semibold text-foreground">{finding.finding}</Text>
              <Text className="text-sm text-muted mt-1">{finding.description}</Text>
              {finding.measurement && (
                <Text className="text-sm text-warning font-semibold mt-1">
                  Measurement: {finding.measurement}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
