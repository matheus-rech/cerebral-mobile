import { useState, useEffect } from 'react';
import { ConsensusView } from '@/components/ConsensusView';
import { generateEnsembleReport, type ModelPrediction, type EnsembleReport } from '@/services/consensus';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { ZoomableImage, resetZoomPan } from '@/components/zoomable-image';
import { generateAgreementHeatmap, getAgreementColor, type HeatmapResult } from '@/services/agreement-heatmap';
import * as Haptics from 'expo-haptics';
import { useSharedValue } from 'react-native-reanimated';

type ModelResult = {
  model: string;
  maskUri: string;
  confidence: number;
  areaPixels: number;
  inferenceTime: number;
};

type ComparisonMetrics = {
  diceCoefficients: { [key: string]: number };
  agreement: number;
  consensusArea: number;
};

export default function ModelComparisonScreen() {
  const params = useLocalSearchParams<{ imageUri: string }>();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ModelResult[]>([]);
  const [metrics, setMetrics] = useState<ComparisonMetrics | null>(null);
  const [visibleModels, setVisibleModels] = useState<Set<string>>(new Set());
  const [heatmap, setHeatmap] = useState<HeatmapResult | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showConsensus, setShowConsensus] = useState(false);
  const [consensusReport, setConsensusReport] = useState<EnsembleReport | null>(null);

  // Shared values for synchronized zoom/pan
  const sharedScale = useSharedValue(1);
  const sharedTranslateX = useSharedValue(0);
  const sharedTranslateY = useSharedValue(0);

  const models = [
    { name: 'UNet', port: 5003, color: '#EF4444' },
    { name: 'MedSAM2', port: 5005, color: '#3B82F6' },
    { name: 'SAM3', port: 5006, color: '#10B981' },
    { name: 'SynthSeg', port: 5001, color: '#F59E0B' },
  ];

  useEffect(() => {
    // Initialize all models as visible
    setVisibleModels(new Set(models.map((m) => m.name)));
  }, []);

  const runAllModels = async () => {
    setIsRunning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const modelResults: ModelResult[] = [];

    // Get API base URL - use relative path for web, or construct for native
    const getApiBaseUrl = () => {
      if (typeof window !== 'undefined' && window.location) {
        // Web: use relative path which will be proxied
        return '';
      }
      // Native: use the API server URL
      return 'http://localhost:3000';
    };
    const apiBase = getApiBaseUrl();

    try {
      // Run all models in parallel through the Node.js proxy
      const promises = models.map(async (model) => {
        const startTime = Date.now();

        try {
          let endpoint = '';
          let body: any = { imageUri: params.imageUri };

          // Configure endpoint based on model - use Node.js proxy routes
          if (model.name === 'UNet') {
            endpoint = `${apiBase}/api/ml/unet/detect`;
          } else if (model.name === 'MedSAM2') {
            endpoint = `${apiBase}/api/ml/medsam2/segment`;
            body.prompts = {
              boxes: [{ x: 64, y: 64, w: 128, h: 128 }], // Center region
            };
          } else if (model.name === 'SAM3') {
            endpoint = `${apiBase}/api/ml/sam3/segment-point`;
            body.point = { x: 128, y: 128 }; // Center point
          } else if (model.name === 'SynthSeg') {
            endpoint = `${apiBase}/api/ml/synthseg/segment`;
          }

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          const result = await response.json();
          const inferenceTime = Date.now() - startTime;

          if (result.success || result.mask || result.mask_base64 || result.segmentation_overlay) {
            // Handle different response formats from various models
            let maskData = result.mask || result.mask_base64 || result.overlay || result.segmentation_overlay;
            let maskUri = maskData;
            
            // Add data URI prefix if not already present
            if (maskData && !maskData.startsWith('data:')) {
              maskUri = `data:image/png;base64,${maskData}`;
            }
            
            return {
              model: model.name,
              maskUri: maskUri || '',
              confidence: result.confidence || result.quality_score || 0.85,
              areaPixels: result.area_pixels || result.total_area || result.area || 0,
              inferenceTime,
            };
          }
        } catch (error) {
          console.error(`Error running ${model.name}:`, error);
        }

        return null;
      });

      const results = await Promise.all(promises);
      const validResults = results.filter((r) => r !== null) as ModelResult[];

      setResults(validResults);

      // Calculate comparison metrics
      if (validResults.length >= 2) {
        const metrics = calculateMetrics(validResults);
        setMetrics(metrics);

        // Generate agreement heatmap
        const heatmapData = await generateAgreementHeatmap(
          validResults.map((r) => ({ model: r.model, maskUri: r.maskUri }))
        );
        setHeatmap(heatmapData);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error running models:', error);
      Alert.alert('Error', 'Failed to run model comparison');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsRunning(false);
    }
  };

  const calculateMetrics = (results: ModelResult[]): ComparisonMetrics => {
    // Calculate Dice coefficients between all pairs
    const diceCoefficients: { [key: string]: number } = {};

    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const model1 = results[i];
        const model2 = results[j];

        // Simplified Dice calculation based on area overlap
        const intersection = Math.min(model1.areaPixels, model2.areaPixels);
        const union = model1.areaPixels + model2.areaPixels;
        const dice = union > 0 ? (2 * intersection) / union : 0;

        diceCoefficients[`${model1.model}-${model2.model}`] = dice;
      }
    }

    // Calculate overall agreement
    const diceValues = Object.values(diceCoefficients);
    const agreement =
      diceValues.length > 0
        ? diceValues.reduce((sum, val) => sum + val, 0) / diceValues.length
        : 0;

    // Calculate consensus area (average)
    const consensusArea =
      results.reduce((sum, r) => sum + r.areaPixels, 0) / results.length;

    return {
      diceCoefficients,
      agreement,
      consensusArea,
    };
  };

  const toggleModelVisibility = (modelName: string) => {
    const newVisible = new Set(visibleModels);
    if (newVisible.has(modelName)) {
      newVisible.delete(modelName);
    } else {
      newVisible.add(modelName);
    }
    setVisibleModels(newVisible);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const getModelColor = (modelName: string) => {
    return models.find((m) => m.name === modelName)?.color || '#6B7280';
  };

  const handleResetZoom = () => {
    resetZoomPan(sharedScale, sharedTranslateX, sharedTranslateY);
    setZoomLevel(1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleTransformChange = (scale: number, translateX: number, translateY: number) => {
    setZoomLevel(scale);
  };

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-4">
        {/* Header */}
        <View className="mb-4">
          <Text className="text-2xl font-bold text-foreground mb-2">
            Model Comparison
          </Text>
          <Text className="text-sm text-muted">
            Compare segmentation results from multiple AI models
          </Text>
        </View>

        {/* Run Button */}
        {results.length === 0 && (
          <TouchableOpacity
            onPress={runAllModels}
            disabled={isRunning}
            className="bg-primary p-4 rounded-lg mb-4"
            style={{ opacity: isRunning ? 0.6 : 1 }}
          >
            {isRunning ? (
              <View className="flex-row items-center justify-center gap-3">
                <ActivityIndicator color="#fff" />
                <Text className="text-background text-center font-semibold text-lg">
                  Running {models.length} Models...
                </Text>
              </View>
            ) : (
              <Text className="text-background text-center font-semibold text-lg">
                🔬 Run All Models
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Original Image */}
        <View className="mb-4">
          <Text className="text-lg font-semibold text-foreground mb-2">
            Original Image
          </Text>
          <Image
            source={{ uri: params.imageUri }}
            className="w-full h-64 rounded-lg bg-black"
            resizeMode="contain"
          />
        </View>

        {/* Zoom Controls */}
        {results.length > 0 && (
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-muted">Zoom:</Text>
              <Text className="text-sm font-semibold text-foreground">
                {zoomLevel.toFixed(1)}x
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleResetZoom}
              className="bg-surface px-4 py-2 rounded-lg border border-border"
            >
              <Text className="text-foreground font-semibold">Reset View</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Agreement Heatmap */}
        {heatmap && (
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-lg font-semibold text-foreground">
                Agreement Heatmap
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowHeatmap(!showHeatmap);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text className="text-primary font-semibold">
                  {showHeatmap ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>

            {showHeatmap && (
              <>
                <View className="relative bg-black rounded-lg overflow-hidden mb-3">
                  <Image
                    source={{ uri: params.imageUri }}
                    className="w-full h-64"
                    resizeMode="contain"
                  />
                  <Image
                    source={{ uri: heatmap.heatmapUri }}
                    className="absolute w-full h-full opacity-70"
                    resizeMode="contain"
                  />
                </View>

                {/* Heatmap Statistics */}
                <View className="bg-surface p-3 rounded-lg">
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    Agreement Statistics:
                  </Text>
                  <View className="gap-2">
                    <View className="flex-row items-center gap-2">
                      <View
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: getAgreementColor('high') }}
                      />
                      <Text className="text-xs text-muted flex-1">High Agreement (&gt;75%):</Text>
                      <Text className="text-xs font-semibold text-foreground">
                        {heatmap.statistics.highAgreement.toFixed(1)}%
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <View
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: getAgreementColor('medium') }}
                      />
                      <Text className="text-xs text-muted flex-1">Medium Agreement (50-75%):</Text>
                      <Text className="text-xs font-semibold text-foreground">
                        {heatmap.statistics.mediumAgreement.toFixed(1)}%
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <View
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: getAgreementColor('low') }}
                      />
                      <Text className="text-xs text-muted flex-1">Low Agreement (25-50%):</Text>
                      <Text className="text-xs font-semibold text-foreground">
                        {heatmap.statistics.lowAgreement.toFixed(1)}%
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <View
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: getAgreementColor('none') }}
                      />
                      <Text className="text-xs text-muted flex-1">No Agreement (&lt;25%):</Text>
                      <Text className="text-xs font-semibold text-foreground">
                        {heatmap.statistics.noAgreement.toFixed(1)}%
                      </Text>
                    </View>
                    <View className="border-t border-border pt-2 mt-1">
                      <View className="flex-row justify-between">
                        <Text className="text-xs text-muted">Average Agreement:</Text>
                        <Text className="text-xs font-semibold text-foreground">
                          {(heatmap.statistics.averageAgreement * 100).toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </>
            )}
          </View>
        )}

        {/* Generate Consensus Report Button */}
        {results.length >= 2 && (
          <TouchableOpacity
            onPress={() => {
              // Create model predictions for consensus
              const predictions: ModelPrediction[] = results.map((r) => ({
                modelName: r.model,
                mask: [], // Will be populated from mask image in real implementation
                confidence: r.confidence,
                inferenceTime: r.inferenceTime,
              }));
              
              // Generate ensemble report
              const report = generateEnsembleReport(
                predictions,
                params.imageUri || '',
                'Multi-Model Consensus Analysis'
              );
              
              setConsensusReport(report);
              setShowConsensus(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            className="mb-4 p-4 rounded-xl flex-row items-center justify-center gap-2"
            style={{ backgroundColor: '#8B5CF6' }}
          >
            <Text className="text-white font-bold text-lg">📊 Generate Consensus Report</Text>
          </TouchableOpacity>
        )}

        {/* Combined Overlay View */}
        {results.length > 0 && (
          <View className="mb-4">
            <Text className="text-lg font-semibold text-foreground mb-2">
              All Models Combined
            </Text>
            <View className="relative bg-black rounded-lg overflow-hidden">
              <Image
                source={{ uri: params.imageUri }}
                className="w-full h-64"
                resizeMode="contain"
              />
              {results.map((result) =>
                visibleModels.has(result.model) ? (
                  <Image
                    key={result.model}
                    source={{ uri: result.maskUri }}
                    className="absolute w-full h-full opacity-30"
                    resizeMode="contain"
                    style={{ tintColor: getModelColor(result.model) }}
                  />
                ) : null
              )}
            </View>
            <View className="flex-row flex-wrap gap-2 mt-2">
              {results.map((result) => (
                <View
                  key={result.model}
                  className="flex-row items-center gap-1 px-2 py-1 rounded"
                  style={{ backgroundColor: getModelColor(result.model) + '20' }}
                >
                  <View
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getModelColor(result.model) }}
                  />
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: getModelColor(result.model) }}
                  >
                    {result.model}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Results Grid */}
        {results.length > 0 && (
          <>
            <Text className="text-lg font-semibold text-foreground mb-2">
              Segmentation Results
            </Text>

            <View className="flex-row flex-wrap gap-2 mb-4">
              {results.map((result) => (
                <View key={result.model} className="w-[48%]">
                  <View className="bg-surface rounded-lg overflow-hidden border border-border">
                    {/* Model Header */}
                    <View
                      className="p-2 flex-row items-center justify-between"
                      style={{ backgroundColor: getModelColor(result.model) + '20' }}
                    >
                      <Text
                        className="font-semibold"
                        style={{ color: getModelColor(result.model) }}
                      >
                        {result.model}
                      </Text>
                      <TouchableOpacity
                        onPress={() => toggleModelVisibility(result.model)}
                      >
                        <Text className="text-xl">
                          {visibleModels.has(result.model) ? '👁️' : '🚫'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Image with Overlay - Synchronized Zoom/Pan */}
                    <View className="relative bg-black h-40">
                      <ZoomableImage
                        source={{ uri: params.imageUri }}
                        className="w-full h-40"
                        resizeMode="contain"
                        sharedScale={sharedScale}
                        sharedTranslateX={sharedTranslateX}
                        sharedTranslateY={sharedTranslateY}
                        onTransformChange={handleTransformChange}
                      />
                      {visibleModels.has(result.model) && (
                        <View className="absolute w-full h-full" style={{ pointerEvents: 'none' }}>
                          <Image
                            source={{ uri: result.maskUri }}
                            className="w-full h-full opacity-50"
                            resizeMode="contain"
                            style={{
                              tintColor: getModelColor(result.model),
                              transform: [
                                { translateX: sharedTranslateX.value },
                                { translateY: sharedTranslateY.value },
                                { scale: sharedScale.value },
                              ],
                            }}
                          />
                        </View>
                      )}
                    </View>

                    {/* Metrics */}
                    <View className="p-2 gap-1">
                      <View className="flex-row justify-between">
                        <Text className="text-xs text-muted">Confidence:</Text>
                        <Text className="text-xs text-foreground font-semibold">
                          {(result.confidence * 100).toFixed(1)}%
                        </Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-xs text-muted">Area:</Text>
                        <Text className="text-xs text-foreground font-semibold">
                          {result.areaPixels} px
                        </Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-xs text-muted">Time:</Text>
                        <Text className="text-xs text-foreground font-semibold">
                          {result.inferenceTime}ms
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* Comparison Metrics */}
            {metrics && (
              <View className="bg-surface p-4 rounded-lg mb-4">
                <Text className="text-lg font-semibold text-foreground mb-3">
                  Comparison Metrics
                </Text>

                {/* Overall Agreement */}
                <View className="mb-3">
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-sm text-muted">Overall Agreement:</Text>
                    <Text className="text-sm text-foreground font-semibold">
                      {(metrics.agreement * 100).toFixed(1)}%
                    </Text>
                  </View>
                  <View className="h-2 bg-border rounded-full overflow-hidden">
                    <View
                      className="h-full bg-primary"
                      style={{ width: `${metrics.agreement * 100}%` }}
                    />
                  </View>
                </View>

                {/* Consensus Area */}
                <View className="flex-row justify-between mb-3">
                  <Text className="text-sm text-muted">Consensus Area:</Text>
                  <Text className="text-sm text-foreground font-semibold">
                    {Math.round(metrics.consensusArea)} pixels
                  </Text>
                </View>

                {/* Dice Coefficients */}
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Pairwise Dice Coefficients:
                </Text>
                {Object.entries(metrics.diceCoefficients).map(([pair, dice]) => (
                  <View key={pair} className="flex-row justify-between mb-1">
                    <Text className="text-xs text-muted">{pair}:</Text>
                    <Text className="text-xs text-foreground font-semibold">
                      {dice.toFixed(3)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Action Buttons */}
            <View className="gap-3 mb-6">
              <TouchableOpacity
                onPress={runAllModels}
                className="bg-surface p-3 rounded-lg border border-primary"
              >
                <Text className="text-primary text-center font-semibold">
                  🔄 Run Again
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setResults([]);
                  setMetrics(null);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className="bg-surface p-3 rounded-lg"
              >
                <Text className="text-foreground text-center font-semibold">
                  Clear Results
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.back()}
                className="bg-surface p-3 rounded-lg"
              >
                <Text className="text-foreground text-center font-semibold">
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
      
      {/* Consensus Report Modal */}
      {showConsensus && consensusReport && (
        <View className="absolute inset-0 bg-background">
          <ConsensusView
            report={consensusReport}
            onClose={() => setShowConsensus(false)}
          />
        </View>
      )}
    </ScreenContainer>
  );
}
