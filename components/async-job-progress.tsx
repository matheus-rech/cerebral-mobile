/**
 * Async Job Progress Component
 * Displays progress for long-running ML tasks
 */

import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from './ui/icon-symbol';
import type { AsyncJob } from '@/services/async-processing';
import { getAsyncJob, cancelAsyncJob } from '@/services/async-processing';
import * as Haptics from 'expo-haptics';

interface AsyncJobProgressProps {
  jobId: string;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

export function AsyncJobProgress({
  jobId,
  onComplete,
  onError,
  onCancel,
}: AsyncJobProgressProps) {
  const colors = useColors();
  const [job, setJob] = useState<AsyncJob | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);

  // Poll job status
  useEffect(() => {
    let mounted = true;
    let pollInterval: ReturnType<typeof setInterval>;

    const pollJob = async () => {
      const currentJob = await getAsyncJob(jobId);
      if (mounted && currentJob) {
        setJob(currentJob);

        // Handle completion
        if (currentJob.status === 'completed' && currentJob.result) {
          clearInterval(pollInterval);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onComplete?.(currentJob.result);
        }

        // Handle error
        if (currentJob.status === 'failed' && currentJob.error) {
          clearInterval(pollInterval);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          onError?.(currentJob.error);
        }

        // Handle cancellation
        if (currentJob.status === 'cancelled') {
          clearInterval(pollInterval);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          onCancel?.();
        }
      }
    };

    // Initial poll
    pollJob();

    // Poll every 500ms
    pollInterval = setInterval(pollJob, 500);

    return () => {
      mounted = false;
      clearInterval(pollInterval);
    };
  }, [jobId, onComplete, onError, onCancel]);

  // Track elapsed time
  useEffect(() => {
    if (!job || job.status !== 'processing') return;

    const startTime = job.startedAt ? new Date(job.startedAt).getTime() : Date.now();
    const timer = setInterval(() => {
      setTimeElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [job]);

  const handleCancel = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await cancelAsyncJob(jobId);
    } catch (error) {
      console.error('Error cancelling job:', error);
    }
  };

  if (!job) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.text, { color: colors.foreground }]}>Loading...</Text>
      </View>
    );
  }

  const getStatusIcon = () => {
    switch (job.status) {
      case 'pending':
        return 'chevron.right';
      case 'processing':
        return 'chevron.right';
      case 'completed':
        return 'house.fill';
      case 'failed':
        return 'house.fill';
      case 'cancelled':
        return 'house.fill';
      default:
        return 'chevron.right';
    }
  };

  const getStatusColor = () => {
    switch (job.status) {
      case 'completed':
        return colors.success;
      case 'failed':
        return colors.error;
      case 'cancelled':
        return colors.warning;
      default:
        return colors.primary;
    }
  };

  const getStatusText = () => {
    switch (job.status) {
      case 'pending':
        return 'Waiting to start...';
      case 'processing':
        return 'Processing...';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Unknown';
    }
  };

  const getModelName = () => {
    switch (job.type) {
      case 'synthseg':
        return 'SynthSeg Brain Segmentation';
      case 'unet':
        return 'UNet Lesion Detection';
      case 'medsam2':
        return 'MedSAM2 Interactive Segmentation';
      case 'sam3':
        return 'SAM3 Zero-Shot Segmentation';
      case 'lesion-3d':
        return '3D Lesion Tracking';
      default:
        return 'ML Processing';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const estimatedTimeRemaining = job.estimatedDuration
    ? Math.max(0, job.estimatedDuration - timeElapsed)
    : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconContainer, { backgroundColor: getStatusColor() + '20' }]}>
            <IconSymbol name={getStatusIcon()} size={20} color={getStatusColor()} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.modelName, { color: colors.foreground }]}>
              {getModelName()}
            </Text>
            <Text style={[styles.statusText, { color: colors.muted }]}>
              {getStatusText()}
            </Text>
          </View>
        </View>

        {/* Cancel button (only for pending/processing) */}
        {(job.status === 'pending' || job.status === 'processing') && (
          <Pressable
            onPress={handleCancel}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.cancelButtonText, { color: colors.error }]}>Cancel</Text>
          </Pressable>
        )}
      </View>

      {/* Progress bar */}
      {(job.status === 'pending' || job.status === 'processing') && (
        <>
          <View style={[styles.progressBarContainer, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressBar,
                {
                  backgroundColor: colors.primary,
                  width: `${job.progress}%`,
                },
              ]}
            />
          </View>

          {/* Progress details */}
          <View style={styles.progressDetails}>
            <Text style={[styles.progressText, { color: colors.muted }]}>
              {Math.round(job.progress)}% complete
            </Text>
            {job.status === 'processing' && (
              <Text style={[styles.progressText, { color: colors.muted }]}>
                {estimatedTimeRemaining > 0
                  ? `~${formatTime(estimatedTimeRemaining)} remaining`
                  : `${formatTime(timeElapsed)} elapsed`}
              </Text>
            )}
          </View>
        </>
      )}

      {/* Error message */}
      {job.status === 'failed' && job.error && (
        <View style={[styles.errorContainer, { backgroundColor: colors.error + '10' }]}>
          <Text style={[styles.errorText, { color: colors.error }]}>{job.error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  modelName: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 14,
  },
  cancelButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 12,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
  },
  text: {
    fontSize: 14,
  },
  pressed: {
    opacity: 0.7,
  },
});
