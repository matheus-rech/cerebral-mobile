/**
 * Export Mask Modal Component
 * UI for exporting segmentation masks in PNG or NIfTI formats
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { IconSymbol } from './ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import {
  exportMask,
  shareMask,
  type MaskData,
  type ExportOptions,
} from '@/services/mask-export';

interface ExportMaskModalProps {
  visible: boolean;
  onClose: () => void;
  maskData: MaskData | null;
}

type ExportFormat = 'png' | 'nifti' | 'both';
type ColorScheme = 'red' | 'green' | 'blue' | 'yellow';

export function ExportMaskModal({ visible, onClose, maskData }: ExportMaskModalProps) {
  const colors = useColors();
  const [format, setFormat] = useState<ExportFormat>('png');
  const [colorScheme, setColorScheme] = useState<ColorScheme>('red');
  const [opacity, setOpacity] = useState(0.5);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedPaths, setExportedPaths] = useState<{ pngPath?: string; niftiPath?: string } | null>(null);

  const handleExport = async () => {
    if (!maskData) return;

    setIsExporting(true);
    try {
      const options: Partial<ExportOptions> = {
        format,
        colorScheme,
        opacity,
        includeOverlay: true,
      };

      const paths = await exportMask(maskData, options);
      setExportedPaths(paths);

      Alert.alert(
        'Export Successful',
        `Mask exported successfully!\n${paths.pngPath ? 'PNG: ' + paths.pngPath.split('/').pop() : ''}${paths.niftiPath ? '\nNIfTI: ' + paths.niftiPath.split('/').pop() : ''}`,
        [
          { text: 'Share', onPress: () => handleShare(paths) },
          { text: 'Done', style: 'cancel' },
        ]
      );
    } catch (error) {
      Alert.alert('Export Failed', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async (paths: { pngPath?: string; niftiPath?: string }) => {
    try {
      if (paths.pngPath) {
        await shareMask(paths.pngPath);
      } else if (paths.niftiPath) {
        await shareMask(paths.niftiPath);
      }
    } catch (error) {
      Alert.alert('Share Failed', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const formatOptions: { value: ExportFormat; label: string; description: string }[] = [
    { value: 'png', label: 'PNG', description: 'Standard image format' },
    { value: 'nifti', label: 'NIfTI', description: 'Medical imaging format' },
    { value: 'both', label: 'Both', description: 'Export in both formats' },
  ];

  const colorOptions: { value: ColorScheme; color: string; label: string }[] = [
    { value: 'red', color: '#FF0000', label: 'Red' },
    { value: 'green', color: '#00FF00', label: 'Green' },
    { value: 'blue', color: '#0000FF', label: 'Blue' },
    { value: 'yellow', color: '#FFFF00', label: 'Yellow' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            paddingBottom: Platform.OS === 'ios' ? 40 : 20,
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.foreground }}>
              Export Mask
            </Text>
            <TouchableOpacity onPress={onClose}>
              <IconSymbol name="chevron.right" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Mask Info */}
          {maskData && (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 12,
                marginBottom: 20,
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 12 }}>Model</Text>
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '600' }}>
                {maskData.modelName}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>Confidence</Text>
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '600' }}>
                {(maskData.confidence * 100).toFixed(1)}%
              </Text>
            </View>
          )}

          {/* Format Selection */}
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
            Export Format
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            {formatOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => setFormat(option.value)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: format === option.value ? colors.primary : colors.surface,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: format === option.value ? '#FFFFFF' : colors.foreground,
                    fontWeight: '600',
                  }}
                >
                  {option.label}
                </Text>
                <Text
                  style={{
                    color: format === option.value ? 'rgba(255,255,255,0.7)' : colors.muted,
                    fontSize: 10,
                    marginTop: 2,
                  }}
                >
                  {option.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Color Selection (for PNG) */}
          {(format === 'png' || format === 'both') && (
            <>
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
                Mask Color
              </Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                {colorOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setColorScheme(option.value)}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: option.color,
                      borderWidth: colorScheme === option.value ? 3 : 0,
                      borderColor: colors.foreground,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    {colorScheme === option.value && (
                      <IconSymbol name="house.fill" size={20} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Opacity Slider */}
          {(format === 'png' || format === 'both') && (
            <>
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
                Opacity: {Math.round(opacity * 100)}%
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                {[0.25, 0.5, 0.75, 1.0].map((value) => (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setOpacity(value)}
                    style={{
                      flex: 1,
                      padding: 8,
                      borderRadius: 8,
                      backgroundColor: opacity === value ? colors.primary : colors.surface,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: opacity === value ? '#FFFFFF' : colors.foreground,
                        fontWeight: '500',
                      }}
                    >
                      {Math.round(value * 100)}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Export Button */}
          <TouchableOpacity
            onPress={handleExport}
            disabled={isExporting || !maskData}
            style={{
              backgroundColor: isExporting || !maskData ? colors.muted : colors.primary,
              padding: 16,
              borderRadius: 12,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {isExporting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <IconSymbol name="paperplane.fill" size={20} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
                  Export Mask
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Recent Export */}
          {exportedPaths && (
            <TouchableOpacity
              onPress={() => handleShare(exportedPaths)}
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 8,
                backgroundColor: colors.surface,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <IconSymbol name="paperplane.fill" size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, flex: 1 }}>
                Share last export
              </Text>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default ExportMaskModal;
