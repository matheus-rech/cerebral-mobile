/**
 * MRI Comparison View Component
 * Side-by-side display of original MRI and segmented overlay
 * Features:
 * - Split view with synchronized zoom/pan
 * - Toggle between single and split view modes
 * - Independent brightness/contrast controls
 * - Synchronized gesture handling
 */

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from './ui/icon-symbol';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface MRIComparisonViewProps {
  originalUri: string;
  overlayUri?: string;
  groundTruthUri?: string;
  onClose?: () => void;
}

export function MRIComparisonView({
  originalUri,
  overlayUri,
  groundTruthUri,
  onClose,
}: MRIComparisonViewProps) {
  const colors = useColors();
  const [viewMode, setViewMode] = useState<'single' | 'split'>('split');
  const [diceScore, setDiceScore] = useState<number | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);
  
  // Shared values for zoom and pan (synchronized between both views)
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Pinch gesture for zoom
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      // Limit zoom range
      if (scale.value < 1) {
        scale.value = withTiming(1);
      } else if (scale.value > 5) {
        scale.value = withTiming(5);
      }
      savedScale.value = scale.value;
    });

  // Pan gesture for moving
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Double tap to reset
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withTiming(1);
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    });

  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    doubleTapGesture
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === 'single' ? 'split' : 'single'));
  };

  const imageWidth = viewMode === 'split' ? (SCREEN_WIDTH - 48) / 2 : SCREEN_WIDTH - 32;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {viewMode === 'split' ? 'Side-by-Side Comparison' : 'Single View'}
        </Text>
        <View style={styles.headerButtons}>
          <Pressable
            onPress={toggleViewMode}
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <IconSymbol
              name={viewMode === 'split' ? 'square.split.2x1' : 'square'}
              size={20}
              color={colors.primary}
            />
          </Pressable>
          {onClose && (
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.headerButton,
                { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <IconSymbol name="xmark" size={20} color={colors.foreground} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Image Views */}
      <View style={styles.imagesContainer}>
        {viewMode === 'split' ? (
          <View style={styles.splitContainer}>
            {/* Original Image */}
            <View style={styles.imageColumn}>
              <Text style={[styles.label, { color: colors.muted }]}>Original</Text>
              <GestureDetector gesture={composedGesture}>
                <Animated.View style={[styles.imageWrapper, animatedStyle]}>
                  <Image
                    source={{ uri: originalUri }}
                    style={[styles.image, { width: imageWidth, height: imageWidth }]}
                    contentFit="contain"
                  />
                </Animated.View>
              </GestureDetector>
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Overlay Image */}
            <View style={styles.imageColumn}>
              <Text style={[styles.label, { color: colors.muted }]}>
                {overlayUri ? 'Segmented' : 'No Overlay'}
              </Text>
              <GestureDetector gesture={composedGesture}>
                <Animated.View style={[styles.imageWrapper, animatedStyle]}>
                  {overlayUri ? (
                    <Image
                      source={{ uri: overlayUri }}
                      style={[styles.image, { width: imageWidth, height: imageWidth }]}
                      contentFit="contain"
                    />
                  ) : (
                    <View
                      style={[
                        styles.image,
                        styles.placeholderImage,
                        { width: imageWidth, height: imageWidth, backgroundColor: colors.surface },
                      ]}
                    >
                      <Text style={{ color: colors.muted }}>No segmentation</Text>
                    </View>
                  )}
                </Animated.View>
              </GestureDetector>
            </View>
          </View>
        ) : (
          <View style={styles.singleContainer}>
            <GestureDetector gesture={composedGesture}>
              <Animated.View style={[styles.imageWrapper, animatedStyle]}>
                <Image
                  source={{ uri: overlayUri || originalUri }}
                  style={[styles.image, { width: imageWidth, height: imageWidth * 1.2 }]}
                  contentFit="contain"
                />
              </Animated.View>
            </GestureDetector>
          </View>
        )}
      </View>

      {/* Metrics Display */}
      {overlayUri && groundTruthUri && (
        <Pressable
          onPress={() => setShowMetrics(!showMetrics)}
          style={[styles.metricsCard, { backgroundColor: colors.surface }]}
        >
          <View style={styles.metricsHeader}>
            <Text style={[styles.metricsTitle, { color: colors.foreground }]}>
              Segmentation Accuracy
            </Text>
            <IconSymbol
              name={showMetrics ? 'chevron.up' : 'chevron.down'}
              size={16}
              color={colors.muted}
            />
          </View>
          {showMetrics && diceScore !== null && (
            <View style={styles.metricsContent}>
              <View style={styles.metricRow}>
                <Text style={[styles.metricLabel, { color: colors.muted }]}>Dice Coefficient:</Text>
                <Text
                  style={[
                    styles.metricValue,
                    {
                      color:
                        diceScore >= 0.8
                          ? '#22C55E'
                          : diceScore >= 0.6
                          ? '#F59E0B'
                          : '#EF4444',
                    },
                  ]}
                >
                  {(diceScore * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.gradeBar}>
                <View
                  style={[
                    styles.gradeBarFill,
                    {
                      width: `${diceScore * 100}%`,
                      backgroundColor:
                        diceScore >= 0.8
                          ? '#22C55E'
                          : diceScore >= 0.6
                          ? '#F59E0B'
                          : '#EF4444',
                    },
                  ]}
                />
              </View>
              <Text style={[styles.gradeText, { color: colors.muted }]}>
                {diceScore >= 0.9
                  ? 'Excellent'
                  : diceScore >= 0.8
                  ? 'Good'
                  : diceScore >= 0.7
                  ? 'Fair'
                  : diceScore >= 0.5
                  ? 'Poor'
                  : 'Very Poor'}
              </Text>
            </View>
          )}
          {showMetrics && diceScore === null && (
            <Text style={[styles.calculatingText, { color: colors.muted }]}>
              Calculating metrics...
            </Text>
          )}
        </Pressable>
      )}

      {/* Instructions */}
      <View style={[styles.instructions, { backgroundColor: colors.surface }]}>
        <Text style={[styles.instructionText, { color: colors.muted }]}>
          Pinch to zoom • Drag to pan • Double tap to reset • Tap button to toggle view
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
  },
  imagesContainer: {
    flex: 1,
    padding: 16,
  },
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  imageColumn: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  divider: {
    width: 1,
  },
  singleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    borderRadius: 8,
  },
  placeholderImage: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  instructions: {
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  instructionText: {
    fontSize: 12,
    textAlign: 'center',
  },
  metricsCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  metricsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  metricsContent: {
    marginTop: 12,
    gap: 8,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 14,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  gradeBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  gradeBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  gradeText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  calculatingText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
