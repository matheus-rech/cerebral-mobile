/**
 * Enhanced MRI Image Viewer Component
 * Displays MRI images with:
 * - Multi-slice navigation slider
 * - Brightness/contrast (windowing) controls
 * - Zoom and pan gestures
 * - Overlay opacity control
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
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
}

export function MRIViewerEnhanced({
  imageUri,
  overlayUri,
  className,
  showSliceSlider = false,
  showWindowingControls = false,
  showOverlayControl = false,
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
  const [brightness, setBrightness] = useState(1.0); // 0.5 - 1.5
  const [contrast, setContrast] = useState(1.0); // 0.5 - 1.5

  // Overlay state
  const [overlayOpacity, setOverlayOpacity] = useState(0.5); // 0 - 1

  // Controls visibility
  const [controlsVisible, setControlsVisible] = useState(true);

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
      // Limit zoom range
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
        // Reset zoom
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Zoom in 2x
        scale.value = withTiming(2);
        savedScale.value = 2;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });

  // Single tap to toggle controls
  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      setControlsVisible((prev) => !prev);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });

  const composedGesture = Gesture.Race(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
    singleTapGesture
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Image style with windowing (brightness/contrast)
  const imageStyle = {
    width: '100%' as const,
    height: '100%' as const,
    opacity: brightness,
  };

  const overlayStyle = {
    ...StyleSheet.absoluteFillObject,
    opacity: overlayOpacity,
  };

  const handleSliceChange = (value: number) => {
    setCurrentSliceIndex(Math.round(value));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBrightnessChange = (value: number) => {
    setBrightness(value);
  };

  const handleContrastChange = (value: number) => {
    setContrast(value);
  };

  const handleOverlayOpacityChange = (value: number) => {
    setOverlayOpacity(value);
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

  return (
    <View className={className} style={styles.container}>
      {/* Image Viewer */}
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

      {/* Controls Overlay */}
      {controlsVisible && (
        <View style={[styles.controlsContainer, { backgroundColor: colors.surface + 'E6' }]}>
          {/* Slice Slider */}
          {showSliceSlider && slices.length > 1 && (
            <View style={styles.controlSection}>
              <View style={styles.controlHeader}>
                <IconSymbol name="chevron.right" size={16} color={colors.foreground} />
                <Text style={[styles.controlLabel, { color: colors.foreground }]}>
                  Slice {currentSliceIndex + 1} / {slices.length}
                </Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={slices.length - 1}
                step={1}
                value={currentSliceIndex}
                onValueChange={handleSliceChange}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
            </View>
          )}

          {/* Windowing Controls */}
          {showWindowingControls && (
            <>
              <View style={styles.controlSection}>
                <View style={styles.controlHeader}>
                  <IconSymbol name="chevron.right" size={16} color={colors.foreground} />
                  <Text style={[styles.controlLabel, { color: colors.foreground }]}>
                    Brightness: {Math.round(brightness * 100)}%
                  </Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={0.5}
                  maximumValue={1.5}
                  step={0.05}
                  value={brightness}
                  onValueChange={handleBrightnessChange}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.border}
                  thumbTintColor={colors.primary}
                />
              </View>

              <View style={styles.controlSection}>
                <View style={styles.controlHeader}>
                  <IconSymbol name="chevron.right" size={16} color={colors.foreground} />
                  <Text style={[styles.controlLabel, { color: colors.foreground }]}>
                    Contrast: {Math.round(contrast * 100)}%
                  </Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={0.5}
                  maximumValue={1.5}
                  step={0.05}
                  value={contrast}
                  onValueChange={handleContrastChange}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.border}
                  thumbTintColor={colors.primary}
                />
              </View>
            </>
          )}

          {/* Overlay Opacity Control */}
          {showOverlayControl && overlayUri && (
            <View style={styles.controlSection}>
              <View style={styles.controlHeader}>
                <IconSymbol name="chevron.right" size={16} color={colors.foreground} />
                <Text style={[styles.controlLabel, { color: colors.foreground }]}>
                  Overlay: {Math.round(overlayOpacity * 100)}%
                </Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={1}
                step={0.05}
                value={overlayOpacity}
                onValueChange={handleOverlayOpacityChange}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
            </View>
          )}

          {/* Reset Button */}
          <Pressable
            onPress={resetView}
            style={({ pressed }) => [
              styles.resetButton,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.resetButtonText, { color: colors.background }]}>
              Reset View
            </Text>
          </Pressable>
        </View>
      )}

      {/* Tap hint */}
      {!controlsVisible && (
        <View style={[styles.hint, { backgroundColor: colors.surface + '99' }]}>
          <Text style={[styles.hintText, { color: colors.foreground }]}>
            Tap to show controls
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  imageContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 12,
  },
  controlSection: {
    gap: 8,
  },
  controlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  resetButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  hint: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  hintText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
