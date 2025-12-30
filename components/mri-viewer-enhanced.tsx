/**
 * Enhanced MRI Image Viewer Component
 * Displays MRI images with:
 * - Controls BELOW the image (not overlaying)
 * - Collapsible brightness/contrast controls
 * - Zoom and pan gestures
 */

import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Slider from '@react-native-community/slider';
import { useState, useEffect } from 'react';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from './ui/icon-symbol';
import * as Haptics from 'expo-haptics';

interface MRIViewerEnhancedProps {
  /** Main image URI or array of slice URIs for 3D volumes */
  imageUri: string | string[];
  /** Optional overlay image (segmentation mask) */
  overlayUri?: string;
  /** Optional className for styling */
  className?: string;
  /** Show slice slider for 3D volumes */
  showSliceSlider?: boolean;
  /** Show windowing controls */
  showWindowingControls?: boolean;
  /** Show overlay opacity control */
  showOverlayControl?: boolean;
  /** Image height - defaults to full available space */
  imageHeight?: number | string;
}

export function MRIViewerEnhanced({
  imageUri,
  overlayUri,
  className,
  showSliceSlider = false,
  showWindowingControls = false,
  showOverlayControl = false,
  imageHeight = 300,
}: MRIViewerEnhancedProps) {
  const colors = useColors();
  
  // Gesture state
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Multi-slice state
  const [slices, setSlices] = useState<string[]>([]);
  const [currentSliceIndex, setCurrentSliceIndex] = useState(0);
  const [displayUri, setDisplayUri] = useState<string>('');

  // Windowing state (brightness/contrast)
  const [brightness, setBrightness] = useState(1.0);
  const [contrast, setContrast] = useState(1.0);

  // Overlay state
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);

  // Controls visibility - collapsed by default
  const [controlsExpanded, setControlsExpanded] = useState(false);

  // Initialize slices
  useEffect(() => {
    if (Array.isArray(imageUri)) {
      setSlices(imageUri);
      setDisplayUri(imageUri[0] || '');
      setCurrentSliceIndex(0);
    } else {
      setSlices([imageUri]);
      setDisplayUri(imageUri);
      setCurrentSliceIndex(0);
    }
  }, [imageUri]);

  // Update display URI when slice changes
  useEffect(() => {
    if (slices.length > 0) {
      setDisplayUri(slices[currentSliceIndex]);
    }
  }, [currentSliceIndex, slices]);

  // Pinch to zoom gesture
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
      } else if (scale.value > 5) {
        scale.value = withTiming(5);
        savedScale.value = 5;
      } else {
        savedScale.value = scale.value;
      }
    });

  // Pan gesture
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Double tap to zoom/reset
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withTiming(2);
        savedScale.value = 2;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });

  const composedGesture = Gesture.Race(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture)
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const imageStyle = {
    width: '100%' as const,
    height: '100%' as const,
    opacity: brightness,
  };

  const overlayStyle = {
    ...StyleSheet.absoluteFillObject,
    opacity: overlayOpacity,
  };

  const resetView = () => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    setBrightness(1.0);
    setContrast(1.0);
    setOverlayOpacity(0.5);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const hasControls = showWindowingControls || showSliceSlider || (showOverlayControl && overlayUri);

  return (
    <View className={className} style={styles.container}>
      {/* Image Viewer - Takes full space, no overlay */}
      <View style={[styles.imageWrapper, { height: typeof imageHeight === 'number' ? imageHeight : undefined, flex: typeof imageHeight === 'string' ? 1 : undefined }]}>
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.imageContainer, animatedStyle]}>
            <Image
              source={{ uri: displayUri }}
              style={imageStyle}
              contentFit="contain"
              transition={200}
            />
            {overlayUri && (
              <Image
                source={{ uri: overlayUri }}
                style={overlayStyle}
                contentFit="contain"
                transition={200}
              />
            )}
          </Animated.View>
        </GestureDetector>
        
        {/* Zoom indicator */}
        {scale.value > 1 && (
          <View style={[styles.zoomBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.zoomText}>{Math.round(scale.value * 100)}%</Text>
          </View>
        )}
      </View>

      {/* Controls Section - BELOW the image */}
      {hasControls && (
        <View style={[styles.controlsSection, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          {/* Collapse/Expand Header */}
          <Pressable
            onPress={() => {
              setControlsExpanded(!controlsExpanded);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={styles.controlsHeader}
          >
            <View style={styles.controlsHeaderLeft}>
              <IconSymbol 
                name={controlsExpanded ? "chevron.down" : "chevron.right"} 
                size={16} 
                color={colors.muted} 
              />
              <Text style={[styles.controlsTitle, { color: colors.foreground }]}>
                Image Controls
              </Text>
            </View>
            <Pressable
              onPress={resetView}
              style={[styles.resetButton, { backgroundColor: colors.primary + '20' }]}
            >
              <Text style={[styles.resetButtonText, { color: colors.primary }]}>Reset</Text>
            </Pressable>
          </Pressable>

          {/* Expanded Controls */}
          {controlsExpanded && (
            <View style={styles.controlsContent}>
              {/* Slice Slider */}
              {showSliceSlider && slices.length > 1 && (
                <View style={styles.controlRow}>
                  <Text style={[styles.controlLabel, { color: colors.muted }]}>
                    Slice {currentSliceIndex + 1}/{slices.length}
                  </Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={slices.length - 1}
                    step={1}
                    value={currentSliceIndex}
                    onValueChange={(v) => setCurrentSliceIndex(Math.round(v))}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={colors.border}
                    thumbTintColor={colors.primary}
                  />
                </View>
              )}

              {/* Brightness */}
              {showWindowingControls && (
                <>
                  <View style={styles.controlRow}>
                    <Text style={[styles.controlLabel, { color: colors.muted }]}>
                      Brightness {Math.round(brightness * 100)}%
                    </Text>
                    <Slider
                      style={styles.slider}
                      minimumValue={0.5}
                      maximumValue={1.5}
                      step={0.05}
                      value={brightness}
                      onValueChange={setBrightness}
                      minimumTrackTintColor={colors.primary}
                      maximumTrackTintColor={colors.border}
                      thumbTintColor={colors.primary}
                    />
                  </View>

                  <View style={styles.controlRow}>
                    <Text style={[styles.controlLabel, { color: colors.muted }]}>
                      Contrast {Math.round(contrast * 100)}%
                    </Text>
                    <Slider
                      style={styles.slider}
                      minimumValue={0.5}
                      maximumValue={1.5}
                      step={0.05}
                      value={contrast}
                      onValueChange={setContrast}
                      minimumTrackTintColor={colors.primary}
                      maximumTrackTintColor={colors.border}
                      thumbTintColor={colors.primary}
                    />
                  </View>
                </>
              )}

              {/* Overlay Opacity */}
              {showOverlayControl && overlayUri && (
                <View style={styles.controlRow}>
                  <Text style={[styles.controlLabel, { color: colors.muted }]}>
                    Overlay {Math.round(overlayOpacity * 100)}%
                  </Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={1}
                    step={0.05}
                    value={overlayOpacity}
                    onValueChange={setOverlayOpacity}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={colors.border}
                    thumbTintColor={colors.primary}
                  />
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageWrapper: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  imageContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  zoomBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  zoomText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  controlsSection: {
    borderTopWidth: 1,
  },
  controlsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  controlsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  controlsContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  controlRow: {
    gap: 4,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  slider: {
    width: '100%',
    height: 32,
  },
});
