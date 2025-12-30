/**
 * MaskEditor Component
 * Provides eraser and brush tools for manually refining segmentation masks
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

type EditMode = 'brush' | 'eraser' | 'none';

interface EditOperation {
  mode: EditMode;
  points: Array<{ x: number; y: number }>;
  brushSize: number;
}

interface MaskEditorProps {
  imageUri: string;
  maskUri: string;
  onMaskUpdate: (updatedMaskBase64: string) => void;
  onClose: () => void;
  imageDimensions: { width: number; height: number };
}

const BRUSH_SIZES = [5, 10, 20, 40, 60];

export function MaskEditor({
  imageUri,
  maskUri,
  onMaskUpdate,
  onClose,
  imageDimensions,
}: MaskEditorProps) {
  const [editMode, setEditMode] = useState<EditMode>('brush');
  const [brushSize, setBrushSize] = useState(20);
  const [editHistory, setEditHistory] = useState<EditOperation[]>([]);
  const [redoStack, setRedoStack] = useState<EditOperation[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Array<{ x: number; y: number }>>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Canvas ref for drawing
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<View>(null);
  
  const [containerLayout, setContainerLayout] = useState({ width: 0, height: 0 });
  
  const haptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  };

  // Calculate display dimensions maintaining aspect ratio
  const getDisplayDimensions = () => {
    const screenWidth = Dimensions.get('window').width - 32;
    const maxHeight = Dimensions.get('window').height * 0.5;
    
    const aspectRatio = imageDimensions.width / imageDimensions.height;
    let displayWidth = screenWidth;
    let displayHeight = screenWidth / aspectRatio;
    
    if (displayHeight > maxHeight) {
      displayHeight = maxHeight;
      displayWidth = maxHeight * aspectRatio;
    }
    
    return { width: displayWidth, height: displayHeight };
  };

  const displayDims = getDisplayDimensions();

  // Initialize canvas on web
  useEffect(() => {
    if (Platform.OS === 'web' && containerLayout.width > 0) {
      initializeCanvas();
    }
  }, [containerLayout, maskUri]);

  const initializeCanvas = async () => {
    if (Platform.OS !== 'web') return;
    
    // Create or get canvas elements
    const container = document.getElementById('mask-editor-container');
    if (!container) return;
    
    // Remove existing canvases
    const existingCanvas = container.querySelector('canvas');
    if (existingCanvas) existingCanvas.remove();
    
    // Create mask canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'mask-canvas';
    canvas.width = displayDims.width;
    canvas.height = displayDims.height;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'auto';
    canvas.style.cursor = editMode === 'brush' ? 'crosshair' : 'cell';
    container.appendChild(canvas);
    
    canvasRef.current = canvas;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Load and draw the mask
    if (maskUri) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, 0, 0, displayDims.width, displayDims.height);
      };
      img.src = maskUri;
    }
    
    // Add event listeners
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('mouseleave', handleCanvasMouseUp);
    
    // Touch events
    canvas.addEventListener('touchstart', handleCanvasTouchStart);
    canvas.addEventListener('touchmove', handleCanvasTouchMove);
    canvas.addEventListener('touchend', handleCanvasTouchEnd);
  };

  const handleCanvasMouseDown = (e: MouseEvent) => {
    if (editMode === 'none') return;
    setIsDrawing(true);
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentStroke([{ x, y }]);
    drawPoint(x, y);
  };

  const handleCanvasMouseMove = (e: MouseEvent) => {
    if (!isDrawing || editMode === 'none') return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentStroke(prev => [...prev, { x, y }]);
    drawPoint(x, y);
  };

  const handleCanvasMouseUp = () => {
    if (isDrawing && currentStroke.length > 0) {
      // Save to history
      setEditHistory(prev => [...prev, {
        mode: editMode,
        points: currentStroke,
        brushSize,
      }]);
      setRedoStack([]);
    }
    setIsDrawing(false);
    setCurrentStroke([]);
  };

  const handleCanvasTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    if (editMode === 'none') return;
    setIsDrawing(true);
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    setCurrentStroke([{ x, y }]);
    drawPoint(x, y);
    haptic();
  };

  const handleCanvasTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (!isDrawing || editMode === 'none') return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    setCurrentStroke(prev => [...prev, { x, y }]);
    drawPoint(x, y);
  };

  const handleCanvasTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    handleCanvasMouseUp();
    haptic(Haptics.ImpactFeedbackStyle.Medium);
  };

  const drawPoint = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    
    if (editMode === 'brush') {
      // Add to mask (semi-transparent green)
      ctx.fillStyle = 'rgba(34, 197, 94, 0.6)';
      ctx.fill();
    } else if (editMode === 'eraser') {
      // Remove from mask (clear)
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  };

  const handleUndo = () => {
    if (editHistory.length === 0) return;
    
    haptic();
    const lastOp = editHistory[editHistory.length - 1];
    setEditHistory(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, lastOp]);
    
    // Redraw canvas from scratch
    redrawCanvas(editHistory.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    
    haptic();
    const nextOp = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setEditHistory(prev => [...prev, nextOp]);
    
    // Redraw canvas
    redrawCanvas([...editHistory, nextOp]);
  };

  const redrawCanvas = async (operations: EditOperation[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redraw original mask
    if (maskUri) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, displayDims.width, displayDims.height);
          resolve();
        };
        img.src = maskUri;
      });
    }
    
    // Apply all operations
    for (const op of operations) {
      for (const point of op.points) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, op.brushSize / 2, 0, Math.PI * 2);
        
        if (op.mode === 'brush') {
          ctx.fillStyle = 'rgba(34, 197, 94, 0.6)';
          ctx.fill();
        } else if (op.mode === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      onClose();
      return;
    }
    
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    
    // Convert canvas to base64
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    onMaskUpdate(base64);
    onClose();
  };

  const handleClear = () => {
    haptic();
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setEditHistory([]);
    setRedoStack([]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Mask</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Tool Selection */}
      <View style={styles.toolBar}>
        <TouchableOpacity
          style={[styles.toolButton, editMode === 'brush' && styles.toolButtonActive]}
          onPress={() => { setEditMode('brush'); haptic(); }}
        >
          <Text style={styles.toolIcon}>🖌️</Text>
          <Text style={[styles.toolLabel, editMode === 'brush' && styles.toolLabelActive]}>
            Brush
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.toolButton, editMode === 'eraser' && styles.toolButtonActive]}
          onPress={() => { setEditMode('eraser'); haptic(); }}
        >
          <Text style={styles.toolIcon}>🧹</Text>
          <Text style={[styles.toolLabel, editMode === 'eraser' && styles.toolLabelActive]}>
            Eraser
          </Text>
        </TouchableOpacity>
        
        <View style={styles.toolDivider} />
        
        <TouchableOpacity
          style={[styles.toolButton, editHistory.length === 0 && styles.toolButtonDisabled]}
          onPress={handleUndo}
          disabled={editHistory.length === 0}
        >
          <Text style={styles.toolIcon}>↩️</Text>
          <Text style={styles.toolLabel}>Undo</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.toolButton, redoStack.length === 0 && styles.toolButtonDisabled]}
          onPress={handleRedo}
          disabled={redoStack.length === 0}
        >
          <Text style={styles.toolIcon}>↪️</Text>
          <Text style={styles.toolLabel}>Redo</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.toolButton} onPress={handleClear}>
          <Text style={styles.toolIcon}>🗑️</Text>
          <Text style={styles.toolLabel}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Brush Size */}
      <View style={styles.brushSizeContainer}>
        <Text style={styles.brushSizeLabel}>Brush Size:</Text>
        <View style={styles.brushSizeOptions}>
          {BRUSH_SIZES.map((size) => (
            <TouchableOpacity
              key={size}
              style={[
                styles.brushSizeButton,
                brushSize === size && styles.brushSizeButtonActive,
              ]}
              onPress={() => { setBrushSize(size); haptic(); }}
            >
              <View
                style={[
                  styles.brushSizePreview,
                  { width: Math.min(size, 30), height: Math.min(size, 30) },
                  brushSize === size && styles.brushSizePreviewActive,
                ]}
              />
              <Text style={[
                styles.brushSizeText,
                brushSize === size && styles.brushSizeTextActive,
              ]}>
                {size}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Canvas Area */}
      <View
        style={[styles.canvasContainer, { width: displayDims.width, height: displayDims.height }]}
        onLayout={(e) => setContainerLayout(e.nativeEvent.layout)}
        nativeID="mask-editor-container"
      >
        {/* Background Image */}
        <Image
          source={{ uri: imageUri }}
          style={[styles.backgroundImage, { width: displayDims.width, height: displayDims.height }]}
          contentFit="contain"
        />
        
        {/* Mask Overlay (for non-web) */}
        {Platform.OS !== 'web' && maskUri && (
          <Image
            source={{ uri: maskUri }}
            style={[styles.maskOverlay, { width: displayDims.width, height: displayDims.height }]}
            contentFit="contain"
          />
        )}
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          {editMode === 'brush' 
            ? '🖌️ Draw to add to the mask' 
            : editMode === 'eraser'
            ? '🧹 Draw to remove from the mask'
            : 'Select a tool to start editing'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  toolBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#252540',
    gap: 8,
  },
  toolButton: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#333355',
  },
  toolButtonActive: {
    backgroundColor: '#22c55e',
  },
  toolButtonDisabled: {
    opacity: 0.4,
  },
  toolIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  toolLabel: {
    color: '#9ca3af',
    fontSize: 11,
  },
  toolLabelActive: {
    color: '#fff',
  },
  toolDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#444',
    marginHorizontal: 8,
  },
  brushSizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1e1e30',
  },
  brushSizeLabel: {
    color: '#9ca3af',
    fontSize: 14,
    marginRight: 12,
  },
  brushSizeOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  brushSizeButton: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#333355',
    minWidth: 50,
  },
  brushSizeButtonActive: {
    backgroundColor: '#22c55e',
  },
  brushSizePreview: {
    backgroundColor: '#666',
    borderRadius: 100,
    marginBottom: 4,
  },
  brushSizePreviewActive: {
    backgroundColor: '#fff',
  },
  brushSizeText: {
    color: '#9ca3af',
    fontSize: 11,
  },
  brushSizeTextActive: {
    color: '#fff',
  },
  canvasContainer: {
    alignSelf: 'center',
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  maskOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0.6,
  },
  instructions: {
    padding: 16,
    alignItems: 'center',
  },
  instructionText: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
  },
});
