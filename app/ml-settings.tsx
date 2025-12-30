/**
 * ML Settings Screen
 * Configure backend selection and processing options
 */

import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useMLSettings, WINDOW_TYPES, COLORMAPS, type MLBackend, type Modality, type WindowType, type Colormap } from '@/contexts/ml-settings';
import { checkServiceHealth, getMcpServerUrl } from '@/services/neurosam3';
import * as Haptics from 'expo-haptics';
import Slider from '@react-native-community/slider';

export default function MLSettingsScreen() {
  const router = useRouter();
  const { settings, updateSettings, resetSettings, isLoading } = useMLSettings();
  const [neuroSAM3Available, setNeuroSAM3Available] = useState<boolean | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  useEffect(() => {
    checkNeuroSAM3();
  }, []);

  const checkNeuroSAM3 = async () => {
    setCheckingAvailability(true);
    try {
      const available = await checkServiceHealth();
      setNeuroSAM3Available(available);
    } catch {
      setNeuroSAM3Available(false);
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleBackendChange = (backend: MLBackend) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    updateSettings({ backend });
  };

  const handleModalityChange = (modality: Modality) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    updateSettings({ modality });
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all ML settings to defaults?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: () => {
            resetSettings();
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <Text className="text-muted">Loading settings...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <TouchableOpacity 
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text className="text-primary text-lg">← Back</Text>
          </TouchableOpacity>
          <Text className="flex-1 text-center text-xl font-bold text-foreground">ML Settings</Text>
          <TouchableOpacity onPress={handleReset}>
            <Text className="text-error text-base">Reset</Text>
          </TouchableOpacity>
        </View>

        {/* Backend Selection */}
        <View className="px-4 py-4">
          <Text className="text-lg font-semibold text-foreground mb-3">🧠 ML Backend</Text>
          
          {/* Local Backend */}
          <TouchableOpacity
            onPress={() => handleBackendChange('local')}
            className={`p-4 rounded-xl mb-3 border-2 ${
              settings.backend === 'local' 
                ? 'border-primary bg-primary/10' 
                : 'border-border bg-surface'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">Local Models</Text>
                <Text className="text-sm text-muted mt-1">
                  UNet, MedSAM2, SAM3, SynthSeg running on device
                </Text>
                <Text className="text-xs text-muted mt-1">
                  ✓ Works offline • ✓ Privacy-first • ✓ No API limits
                </Text>
              </View>
              <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                settings.backend === 'local' ? 'border-primary bg-primary' : 'border-muted'
              }`}>
                {settings.backend === 'local' && (
                  <Text className="text-white text-xs">✓</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>

          {/* NeuroSAM3 Cloud Backend */}
          <TouchableOpacity
            onPress={() => handleBackendChange('neurosam3')}
            className={`p-4 rounded-xl border-2 ${
              settings.backend === 'neurosam3' 
                ? 'border-primary bg-primary/10' 
                : 'border-border bg-surface'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-base font-semibold text-foreground">NeuroSAM3 Cloud</Text>
                  {checkingAvailability ? (
                    <Text className="ml-2 text-xs text-muted">checking...</Text>
                  ) : neuroSAM3Available === true ? (
                    <Text className="ml-2 text-xs text-success">● Online</Text>
                  ) : neuroSAM3Available === false ? (
                    <Text className="ml-2 text-xs text-error">● Offline</Text>
                  ) : null}
                </View>
                <Text className="text-sm text-muted mt-1">
                  HuggingFace Spaces GPU-accelerated inference
                </Text>
                <Text className="text-xs text-muted mt-1">
                  ✓ Cloud GPU • ✓ Advanced features • ✓ Auto Mask Generator
                </Text>
              </View>
              <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                settings.backend === 'neurosam3' ? 'border-primary bg-primary' : 'border-muted'
              }`}>
                {settings.backend === 'neurosam3' && (
                  <Text className="text-white text-xs">✓</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>

          {settings.backend === 'neurosam3' && (
            <View className="mt-3 p-3 bg-surface rounded-lg">
              <Text className="text-xs text-muted">
                MCP Server URL: {getMcpServerUrl()}
              </Text>
            </View>
          )}
        </View>

        {/* Modality Selection */}
        <View className="px-4 py-4 border-t border-border">
          <Text className="text-lg font-semibold text-foreground mb-3">🏥 Image Modality</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => handleModalityChange('MRI')}
              className={`flex-1 p-3 rounded-xl items-center border-2 ${
                settings.modality === 'MRI' 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border bg-surface'
              }`}
            >
              <Text className="text-2xl mb-1">🧲</Text>
              <Text className={`font-semibold ${settings.modality === 'MRI' ? 'text-primary' : 'text-foreground'}`}>
                MRI
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleModalityChange('CT')}
              className={`flex-1 p-3 rounded-xl items-center border-2 ${
                settings.modality === 'CT' 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border bg-surface'
              }`}
            >
              <Text className="text-2xl mb-1">☢️</Text>
              <Text className={`font-semibold ${settings.modality === 'CT' ? 'text-primary' : 'text-foreground'}`}>
                CT
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* CT Windowing (only show for CT) */}
        {settings.modality === 'CT' && (
          <View className="px-4 py-4 border-t border-border">
            <Text className="text-lg font-semibold text-foreground mb-3">🪟 CT Windowing</Text>
            <View className="flex-row flex-wrap gap-2">
              {WINDOW_TYPES.map((windowType) => (
                <TouchableOpacity
                  key={windowType}
                  onPress={() => updateSettings({ windowType })}
                  className={`px-3 py-2 rounded-lg ${
                    settings.windowType === windowType 
                      ? 'bg-primary' 
                      : 'bg-surface border border-border'
                  }`}
                >
                  <Text className={`text-sm ${
                    settings.windowType === windowType ? 'text-white font-semibold' : 'text-foreground'
                  }`}>
                    {windowType}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Colormap Selection */}
        <View className="px-4 py-4 border-t border-border">
          <Text className="text-lg font-semibold text-foreground mb-3">🎨 Overlay Colormap</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {COLORMAPS.map((colormap) => (
                <TouchableOpacity
                  key={colormap}
                  onPress={() => updateSettings({ colormap })}
                  className={`px-4 py-2 rounded-lg ${
                    settings.colormap === colormap 
                      ? 'bg-primary' 
                      : 'bg-surface border border-border'
                  }`}
                >
                  <Text className={`text-sm capitalize ${
                    settings.colormap === colormap ? 'text-white font-semibold' : 'text-foreground'
                  }`}>
                    {colormap}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Transparency Slider */}
        <View className="px-4 py-4 border-t border-border">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-lg font-semibold text-foreground">🔍 Overlay Transparency</Text>
            <Text className="text-muted">{Math.round(settings.transparency * 100)}%</Text>
          </View>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={0}
            maximumValue={1}
            step={0.05}
            value={settings.transparency}
            onValueChange={(value) => updateSettings({ transparency: value })}
            minimumTrackTintColor="#0a7ea4"
            maximumTrackTintColor="#687076"
          />
        </View>

        {/* CLAHE Settings (NeuroSAM3 only) */}
        {settings.backend === 'neurosam3' && (
          <View className="px-4 py-4 border-t border-border">
            <View className="flex-row justify-between items-center mb-3">
              <View>
                <Text className="text-lg font-semibold text-foreground">⚡ CLAHE Enhancement</Text>
                <Text className="text-xs text-muted">Contrast Limited Adaptive Histogram Equalization</Text>
              </View>
              <Switch
                value={settings.applyClahe}
                onValueChange={(value) => updateSettings({ applyClahe: value })}
                trackColor={{ false: '#687076', true: '#0a7ea4' }}
              />
            </View>
            {settings.applyClahe && (
              <View>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-muted">Clip Limit</Text>
                  <Text className="text-muted">{settings.claheClip.toFixed(1)}</Text>
                </View>
                <Slider
                  style={{ width: '100%', height: 40 }}
                  minimumValue={1}
                  maximumValue={5}
                  step={0.1}
                  value={settings.claheClip}
                  onValueChange={(value) => updateSettings({ claheClip: value })}
                  minimumTrackTintColor="#0a7ea4"
                  maximumTrackTintColor="#687076"
                />
              </View>
            )}
          </View>
        )}

        {/* AMG Settings (NeuroSAM3 only) */}
        {settings.backend === 'neurosam3' && (
          <View className="px-4 py-4 border-t border-border">
            <Text className="text-lg font-semibold text-foreground mb-3">🔲 Auto Mask Generator</Text>
            
            <View className="mb-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-muted">Points per Side</Text>
                <Text className="text-muted">{settings.amgPointsPerSide}</Text>
              </View>
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={8}
                maximumValue={64}
                step={4}
                value={settings.amgPointsPerSide}
                onValueChange={(value) => updateSettings({ amgPointsPerSide: value })}
                minimumTrackTintColor="#0a7ea4"
                maximumTrackTintColor="#687076"
              />
            </View>

            <View>
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-muted">Min Mask Area (px)</Text>
                <Text className="text-muted">{settings.amgMinMaskArea}</Text>
              </View>
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={50}
                maximumValue={500}
                step={25}
                value={settings.amgMinMaskArea}
                onValueChange={(value) => updateSettings({ amgMinMaskArea: value })}
                minimumTrackTintColor="#0a7ea4"
                maximumTrackTintColor="#687076"
              />
            </View>
          </View>
        )}

        {/* Edge Detection Settings */}
        <View className="px-4 py-4 border-t border-border">
          <Text className="text-lg font-semibold text-foreground mb-3">📐 Edge Detection</Text>
          
          <View className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-muted">Edge Threshold</Text>
              <Text className="text-muted">{settings.edgeThreshold}</Text>
            </View>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={10}
              maximumValue={200}
              step={5}
              value={settings.edgeThreshold}
              onValueChange={(value) => updateSettings({ edgeThreshold: value })}
              minimumTrackTintColor="#0a7ea4"
              maximumTrackTintColor="#687076"
            />
          </View>

          <View>
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-muted">Dilation Size</Text>
              <Text className="text-muted">{settings.edgeDilationSize}</Text>
            </View>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={settings.edgeDilationSize}
              onValueChange={(value) => updateSettings({ edgeDilationSize: value })}
              minimumTrackTintColor="#0a7ea4"
              maximumTrackTintColor="#687076"
            />
          </View>
        </View>

        {/* Info Section */}
        <View className="px-4 py-4 border-t border-border">
          <View className="bg-surface p-4 rounded-xl">
            <Text className="text-sm font-semibold text-foreground mb-2">ℹ️ About Backends</Text>
            <Text className="text-xs text-muted leading-5">
              <Text className="font-semibold">Local Models:</Text> Run inference directly on your device using UNet, MedSAM2, SAM3, and SynthSeg. Best for privacy and offline use.
              {'\n\n'}
              <Text className="font-semibold">NeuroSAM3 Cloud:</Text> Uses HuggingFace Spaces GPU for faster inference with advanced features like Automatic Mask Generator, CLAHE preprocessing, and multi-mask candidates.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
