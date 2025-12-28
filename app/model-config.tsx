/**
 * Model Configuration Screen
 * Allows users to select models and adjust parameters
 */

import { useState, useEffect } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Slider from '@react-native-community/slider';

import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import {
  type ModelConfiguration,
  type ModelType,
  type UNetConfig,
  type MedSAM2Config,
  type SAM3Config,
  type SynthSegConfig,
  DEFAULT_MODEL_CONFIG,
  MODEL_INFO,
  MODEL_PRESETS,
} from '@/types/model-config';
import {
  saveModelConfig,
  loadModelConfig,
  applyPreset,
} from '@/services/model-config-storage';

export default function ModelConfigScreen() {
  const colors = useColors();
  const router = useRouter();

  const [config, setConfig] = useState<ModelConfiguration>(DEFAULT_MODEL_CONFIG);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  useEffect(() => {
    loadSavedConfig();
  }, []);

  const loadSavedConfig = async () => {
    const saved = await loadModelConfig();
    setConfig(saved);
  };

  const handleSaveConfig = async () => {
    await saveModelConfig(config);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const handlePresetSelect = async (presetIndex: number) => {
    const preset = MODEL_PRESETS[presetIndex];
    if (preset) {
      const updated = await applyPreset(preset);
      setConfig(updated);
      setSelectedPreset(preset.name);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const toggleModel = (model: ModelType) => {
    setConfig((prev) => ({
      ...prev,
      [model]: {
        ...prev[model],
        enabled: !prev[model].enabled,
      },
    }));
    setSelectedPreset(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const updateUNetParam = <K extends keyof UNetConfig>(param: K, value: UNetConfig[K]) => {
    setConfig((prev) => ({
      ...prev,
      unet: { ...prev.unet, [param]: value },
    }));
    setSelectedPreset(null);
  };

  const updateMedSAM2Param = <K extends keyof MedSAM2Config>(param: K, value: MedSAM2Config[K]) => {
    setConfig((prev) => ({
      ...prev,
      medsam2: { ...prev.medsam2, [param]: value },
    }));
    setSelectedPreset(null);
  };

  const updateSAM3Param = <K extends keyof SAM3Config>(param: K, value: SAM3Config[K]) => {
    setConfig((prev) => ({
      ...prev,
      sam3: { ...prev.sam3, [param]: value },
    }));
    setSelectedPreset(null);
  };

  const updateSynthSegParam = <K extends keyof SynthSegConfig>(param: K, value: SynthSegConfig[K]) => {
    setConfig((prev) => ({
      ...prev,
      synthseg: { ...prev.synthseg, [param]: value },
    }));
    setSelectedPreset(null);
  };

  const renderUNetControls = () => (
    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
      {/* Confidence Threshold */}
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 14, color: colors.foreground }}>Confidence Threshold</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>
            {(config.unet.confidenceThreshold * 100).toFixed(0)}%
          </Text>
        </View>
        <Slider
          value={config.unet.confidenceThreshold}
          onValueChange={(value) => updateUNetParam('confidenceThreshold', value)}
          minimumValue={0.1}
          maximumValue={0.95}
          step={0.05}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
        />
        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
          Higher values reduce false positives but may miss subtle lesions
        </Text>
      </View>

      {/* Min Lesion Size */}
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 14, color: colors.foreground }}>Min Lesion Size</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>
            {config.unet.minLesionSize} px
          </Text>
        </View>
        <Slider
          value={config.unet.minLesionSize}
          onValueChange={(value) => updateUNetParam('minLesionSize', Math.round(value))}
          minimumValue={5}
          maximumValue={100}
          step={5}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
        />
        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
          Filter out small artifacts and noise
        </Text>
      </View>

      {/* Max Lesion Size */}
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 14, color: colors.foreground }}>Max Lesion Size</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>
            {config.unet.maxLesionSize} px
          </Text>
        </View>
        <Slider
          value={config.unet.maxLesionSize}
          onValueChange={(value) => updateUNetParam('maxLesionSize', Math.round(value))}
          minimumValue={1000}
          maximumValue={50000}
          step={1000}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
        />
        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
          Exclude very large regions (likely background)
        </Text>
      </View>
    </View>
  );

  const renderMedSAM2Controls = () => (
    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
      {/* Prompt Type */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, color: colors.foreground, marginBottom: 8 }}>Prompt Type</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['point', 'box', 'auto'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => {
                updateMedSAM2Param('promptType', type);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 8,
                backgroundColor: config.medsam2.promptType === type ? colors.primary : colors.background,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: config.medsam2.promptType === type ? colors.background : colors.foreground,
                  textAlign: 'center',
                  textTransform: 'capitalize',
                }}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Refinement Iterations */}
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 14, color: colors.foreground }}>Refinement Iterations</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>
            {config.medsam2.refinementIterations}
          </Text>
        </View>
        <Slider
          value={config.medsam2.refinementIterations}
          onValueChange={(value) => updateMedSAM2Param('refinementIterations', Math.round(value))}
          minimumValue={1}
          maximumValue={5}
          step={1}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
        />
        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
          More iterations = better accuracy but slower
        </Text>
      </View>

      {/* Confidence Threshold */}
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 14, color: colors.foreground }}>Confidence Threshold</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>
            {(config.medsam2.confidenceThreshold * 100).toFixed(0)}%
          </Text>
        </View>
        <Slider
          value={config.medsam2.confidenceThreshold}
          onValueChange={(value) => updateMedSAM2Param('confidenceThreshold', value)}
          minimumValue={0.1}
          maximumValue={0.95}
          step={0.05}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
        />
      </View>
    </View>
  );

  const renderSAM3Controls = () => (
    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
      {/* Prompt Mode */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, color: colors.foreground, marginBottom: 8 }}>Prompt Mode</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['point', 'box', 'text'] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => {
                updateSAM3Param('promptMode', mode);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 8,
                backgroundColor: config.sam3.promptMode === mode ? colors.primary : colors.background,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: config.sam3.promptMode === mode ? colors.background : colors.foreground,
                  textAlign: 'center',
                  textTransform: 'capitalize',
                }}
              >
                {mode}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Zero-Shot Detection */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, color: colors.foreground }}>Zero-Shot Detection</Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
            Detect objects without training examples
          </Text>
        </View>
        <Switch
          value={config.sam3.enableZeroShot}
          onValueChange={(value) => updateSAM3Param('enableZeroShot', value)}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.background}
        />
      </View>

      {/* Confidence Threshold */}
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 14, color: colors.foreground }}>Confidence Threshold</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>
            {(config.sam3.confidenceThreshold * 100).toFixed(0)}%
          </Text>
        </View>
        <Slider
          value={config.sam3.confidenceThreshold}
          onValueChange={(value) => updateSAM3Param('confidenceThreshold', value)}
          minimumValue={0.1}
          maximumValue={0.95}
          step={0.05}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
        />
      </View>
    </View>
  );

  const renderSynthSegControls = () => (
    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
      {/* Volumetric Units */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, color: colors.foreground, marginBottom: 8 }}>Volumetric Units</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['mm3', 'ml'] as const).map((unit) => (
            <TouchableOpacity
              key={unit}
              onPress={() => {
                updateSynthSegParam('volumetricUnits', unit);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 8,
                backgroundColor: config.synthseg.volumetricUnits === unit ? colors.primary : colors.background,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: config.synthseg.volumetricUnits === unit ? colors.background : colors.foreground,
                  textAlign: 'center',
                }}
              >
                {unit === 'mm3' ? 'mm³' : 'ml'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Include Subcortical */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, color: colors.foreground }}>Include Subcortical</Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
            Thalamus, caudate, putamen, etc.
          </Text>
        </View>
        <Switch
          value={config.synthseg.includeSubcortical}
          onValueChange={(value) => updateSynthSegParam('includeSubcortical', value)}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.background}
        />
      </View>

      {/* Include Cortical */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, color: colors.foreground }}>Include Cortical</Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
            Cerebral cortex regions
          </Text>
        </View>
        <Switch
          value={config.synthseg.includeCortical}
          onValueChange={(value) => updateSynthSegParam('includeCortical', value)}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.background}
        />
      </View>
    </View>
  );

  const renderModelCard = (modelType: ModelType) => {
    const info = MODEL_INFO[modelType];
    const modelConfig = config[modelType];
    const enabled = modelConfig.enabled;

    return (
      <View
        key={modelType}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
          borderWidth: 2,
          borderColor: enabled ? info.color : colors.border,
        }}
      >
        {/* Model Header */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
          <Text style={{ fontSize: 24, marginRight: 8 }}>{info.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground }}>
              {info.name}
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
              {info.parameters}M params • {info.inferenceTime}
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={() => toggleModel(modelType)}
            trackColor={{ false: colors.border, true: info.color }}
            thumbColor={colors.background}
          />
        </View>

        {/* Model Description */}
        <Text style={{ fontSize: 14, color: colors.foreground, marginBottom: 8, lineHeight: 20 }}>
          {info.description}
        </Text>
        <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 8, lineHeight: 18 }}>
          {info.useCase}
        </Text>

        {/* Model-Specific Controls */}
        {enabled && (
          <>
            {modelType === 'unet' && renderUNetControls()}
            {modelType === 'medsam2' && renderMedSAM2Controls()}
            {modelType === 'sam3' && renderSAM3Controls()}
            {modelType === 'synthseg' && renderSynthSegControls()}
          </>
        )}
      </View>
    );
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.foreground }}>
            Model Configuration
          </Text>
          <Text style={{ fontSize: 16, color: colors.muted, marginTop: 8, lineHeight: 22 }}>
            Select models and adjust parameters for analysis
          </Text>
        </View>

        {/* Presets */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground, marginBottom: 12 }}>
            Quick Presets
          </Text>
          <View style={{ gap: 8 }}>
            {MODEL_PRESETS.map((preset, index) => (
              <TouchableOpacity
                key={preset.name}
                onPress={() => handlePresetSelect(index)}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor: selectedPreset === preset.name ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: selectedPreset === preset.name ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: selectedPreset === preset.name ? colors.background : colors.foreground,
                    marginBottom: 4,
                  }}
                >
                  {preset.name}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: selectedPreset === preset.name ? colors.background : colors.muted,
                    lineHeight: 18,
                  }}
                >
                  {preset.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Model Cards */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground, marginBottom: 12 }}>
            Individual Models
          </Text>
          {(['unet', 'medsam2', 'sam3', 'synthseg'] as const).map((modelType) =>
            renderModelCard(modelType)
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSaveConfig}
          style={{
            backgroundColor: colors.primary,
            paddingVertical: 16,
            borderRadius: 12,
            marginBottom: 32,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: colors.background,
              textAlign: 'center',
            }}
          >
            Save Configuration
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
