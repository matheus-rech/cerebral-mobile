import { useEffect } from 'react';
import { Image, type ImageProps } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';

interface ZoomableImageProps extends Omit<ImageProps, 'style'> {
  /**
   * Shared zoom scale value for synchronization
   */
  sharedScale: SharedValue<number>;

  /**
   * Shared translate X value for synchronization
   */
  sharedTranslateX: SharedValue<number>;

  /**
   * Shared translate Y value for synchronization
   */
  sharedTranslateY: SharedValue<number>;

  /**
   * Optional callback when zoom/pan changes
   */
  onTransformChange?: (scale: number, translateX: number, translateY: number) => void;

  /**
   * Additional styles
   */
  className?: string;
}

/**
 * Zoomable and pannable image component with synchronized transforms
 * across multiple instances using shared values
 */
export function ZoomableImage({
  sharedScale,
  sharedTranslateX,
  sharedTranslateY,
  onTransformChange,
  className,
  ...imageProps
}: ZoomableImageProps) {
  // Local state for gesture handling
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Sync local state with shared values
  useEffect(() => {
    savedScale.value = sharedScale.value;
    savedTranslateX.value = sharedTranslateX.value;
    savedTranslateY.value = sharedTranslateY.value;
  }, []);

  // Pinch gesture for zooming
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const newScale = savedScale.value * event.scale;
      // Clamp scale between 1x and 5x
      sharedScale.value = Math.max(1, Math.min(5, newScale));
    })
    .onEnd(() => {
      savedScale.value = sharedScale.value;
      if (onTransformChange) {
        runOnJS(onTransformChange)(
          sharedScale.value,
          sharedTranslateX.value,
          sharedTranslateY.value
        );
      }
    });

  // Pan gesture for moving
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      sharedTranslateX.value = savedTranslateX.value + event.translationX;
      sharedTranslateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = sharedTranslateX.value;
      savedTranslateY.value = sharedTranslateY.value;
      if (onTransformChange) {
        runOnJS(onTransformChange)(
          sharedScale.value,
          sharedTranslateX.value,
          sharedTranslateY.value
        );
      }
    });

  // Combine gestures
  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  // Animated style
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: sharedTranslateX.value },
        { translateY: sharedTranslateY.value },
        { scale: sharedScale.value },
      ],
    };
  });

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={animatedStyle} className={className}>
        <Image {...imageProps} />
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * Reset shared transform values to default
 */
export function resetZoomPan(
  sharedScale: SharedValue<number>,
  sharedTranslateX: SharedValue<number>,
  sharedTranslateY: SharedValue<number>
) {
  'worklet';
  sharedScale.value = withTiming(1, { duration: 200 });
  sharedTranslateX.value = withTiming(0, { duration: 200 });
  sharedTranslateY.value = withTiming(0, { duration: 200 });
}
