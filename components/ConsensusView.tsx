/**
 * Consensus View Component
 * Displays multi-model consensus results with confidence heatmap
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import type { ConsensusResult, EnsembleReport } from '@/services/consensus';

interface ConsensusViewProps {
  report: EnsembleReport;
  onClose?: () => void;
}

export function ConsensusView({ report, onClose }: ConsensusViewProps) {
  const colors = useColors();
  const [activeView, setActiveView] = useState<'consensus' | 'heatmap' | 'models'>('consensus');
  
  const { consensus, summary, interpretation } = report;
  
  // Get agreement level color
  const getAgreementColor = (level: string) => {
    switch (level) {
      case 'high': return '#22c55e';
      case 'moderate': return '#f59e0b';
      case 'low': return '#ef4444';
      default: return colors.muted;
    }
  };
  
  // Get reliability badge
  const getReliabilityBadge = (score: number) => {
    if (score > 0.8) return { text: 'Excellent', color: '#22c55e' };
    if (score > 0.6) return { text: 'Good', color: '#3b82f6' };
    if (score > 0.4) return { text: 'Fair', color: '#f59e0b' };
    return { text: 'Poor', color: '#ef4444' };
  };
  
  const reliabilityBadge = getReliabilityBadge(interpretation.reliabilityScore);
  
  return (
    <ScrollView className="flex-1 bg-background">
      {/* Header */}
      <View className="p-4 border-b border-border">
        <View className="flex-row justify-between items-center">
          <Text className="text-xl font-bold text-foreground">{report.title}</Text>
          {onClose && (
            <TouchableOpacity onPress={onClose} className="p-2">
              <Text className="text-muted">✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text className="text-sm text-muted mt-1">
          {new Date(report.timestamp).toLocaleString()}
        </Text>
      </View>
      
      {/* Summary Cards */}
      <View className="p-4">
        <View className="flex-row gap-3 mb-4">
          {/* Models Card */}
          <View className="flex-1 bg-surface p-4 rounded-xl">
            <Text className="text-xs text-muted">Models</Text>
            <Text className="text-2xl font-bold text-foreground">{summary.totalModels}</Text>
          </View>
          
          {/* Agreement Card */}
          <View className="flex-1 bg-surface p-4 rounded-xl">
            <Text className="text-xs text-muted">Agreement</Text>
            <Text className="text-2xl font-bold" style={{ color: getAgreementColor(interpretation.agreementLevel) }}>
              {summary.overallAgreement.toFixed(1)}%
            </Text>
          </View>
          
          {/* Confidence Card */}
          <View className="flex-1 bg-surface p-4 rounded-xl">
            <Text className="text-xs text-muted">Confidence</Text>
            <Text className="text-2xl font-bold text-primary">
              {(summary.ensembleConfidence * 100).toFixed(1)}%
            </Text>
          </View>
        </View>
        
        {/* Reliability Badge */}
        <View 
          className="p-3 rounded-xl mb-4 flex-row items-center justify-between"
          style={{ backgroundColor: `${reliabilityBadge.color}20` }}
        >
          <View>
            <Text className="text-sm font-semibold" style={{ color: reliabilityBadge.color }}>
              Reliability: {reliabilityBadge.text}
            </Text>
            <Text className="text-xs text-muted mt-1">
              Score: {(interpretation.reliabilityScore * 100).toFixed(1)}%
            </Text>
          </View>
          <View 
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: reliabilityBadge.color }}
          >
            <Text className="text-white text-xs font-semibold">
              {interpretation.agreementLevel.toUpperCase()}
            </Text>
          </View>
        </View>
        
        {/* Recommendation */}
        <View className="bg-surface p-4 rounded-xl mb-4">
          <Text className="text-sm font-semibold text-foreground mb-2">Recommendation</Text>
          <Text className="text-sm text-muted">{summary.recommendation}</Text>
          <View className="mt-3 p-3 bg-background rounded-lg">
            <Text className="text-xs font-semibold text-primary">Suggested Action</Text>
            <Text className="text-sm text-foreground mt-1">{interpretation.suggestedAction}</Text>
          </View>
        </View>
      </View>
      
      {/* View Tabs */}
      <View className="flex-row px-4 mb-4">
        {(['consensus', 'heatmap', 'models'] as const).map((view) => (
          <TouchableOpacity
            key={view}
            onPress={() => setActiveView(view)}
            className="flex-1 p-3 rounded-xl mr-2"
            style={{
              backgroundColor: activeView === view ? colors.primary : colors.surface,
            }}
          >
            <Text 
              className="text-center text-sm font-semibold"
              style={{ color: activeView === view ? '#fff' : colors.foreground }}
            >
              {view === 'consensus' ? '🎯 Consensus' : view === 'heatmap' ? '🌡️ Heatmap' : '📊 Models'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Content based on active view */}
      <View className="px-4 pb-8">
        {activeView === 'consensus' && (
          <ConsensusTab consensus={consensus} />
        )}
        {activeView === 'heatmap' && (
          <HeatmapTab consensus={consensus} />
        )}
        {activeView === 'models' && (
          <ModelsTab consensus={consensus} predictions={report.predictions} />
        )}
      </View>
    </ScrollView>
  );
}

// Consensus Tab
function ConsensusTab({ consensus }: { consensus: ConsensusResult }) {
  const colors = useColors();
  
  return (
    <View>
      {/* Agreement Statistics */}
      <View className="bg-surface p-4 rounded-xl mb-4">
        <Text className="text-sm font-semibold text-foreground mb-3">Agreement Statistics</Text>
        
        <View className="mb-3">
          <View className="flex-row justify-between mb-1">
            <Text className="text-sm text-muted">Full Agreement</Text>
            <Text className="text-sm font-semibold text-success">
              {consensus.agreementStats.fullAgreement.toFixed(1)}%
            </Text>
          </View>
          <View className="h-2 bg-background rounded-full overflow-hidden">
            <View 
              className="h-full bg-success rounded-full"
              style={{ width: `${consensus.agreementStats.fullAgreement}%` }}
            />
          </View>
        </View>
        
        <View className="mb-3">
          <View className="flex-row justify-between mb-1">
            <Text className="text-sm text-muted">Majority Agreement</Text>
            <Text className="text-sm font-semibold text-warning">
              {consensus.agreementStats.majorityAgreement.toFixed(1)}%
            </Text>
          </View>
          <View className="h-2 bg-background rounded-full overflow-hidden">
            <View 
              className="h-full bg-warning rounded-full"
              style={{ width: `${consensus.agreementStats.majorityAgreement}%` }}
            />
          </View>
        </View>
        
        <View>
          <View className="flex-row justify-between mb-1">
            <Text className="text-sm text-muted">No Agreement</Text>
            <Text className="text-sm font-semibold text-error">
              {consensus.agreementStats.noAgreement.toFixed(1)}%
            </Text>
          </View>
          <View className="h-2 bg-background rounded-full overflow-hidden">
            <View 
              className="h-full bg-error rounded-full"
              style={{ width: `${consensus.agreementStats.noAgreement}%` }}
            />
          </View>
        </View>
      </View>
      
      {/* Pairwise Agreement */}
      <View className="bg-surface p-4 rounded-xl">
        <Text className="text-sm font-semibold text-foreground mb-3">Pairwise Model Agreement</Text>
        
        {consensus.pairwiseAgreement.map((pair, index) => (
          <View key={index} className="flex-row items-center justify-between py-2 border-b border-border">
            <Text className="text-sm text-foreground">
              {pair.model1} ↔ {pair.model2}
            </Text>
            <View className="flex-row gap-3">
              <View className="items-center">
                <Text className="text-xs text-muted">Dice</Text>
                <Text className="text-sm font-semibold" style={{ color: getDiceColor(pair.dice) }}>
                  {(pair.dice * 100).toFixed(1)}%
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-xs text-muted">IoU</Text>
                <Text className="text-sm font-semibold" style={{ color: getDiceColor(pair.iou) }}>
                  {(pair.iou * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// Heatmap Tab
function HeatmapTab({ consensus }: { consensus: ConsensusResult }) {
  return (
    <View>
      <View className="bg-surface p-4 rounded-xl mb-4">
        <Text className="text-sm font-semibold text-foreground mb-3">Confidence Heatmap Legend</Text>
        
        <View className="flex-row items-center gap-4">
          <View className="flex-row items-center">
            <View className="w-4 h-4 rounded mr-2" style={{ backgroundColor: '#22c55e' }} />
            <Text className="text-xs text-muted">High (80%+)</Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-4 h-4 rounded mr-2" style={{ backgroundColor: '#facc15' }} />
            <Text className="text-xs text-muted">Medium (60-80%)</Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-4 h-4 rounded mr-2" style={{ backgroundColor: '#f97316' }} />
            <Text className="text-xs text-muted">Low (40-60%)</Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-4 h-4 rounded mr-2" style={{ backgroundColor: '#ef4444' }} />
            <Text className="text-xs text-muted">Very Low (&lt;40%)</Text>
          </View>
        </View>
      </View>
      
      <View className="bg-surface p-4 rounded-xl">
        <Text className="text-sm font-semibold text-foreground mb-2">Interpretation</Text>
        <Text className="text-sm text-muted">
          The heatmap shows per-pixel agreement between models. Green areas indicate high confidence 
          where all models agree, while red areas show uncertainty where models disagree. 
          Focus clinical attention on yellow/orange regions for verification.
        </Text>
      </View>
    </View>
  );
}

// Models Tab
function ModelsTab({ consensus, predictions }: { consensus: ConsensusResult; predictions: any[] }) {
  return (
    <View>
      {consensus.modelStats.map((stat, index) => (
        <View key={index} className="bg-surface p-4 rounded-xl mb-3">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-semibold text-foreground">{stat.modelName}</Text>
            <Text className="text-sm text-muted">
              {predictions[index]?.inferenceTime || 0}ms
            </Text>
          </View>
          
          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className="text-xs text-muted">Mask Area</Text>
              <Text className="text-lg font-bold text-foreground">
                {stat.maskArea.toLocaleString()} px
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-xs text-muted">Dice w/ Consensus</Text>
              <Text className="text-lg font-bold" style={{ color: getDiceColor(stat.diceWithConsensus) }}>
                {(stat.diceWithConsensus * 100).toFixed(1)}%
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-xs text-muted">IoU w/ Consensus</Text>
              <Text className="text-lg font-bold" style={{ color: getDiceColor(stat.iouWithConsensus) }}>
                {(stat.iouWithConsensus * 100).toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// Helper function for Dice color
function getDiceColor(dice: number): string {
  if (dice > 0.8) return '#22c55e';
  if (dice > 0.6) return '#3b82f6';
  if (dice > 0.4) return '#f59e0b';
  return '#ef4444';
}

export default ConsensusView;
