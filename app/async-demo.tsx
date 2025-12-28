/**
 * Async Processing Demo Screen
 * Demonstrates async job processing and progress tracking
 */

import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AsyncJobProgress } from '@/components/async-job-progress';
import { useColors } from '@/hooks/use-colors';
import {
  createAsyncJob,
  processAsyncJob,
  getActiveJobs,
  clearCompletedJobs,
  type AsyncJob,
} from '@/services/async-processing';

export default function AsyncDemoScreen() {
  const colors = useColors();
  const [activeJobIds, setActiveJobIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  const handleStartJob = async (type: AsyncJob['type']) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setProcessing(true);

      // Create a test image URI (you can replace with actual image)
      const testImageUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      // Create async job
      const job = await createAsyncJob(type, testImageUri);
      setActiveJobIds(prev => [...prev, job.id]);

      // Start processing in background
      processAsyncJob(job.id, (progress) => {
        console.log(`Job ${job.id} progress: ${progress}%`);
      }).catch(error => {
        console.error('Job processing error:', error);
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error starting job:', error);
      Alert.alert('Error', 'Failed to start job. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setProcessing(false);
    }
  };

  const handleJobComplete = (jobId: string, result: any) => {
    console.log(`Job ${jobId} completed:`, result);
    Alert.alert('Success', 'Job completed successfully!', [
      {
        text: 'View Result',
        onPress: () => console.log('Result:', result),
      },
      { text: 'OK' },
    ]);
  };

  const handleJobError = (jobId: string, error: string) => {
    console.error(`Job ${jobId} failed:`, error);
    Alert.alert('Error', `Job failed: ${error}`);
  };

  const handleJobCancel = (jobId: string) => {
    console.log(`Job ${jobId} cancelled`);
    setActiveJobIds(prev => prev.filter(id => id !== jobId));
  };

  const handleClearCompleted = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await clearCompletedJobs();
      
      // Refresh active jobs
      const activeJobs = await getActiveJobs();
      setActiveJobIds(activeJobs.map(job => job.id));
      
      Alert.alert('Success', 'Completed jobs cleared');
    } catch (error) {
      console.error('Error clearing jobs:', error);
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          <IconSymbol name="chevron.left.forwardslash.chevron.right" size={24} color={colors.foreground} />
        </Pressable>
        <Text className="text-lg font-semibold text-foreground">
          Async Processing Demo
        </Text>
        <Pressable
          onPress={handleClearCompleted}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          <Text className="text-sm font-medium text-primary">Clear</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-4 py-6" contentContainerStyle={{ gap: 16 }}>
        {/* Info Card */}
        <View className="bg-surface rounded-xl p-4 border border-border">
          <Text className="text-base font-semibold text-foreground mb-2">
            About Async Processing
          </Text>
          <Text className="text-sm text-muted leading-relaxed">
            Long-running ML tasks (like SynthSeg brain segmentation) now run in the background
            with real-time progress updates. You can start multiple jobs and track their progress
            independently.
          </Text>
        </View>

        {/* Start Job Buttons */}
        <View className="gap-3">
          <Text className="text-base font-semibold text-foreground">
            Start New Job
          </Text>

          <Pressable
            onPress={() => handleStartJob('synthseg')}
            disabled={processing}
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                padding: 16,
                borderRadius: 12,
                opacity: pressed || processing ? 0.7 : 1,
              },
            ]}
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-base font-semibold text-background">
                  SynthSeg Brain Segmentation
                </Text>
                <Text className="text-sm text-background opacity-80">
                  ~45 seconds (CPU-intensive)
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color={colors.background} />
            </View>
          </Pressable>

          <Pressable
            onPress={() => handleStartJob('unet')}
            disabled={processing}
            style={({ pressed }) => [
              {
                backgroundColor: colors.surface,
                padding: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed || processing ? 0.7 : 1,
              },
            ]}
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-base font-semibold text-foreground">
                  UNet Lesion Detection
                </Text>
                <Text className="text-sm text-muted">
                  ~2 seconds (fast)
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color={colors.foreground} />
            </View>
          </Pressable>

          <Pressable
            onPress={() => handleStartJob('medsam2')}
            disabled={processing}
            style={({ pressed }) => [
              {
                backgroundColor: colors.surface,
                padding: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed || processing ? 0.7 : 1,
              },
            ]}
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-base font-semibold text-foreground">
                  MedSAM2 Interactive Segmentation
                </Text>
                <Text className="text-sm text-muted">
                  ~3 seconds
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color={colors.foreground} />
            </View>
          </Pressable>

          <Pressable
            onPress={() => handleStartJob('sam3')}
            disabled={processing}
            style={({ pressed }) => [
              {
                backgroundColor: colors.surface,
                padding: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed || processing ? 0.7 : 1,
              },
            ]}
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-base font-semibold text-foreground">
                  SAM3 Zero-Shot Segmentation
                </Text>
                <Text className="text-sm text-muted">
                  ~3 seconds
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color={colors.foreground} />
            </View>
          </Pressable>
        </View>

        {/* Active Jobs */}
        {activeJobIds.length > 0 && (
          <View className="gap-3">
            <Text className="text-base font-semibold text-foreground">
              Active Jobs ({activeJobIds.length})
            </Text>
            {activeJobIds.map(jobId => (
              <AsyncJobProgress
                key={jobId}
                jobId={jobId}
                onComplete={(result) => handleJobComplete(jobId, result)}
                onError={(error) => handleJobError(jobId, error)}
                onCancel={() => handleJobCancel(jobId)}
              />
            ))}
          </View>
        )}

        {/* Empty State */}
        {activeJobIds.length === 0 && (
          <View className="bg-surface rounded-xl p-8 items-center border border-border">
            <Text className="text-base text-muted text-center">
              No active jobs. Start a new job above to see progress tracking in action.
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
