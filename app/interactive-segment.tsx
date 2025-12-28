import { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';

type PromptType = 'point' | 'box' | 'text';
type Point = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };

export default function InteractiveSegmentScreen() {
  const params = useLocalSearchParams<{ imageUri: string }>();
  const [promptType, setPromptType] = useState<PromptType>('point');
  const [points, setPoints] = useState<Point[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [textPrompt, setTextPrompt] = useState('');
  const [maskUri, setMaskUri] = useState<string | null>(null);
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [areaPixels, setAreaPixels] = useState<number | null>(null);
  
  // Box drawing state
  const [isDrawingBox, setIsDrawingBox] = useState(false);
  const [boxStart, setBoxStart] = useState<Point | null>(null);
  const [currentBox, setCurrentBox] = useState<Box | null>(null);
  
  const imageRef = useRef<Image>(null);

  const handleImagePress = (event: any) => {
    if (promptType !== 'point') return;
    
    const { locationX, locationY } = event.nativeEvent;
    const newPoint = { x: locationX, y: locationY };
    
    setPoints([...points, newPoint]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBoxDrawStart = (event: any) => {
    if (promptType !== 'box') return;
    
    const { locationX, locationY } = event.nativeEvent;
    setIsDrawingBox(true);
    setBoxStart({ x: locationX, y: locationY });
    setCurrentBox({ x: locationX, y: locationY, w: 0, h: 0 });
  };

  const handleBoxDrawMove = (event: any) => {
    if (!isDrawingBox || !boxStart) return;
    
    const { locationX, locationY } = event.nativeEvent;
    const w = locationX - boxStart.x;
    const h = locationY - boxStart.y;
    
    setCurrentBox({
      x: w > 0 ? boxStart.x : locationX,
      y: h > 0 ? boxStart.y : locationY,
      w: Math.abs(w),
      h: Math.abs(h),
    });
  };

  const handleBoxDrawEnd = () => {
    if (!isDrawingBox || !currentBox) return;
    
    setIsDrawingBox(false);
    setBoxes([...boxes, currentBox]);
    setBoxStart(null);
    setCurrentBox(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleSegment = async () => {
    setIsSegmenting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      let endpoint = '';
      let body: any = {
        image: params.imageUri,
      };

      if (promptType === 'point' && points.length > 0) {
        endpoint = 'http://localhost:5006/segment-point';
        body.point = points[points.length - 1]; // Use last point
      } else if (promptType === 'box' && boxes.length > 0) {
        endpoint = 'http://localhost:5006/segment-box';
        body.box = boxes[boxes.length - 1]; // Use last box
      } else if (promptType === 'text' && textPrompt.trim()) {
        endpoint = 'http://localhost:5006/segment-text';
        body.text = textPrompt;
      } else {
        Alert.alert('Error', 'Please provide a prompt');
        setIsSegmenting(false);
        return;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success) {
        setMaskUri(`data:image/png;base64,${result.mask}`);
        setConfidence(result.confidence);
        setAreaPixels(result.area_pixels);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Error', result.error || 'Segmentation failed');
      }
    } catch (error) {
      console.error('Segmentation error:', error);
      Alert.alert('Error', 'Failed to segment image');
    } finally {
      setIsSegmenting(false);
    }
  };

  const handleClear = () => {
    setPoints([]);
    setBoxes([]);
    setTextPrompt('');
    setMaskUri(null);
    setConfidence(null);
    setAreaPixels(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleUndo = () => {
    if (promptType === 'point' && points.length > 0) {
      setPoints(points.slice(0, -1));
    } else if (promptType === 'box' && boxes.length > 0) {
      setBoxes(boxes.slice(0, -1));
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-4">
        {/* Header */}
        <View className="mb-4">
          <Text className="text-2xl font-bold text-foreground mb-2">
            Interactive Segmentation
          </Text>
          <Text className="text-sm text-muted">
            Tap, draw, or describe to segment brain structures
          </Text>
        </View>

        {/* Prompt Type Selector */}
        <View className="flex-row gap-2 mb-4">
          <TouchableOpacity
            onPress={() => setPromptType('point')}
            className={`flex-1 p-3 rounded-lg ${
              promptType === 'point' ? 'bg-primary' : 'bg-surface'
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                promptType === 'point' ? 'text-background' : 'text-foreground'
              }`}
            >
              Point
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setPromptType('box')}
            className={`flex-1 p-3 rounded-lg ${
              promptType === 'box' ? 'bg-primary' : 'bg-surface'
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                promptType === 'box' ? 'text-background' : 'text-foreground'
              }`}
            >
              Box
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setPromptType('text')}
            className={`flex-1 p-3 rounded-lg ${
              promptType === 'text' ? 'bg-primary' : 'bg-surface'
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                promptType === 'text' ? 'text-background' : 'text-foreground'
              }`}
            >
              Text
            </Text>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <View className="bg-surface p-3 rounded-lg mb-4">
          <Text className="text-sm text-muted">
            {promptType === 'point' && '📍 Tap on the region you want to segment'}
            {promptType === 'box' && '⬜ Drag to draw a box around the region'}
            {promptType === 'text' && '💬 Describe what you want to segment'}
          </Text>
        </View>

        {/* Text Input (for text prompt) */}
        {promptType === 'text' && (
          <View className="mb-4">
            <TextInput
              className="bg-surface text-foreground p-3 rounded-lg"
              placeholder="e.g., segment the tumor"
              placeholderTextColor="#9BA1A6"
              value={textPrompt}
              onChangeText={setTextPrompt}
              returnKeyType="done"
              onSubmitEditing={handleSegment}
            />
          </View>
        )}

        {/* Image with Overlays */}
        <View className="relative mb-4">
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleImagePress}
            onPressIn={handleBoxDrawStart}
            onPressOut={handleBoxDrawEnd}
          >
            <Image
              ref={imageRef}
              source={{ uri: params.imageUri }}
              className="w-full h-80 rounded-lg"
              resizeMode="contain"
            />
          </TouchableOpacity>

          {/* Point Markers */}
          {points.map((point, index) => (
            <View
              key={`point-${index}`}
              className="absolute w-3 h-3 bg-primary rounded-full border-2 border-background"
              style={{
                left: point.x - 6,
                top: point.y - 6,
              }}
            />
          ))}

          {/* Box Overlays */}
          {boxes.map((box, index) => (
            <View
              key={`box-${index}`}
              className="absolute border-2 border-primary"
              style={{
                left: box.x,
                top: box.y,
                width: box.w,
                height: box.h,
              }}
            />
          ))}

          {/* Current Drawing Box */}
          {currentBox && (
            <View
              className="absolute border-2 border-primary border-dashed"
              style={{
                left: currentBox.x,
                top: currentBox.y,
                width: currentBox.w,
                height: currentBox.h,
              }}
            />
          )}

          {/* Mask Overlay */}
          {maskUri && (
            <Image
              source={{ uri: maskUri }}
              className="absolute w-full h-full rounded-lg opacity-60"
              resizeMode="contain"
            />
          )}
        </View>

        {/* Results */}
        {confidence !== null && (
          <View className="bg-surface p-4 rounded-lg mb-4">
            <Text className="text-lg font-semibold text-foreground mb-2">
              Segmentation Results
            </Text>
            <View className="gap-2">
              <View className="flex-row justify-between">
                <Text className="text-muted">Confidence:</Text>
                <Text className="text-foreground font-semibold">
                  {(confidence * 100).toFixed(1)}%
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted">Area:</Text>
                <Text className="text-foreground font-semibold">
                  {areaPixels} pixels
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View className="gap-3 mb-6">
          <TouchableOpacity
            onPress={handleSegment}
            disabled={isSegmenting}
            className="bg-primary p-4 rounded-lg"
            style={{ opacity: isSegmenting ? 0.6 : 1 }}
          >
            {isSegmenting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-background text-center font-semibold text-lg">
                Segment
              </Text>
            )}
          </TouchableOpacity>

          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={handleUndo}
              className="flex-1 bg-surface p-3 rounded-lg"
            >
              <Text className="text-foreground text-center font-semibold">
                Undo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleClear}
              className="flex-1 bg-surface p-3 rounded-lg"
            >
              <Text className="text-foreground text-center font-semibold">
                Clear All
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-surface p-3 rounded-lg"
          >
            <Text className="text-foreground text-center font-semibold">
              Done
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
