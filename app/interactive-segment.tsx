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
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';
import { trpc } from '@/lib/trpc';

type PromptType = 'point' | 'box' | 'text';
type ModelType = 'medsam2' | 'sam3';
type Point = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };

// Get API base URL for local sample images
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('8081-')) {
      const apiHostname = hostname.replace('8081-', '3000-');
      return `${window.location.protocol}//${apiHostname}`;
    }
    if (window.location.port === '8081') {
      return `${window.location.protocol}//${window.location.hostname}:3000`;
    }
    return window.location.origin;
  }
  return 'http://localhost:3000';
};

// Sample 2D brain MRI for interactive segmentation (served from local API)
const getSampleBrainImage = () => `${getApiBaseUrl()}/public/samples/brain_mri_sample.jpg`;

// Check if URL is a NIfTI file (which needs NiiVue to render)
const isNiftiUrl = (url: string) => url?.includes('.nii') || url?.includes('.nii.gz');

const MODELS = {
  medsam2: {
    name: 'MedSAM2',
    description: 'Medical SAM - optimized for medical imaging',
    color: '#22c55e',
  },
  sam3: {
    name: 'SAM3',
    description: 'Segment Anything Model - zero-shot segmentation',
    color: '#f59e0b',
  },
};

export default function InteractiveSegmentScreen() {
  const params = useLocalSearchParams<{ imageUri: string; model?: string }>();
  const [selectedModel, setSelectedModel] = useState<ModelType>(
    (params.model as ModelType) || 'medsam2'
  );
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
  
  // Image dimensions for coordinate normalization
  const [imageDims, setImageDims] = useState({ width: 300, height: 300 });
  
  const imageRef = useRef<Image>(null);

  // Get the actual image URL (use sample if NIfTI)
  const actualImageUri = isNiftiUrl(params.imageUri || '') ? getSampleBrainImage() : params.imageUri;
  const apiBaseUrl = getApiBaseUrl();

  const haptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  };

  const handleImagePress = (event: any) => {
    if (promptType !== 'point') return;
    
    const { locationX, locationY } = event.nativeEvent;
    const newPoint = { x: locationX, y: locationY };
    
    setPoints([...points, newPoint]);
    haptic();
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
    if (currentBox && currentBox.w > 10 && currentBox.h > 10) {
      setBoxes([...boxes, currentBox]);
    }
    setIsDrawingBox(false);
    setBoxStart(null);
    setCurrentBox(null);
    haptic(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleSegment = async () => {
    setIsSegmenting(true);
    haptic();

    try {
      // Use tRPC to call the server proxy
      let result: any;
      
      if (promptType === 'point' && points.length > 0) {
        const lastPoint = points[points.length - 1];
        // Normalize coordinates to 0-1 range
        const normalizedPoint = {
          x: lastPoint.x / imageDims.width,
          y: lastPoint.y / imageDims.height,
        };
        
        if (selectedModel === 'medsam2') {
          // Call MedSAM2 via server proxy
          const response = await fetch(`${apiBaseUrl}/api/ml/medsam2/segment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUri: actualImageUri,
              prompts: [{ type: 'point', x: normalizedPoint.x, y: normalizedPoint.y }],
            }),
          });
          result = await response.json();
        } else {
          // Call SAM3 via server proxy
          const response = await fetch(`${apiBaseUrl}/api/ml/sam3/segment-point`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUri: actualImageUri,
              point: normalizedPoint,
            }),
          });
          result = await response.json();
        }
      } else if (promptType === 'box' && boxes.length > 0) {
        const lastBox = boxes[boxes.length - 1];
        // Normalize box coordinates
        const normalizedBox = {
          x: lastBox.x / imageDims.width,
          y: lastBox.y / imageDims.height,
          w: lastBox.w / imageDims.width,
          h: lastBox.h / imageDims.height,
        };
        
        if (selectedModel === 'medsam2') {
          const response = await fetch(`${apiBaseUrl}/api/ml/medsam2/segment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUri: actualImageUri,
              prompts: [{ type: 'box', ...normalizedBox }],
            }),
          });
          result = await response.json();
        } else {
          const response = await fetch(`${apiBaseUrl}/api/ml/sam3/segment-box`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUri: actualImageUri,
              box: normalizedBox,
            }),
          });
          result = await response.json();
        }
      } else if (promptType === 'text' && textPrompt.trim()) {
        const response = await fetch(`${apiBaseUrl}/api/ml/sam3/segment-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUri: actualImageUri,
            text: textPrompt,
          }),
        });
        result = await response.json();
      } else {
        Alert.alert('No Prompt', 'Please tap on the image or draw a box to select a region');
        setIsSegmenting(false);
        return;
      }

      if (result && !result.error) {
        // Handle successful segmentation
        if (result.mask_base64) {
          setMaskUri(`data:image/png;base64,${result.mask_base64}`);
        }
        setConfidence(result.confidence || result.iou_score || 0.85);
        setAreaPixels(result.area_pixels || result.area || 0);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        Alert.alert('Error', result?.error || result?.message || 'Segmentation failed');
      }
    } catch (error) {
      console.error('Segmentation error:', error);
      Alert.alert('Connection Error', 'Could not connect to ML backend. Make sure the services are running.');
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
    haptic();
  };

  const handleUndo = () => {
    if (promptType === 'point' && points.length > 0) {
      setPoints(points.slice(0, -1));
    } else if (promptType === 'box' && boxes.length > 0) {
      setBoxes(boxes.slice(0, -1));
    }
    haptic();
  };

  const currentModelInfo = MODELS[selectedModel];

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-4">
        {/* Header */}
        <View className="flex-row items-center mb-4">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Text className="text-2xl text-primary">←</Text>
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xl font-bold text-foreground">
              Interactive Segmentation
            </Text>
            <Text className="text-sm text-muted">
              Tap or draw to segment brain structures
            </Text>
          </View>
        </View>

        {/* Model Selector */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-muted mb-2">AI MODEL</Text>
          <View className="flex-row gap-2">
            {(Object.entries(MODELS) as [ModelType, typeof MODELS.medsam2][]).map(([id, model]) => (
              <TouchableOpacity
                key={id}
                onPress={() => {
                  setSelectedModel(id);
                  haptic();
                }}
                className="flex-1 p-3 rounded-xl"
                style={{
                  backgroundColor: selectedModel === id ? model.color : '#1e2022',
                  borderWidth: 2,
                  borderColor: selectedModel === id ? model.color : 'transparent',
                }}
              >
                <Text
                  className="text-center font-bold"
                  style={{ color: selectedModel === id ? '#fff' : '#9BA1A6' }}
                >
                  {model.name}
                </Text>
                <Text
                  className="text-center text-xs mt-1"
                  style={{ color: selectedModel === id ? 'rgba(255,255,255,0.8)' : '#687076' }}
                >
                  {model.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Prompt Type Selector */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-muted mb-2">PROMPT TYPE</Text>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => { setPromptType('point'); haptic(); }}
              className={`flex-1 p-3 rounded-xl ${
                promptType === 'point' ? 'bg-primary' : 'bg-surface'
              }`}
            >
              <Text className="text-center text-lg mb-1">📍</Text>
              <Text
                className={`text-center font-semibold text-sm ${
                  promptType === 'point' ? 'text-background' : 'text-foreground'
                }`}
              >
                Point
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setPromptType('box'); haptic(); }}
              className={`flex-1 p-3 rounded-xl ${
                promptType === 'box' ? 'bg-primary' : 'bg-surface'
              }`}
            >
              <Text className="text-center text-lg mb-1">⬜</Text>
              <Text
                className={`text-center font-semibold text-sm ${
                  promptType === 'box' ? 'text-background' : 'text-foreground'
                }`}
              >
                Box
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setPromptType('text'); haptic(); }}
              className={`flex-1 p-3 rounded-xl ${
                promptType === 'text' ? 'bg-primary' : 'bg-surface'
              }`}
            >
              <Text className="text-center text-lg mb-1">💬</Text>
              <Text
                className={`text-center font-semibold text-sm ${
                  promptType === 'text' ? 'text-background' : 'text-foreground'
                }`}
              >
                Text
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Instructions */}
        <View 
          className="p-3 rounded-xl mb-4"
          style={{ backgroundColor: `${currentModelInfo.color}20` }}
        >
          <Text className="text-sm" style={{ color: currentModelInfo.color }}>
            {promptType === 'point' && '📍 Tap on the brain region you want to segment'}
            {promptType === 'box' && '⬜ Drag to draw a box around the target region'}
            {promptType === 'text' && '💬 Describe the structure to segment (e.g., "hippocampus")'}
          </Text>
        </View>

        {/* Text Input (for text prompt) */}
        {promptType === 'text' && (
          <View className="mb-4">
            <TextInput
              className="bg-surface text-foreground p-4 rounded-xl text-base"
              placeholder="e.g., segment the tumor, hippocampus, ventricles..."
              placeholderTextColor="#687076"
              value={textPrompt}
              onChangeText={setTextPrompt}
              returnKeyType="done"
              onSubmitEditing={handleSegment}
              multiline
            />
          </View>
        )}

        {/* Image with Overlays */}
        <View 
          className="relative mb-4 rounded-2xl overflow-hidden"
          style={{ backgroundColor: '#0a0a0a' }}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setImageDims({ width, height: 320 });
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleImagePress}
            onPressIn={handleBoxDrawStart}
            onPressOut={handleBoxDrawEnd}
          >
            <Image
              ref={imageRef}
              source={{ uri: actualImageUri }}
              className="w-full rounded-2xl"
              style={{ height: 320 }}
              resizeMode="contain"
            />
          </TouchableOpacity>

          {/* Point Markers */}
          {points.map((point, index) => (
            <View
              key={`point-${index}`}
              className="absolute"
              style={{
                left: point.x - 12,
                top: point.y - 12,
              }}
            >
              <View 
                className="w-6 h-6 rounded-full items-center justify-center"
                style={{ backgroundColor: currentModelInfo.color }}
              >
                <Text className="text-white text-xs font-bold">{index + 1}</Text>
              </View>
            </View>
          ))}

          {/* Box Overlays */}
          {boxes.map((box, index) => (
            <View
              key={`box-${index}`}
              className="absolute"
              style={{
                left: box.x,
                top: box.y,
                width: box.w,
                height: box.h,
                borderWidth: 2,
                borderColor: currentModelInfo.color,
                backgroundColor: `${currentModelInfo.color}20`,
              }}
            />
          ))}

          {/* Current Drawing Box */}
          {currentBox && (
            <View
              className="absolute"
              style={{
                left: currentBox.x,
                top: currentBox.y,
                width: currentBox.w,
                height: currentBox.h,
                borderWidth: 2,
                borderColor: currentModelInfo.color,
                borderStyle: 'dashed',
                backgroundColor: `${currentModelInfo.color}10`,
              }}
            />
          )}

          {/* Mask Overlay */}
          {maskUri && (
            <Image
              source={{ uri: maskUri }}
              className="absolute inset-0 w-full rounded-2xl"
              style={{ height: 320, opacity: 0.5 }}
              resizeMode="contain"
            />
          )}

          {/* Point/Box Count Badge */}
          {(points.length > 0 || boxes.length > 0) && (
            <View 
              className="absolute top-2 right-2 px-3 py-1 rounded-full"
              style={{ backgroundColor: currentModelInfo.color }}
            >
              <Text className="text-white text-xs font-bold">
                {points.length > 0 ? `${points.length} point${points.length > 1 ? 's' : ''}` : ''}
                {boxes.length > 0 ? `${boxes.length} box${boxes.length > 1 ? 'es' : ''}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Results */}
        {(confidence !== null || areaPixels !== null) && (
          <View className="bg-surface p-4 rounded-xl mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">
              Segmentation Results
            </Text>
            <View className="flex-row justify-between">
              {confidence !== null && (
                <View>
                  <Text className="text-xs text-muted">Confidence</Text>
                  <Text className="text-lg font-bold" style={{ color: currentModelInfo.color }}>
                    {(confidence * 100).toFixed(1)}%
                  </Text>
                </View>
              )}
              {areaPixels !== null && (
                <View>
                  <Text className="text-xs text-muted">Area</Text>
                  <Text className="text-lg font-bold" style={{ color: currentModelInfo.color }}>
                    {areaPixels.toLocaleString()} px
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <TouchableOpacity
          onPress={handleSegment}
          disabled={isSegmenting || (promptType === 'point' && points.length === 0) || (promptType === 'box' && boxes.length === 0) || (promptType === 'text' && !textPrompt.trim())}
          className="p-4 rounded-xl mb-3"
          style={{
            backgroundColor: isSegmenting ? '#666' : currentModelInfo.color,
            opacity: (promptType === 'point' && points.length === 0) || (promptType === 'box' && boxes.length === 0) || (promptType === 'text' && !textPrompt.trim()) ? 0.5 : 1,
          }}
        >
          {isSegmenting ? (
            <View className="flex-row items-center justify-center">
              <ActivityIndicator color="#fff" size="small" />
              <Text className="text-white font-bold ml-2">Segmenting...</Text>
            </View>
          ) : (
            <Text className="text-white text-center font-bold text-lg">
              Segment with {currentModelInfo.name}
            </Text>
          )}
        </TouchableOpacity>

        <View className="flex-row gap-2 mb-4">
          <TouchableOpacity
            onPress={handleUndo}
            className="flex-1 bg-surface p-3 rounded-xl"
          >
            <Text className="text-foreground text-center font-semibold">↩ Undo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleClear}
            className="flex-1 bg-surface p-3 rounded-xl"
          >
            <Text className="text-foreground text-center font-semibold">🗑 Clear All</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-surface p-3 rounded-xl mb-8"
        >
          <Text className="text-foreground text-center font-semibold">✓ Done</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
