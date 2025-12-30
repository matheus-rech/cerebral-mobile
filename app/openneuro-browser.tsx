import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';
import * as OpenNeuro from '@/services/openneuro';

export default function OpenNeuroBrowserScreen() {
  const [datasets, setDatasets] = useState<OpenNeuro.OpenNeuroDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<OpenNeuro.DatasetDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const haptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  };

  const loadDatasets = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const result = await OpenNeuro.searchDatasets(20);
      setDatasets(result.datasets);
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load datasets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;

    try {
      setLoadingMore(true);
      const result = await OpenNeuro.searchDatasets(20, nextCursor);
      setDatasets((prev) => [...prev, ...result.datasets]);
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
    } catch (err) {
      console.error('Failed to load more datasets:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadDatasetDetails = async (datasetId: string) => {
    try {
      setLoadingDetails(true);
      const details = await OpenNeuro.getDatasetDetails(datasetId);
      setSelectedDataset(details);
    } catch (err) {
      console.error('Failed to load dataset details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  const handleDatasetPress = (dataset: OpenNeuro.OpenNeuroDataset) => {
    haptic();
    loadDatasetDetails(dataset.id);
  };

  const handleFilePress = (file: OpenNeuro.DatasetFile) => {
    if (!selectedDataset) return;
    haptic();

    const fileUrl = OpenNeuro.getPublicFileUrl(
      selectedDataset.id,
      selectedDataset.latestVersion,
      file.filename
    );

    if (file.filename.endsWith('.nii') || file.filename.endsWith('.nii.gz')) {
      // Navigate to 3D viewer for NIfTI files
      router.push({
        pathname: '/viewer-3d',
        params: {
          imageUri: fileUrl,
          title: `${selectedDataset.name} - ${file.filename}`,
        },
      });
    } else {
      // For other files, show info
      console.log('File URL:', fileUrl);
    }
  };

  const renderDatasetItem = ({ item }: { item: OpenNeuro.OpenNeuroDataset }) => (
    <TouchableOpacity
      onPress={() => handleDatasetPress(item)}
      className="bg-surface rounded-xl p-4 mb-3 border border-border"
      style={{ opacity: selectedDataset?.id === item.id ? 0.7 : 1 }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-foreground font-semibold text-base" numberOfLines={2}>
            {item.name}
          </Text>
          <Text className="text-muted text-xs mt-1">{item.id}</Text>
        </View>
        <View className="bg-primary/20 px-2 py-1 rounded">
          <Text className="text-primary text-xs font-medium">v{item.latestVersion}</Text>
        </View>
      </View>

      {item.description && (
        <Text className="text-muted text-sm mt-2" numberOfLines={2}>
          {item.description}
        </Text>
      )}

      <View className="flex-row flex-wrap gap-2 mt-3">
        {item.modalities?.slice(0, 3).map((modality, idx) => (
          <View key={idx} className="bg-blue-500/20 px-2 py-1 rounded">
            <Text className="text-blue-400 text-xs">{modality}</Text>
          </View>
        ))}
        {item.subjectCount > 0 && (
          <View className="bg-green-500/20 px-2 py-1 rounded">
            <Text className="text-green-400 text-xs">{item.subjectCount} subjects</Text>
          </View>
        )}
        <View className="bg-purple-500/20 px-2 py-1 rounded">
          <Text className="text-purple-400 text-xs">
            {OpenNeuro.formatFileSize(item.size)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFileItem = ({ item }: { item: OpenNeuro.DatasetFile }) => {
    const isNifti = item.filename.endsWith('.nii') || item.filename.endsWith('.nii.gz');
    const isJson = item.filename.endsWith('.json');

    return (
      <TouchableOpacity
        onPress={() => handleFilePress(item)}
        disabled={item.directory}
        className={`bg-surface rounded-lg p-3 mb-2 border border-border ${
          item.directory ? 'opacity-50' : ''
        }`}
      >
        <View className="flex-row items-center">
          <Text className="text-lg mr-2">
            {item.directory ? '📁' : isNifti ? '🧠' : isJson ? '📄' : '📎'}
          </Text>
          <View className="flex-1">
            <Text
              className={`text-sm ${isNifti ? 'text-primary font-medium' : 'text-foreground'}`}
              numberOfLines={1}
            >
              {item.filename}
            </Text>
            {!item.directory && (
              <Text className="text-muted text-xs">
                {OpenNeuro.formatFileSize(item.size)}
              </Text>
            )}
          </View>
          {isNifti && (
            <View className="bg-primary px-2 py-1 rounded">
              <Text className="text-white text-xs">View 3D</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (selectedDataset) {
    return (
      <ScreenContainer className="p-4">
        {/* Header */}
        <View className="flex-row items-center mb-4">
          <TouchableOpacity
            onPress={() => {
              haptic();
              setSelectedDataset(null);
            }}
            className="p-2 mr-2"
          >
            <Text className="text-primary text-lg">← Back</Text>
          </TouchableOpacity>
          <Text className="text-foreground font-bold text-lg flex-1" numberOfLines={1}>
            {selectedDataset.name}
          </Text>
        </View>

        {/* Dataset Info */}
        <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
          <Text className="text-muted text-xs mb-1">{selectedDataset.id}</Text>
          <Text className="text-foreground text-sm mb-3">{selectedDataset.description}</Text>

          <View className="flex-row flex-wrap gap-2">
            {selectedDataset.modalities?.map((mod, idx) => (
              <View key={idx} className="bg-blue-500/20 px-2 py-1 rounded">
                <Text className="text-blue-400 text-xs">{mod}</Text>
              </View>
            ))}
            {selectedDataset.subjectCount > 0 && (
              <View className="bg-green-500/20 px-2 py-1 rounded">
                <Text className="text-green-400 text-xs">
                  {selectedDataset.subjectCount} subjects
                </Text>
              </View>
            )}
            <View className="bg-purple-500/20 px-2 py-1 rounded">
              <Text className="text-purple-400 text-xs">
                {OpenNeuro.formatFileSize(selectedDataset.size)}
              </Text>
            </View>
          </View>

          {selectedDataset.authors && selectedDataset.authors.length > 0 && (
            <Text className="text-muted text-xs mt-3">
              Authors: {selectedDataset.authors.slice(0, 3).join(', ')}
              {selectedDataset.authors.length > 3 && ' et al.'}
            </Text>
          )}
        </View>

        {/* Quick Access to Subject Scans */}
        <Text className="text-foreground font-semibold mb-2">Quick Access - Subject Scans</Text>
        <Text className="text-muted text-xs mb-3">
          Tap to load T1-weighted anatomical scan directly
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((subNum) => {
            const subId = subNum.toString().padStart(2, '0');
            const niftiUrl = `https://s3.amazonaws.com/openneuro.org/${selectedDataset.id}/sub-${subId}/anat/sub-${subId}_T1w.nii.gz`;
            return (
              <TouchableOpacity
                key={subNum}
                onPress={() => {
                  haptic();
                  router.push({
                    pathname: '/viewer-3d',
                    params: {
                      imageUri: niftiUrl,
                      title: `${selectedDataset.name} - Subject ${subId}`,
                    },
                  });
                }}
                className="bg-primary/20 px-3 py-2 rounded-lg border border-primary/30"
              >
                <Text className="text-primary font-medium">🧠 sub-{subId}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Files */}
        <Text className="text-foreground font-semibold mb-2">
          Files ({selectedDataset.files.length})
        </Text>
        <Text className="text-muted text-xs mb-3">
          Tap a NIfTI file (.nii.gz) to view in 3D viewer
        </Text>

        {loadingDetails ? (
          <ActivityIndicator size="large" color="#0a7ea4" />
        ) : (
          <FlatList
            data={selectedDataset.files.filter((f) => !f.directory).slice(0, 50)}
            renderItem={renderFileItem}
            keyExtractor={(item) => item.filename}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text className="text-muted text-center py-8">No files found</Text>
            }
          />
        )}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <TouchableOpacity
          onPress={() => {
            haptic();
            router.back();
          }}
          className="p-2"
        >
          <Text className="text-primary text-lg">← Back</Text>
        </TouchableOpacity>
        <Text className="text-foreground font-bold text-xl">OpenNeuro</Text>
        <View className="w-12" />
      </View>

      <Text className="text-muted text-sm mb-4">
        Browse real neuroimaging datasets from OpenNeuro.org
      </Text>

      {/* Popular Datasets Quick Access */}
      <View className="mb-4">
        <Text className="text-foreground font-semibold mb-2">Quick Access</Text>
        <FlatList
          horizontal
          data={OpenNeuro.getPopularDatasets().slice(0, 5)}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                haptic();
                loadDatasetDetails(item.id);
              }}
              className="bg-primary/20 rounded-lg px-3 py-2 mr-2"
            >
              <Text className="text-primary text-xs font-medium">{item.id}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
        />
      </View>

      {/* Error State */}
      {error && (
        <View className="bg-error/20 rounded-xl p-4 mb-4">
          <Text className="text-error text-center">{error}</Text>
          <TouchableOpacity
            onPress={() => loadDatasets()}
            className="mt-2 bg-error px-4 py-2 rounded-lg self-center"
          >
            <Text className="text-white font-medium">Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading State */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0a7ea4" />
          <Text className="text-muted mt-4">Loading datasets from OpenNeuro...</Text>
        </View>
      ) : (
        <FlatList
          data={datasets}
          renderItem={renderDatasetItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadDatasets(true)} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color="#0a7ea4" className="py-4" />
            ) : null
          }
          ListEmptyComponent={
            <Text className="text-muted text-center py-8">No datasets found</Text>
          }
        />
      )}
    </ScreenContainer>
  );
}
