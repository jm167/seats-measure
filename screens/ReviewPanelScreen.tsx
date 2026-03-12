import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Image, LayoutChangeEvent, Pressable } from 'react-native';
import { useRoute } from '@react-navigation/native';
import Svg, { Polygon, Circle } from 'react-native-svg';

type NormalizedPoint = {
  x: number;
  y: number;
};

type RouteParams = {
  imageUri: string;
  rawPoints: NormalizedPoint[];
  refinedPoints?: NormalizedPoint[];
};

export const ReviewPanelScreen: React.FC = () => {
  const route = useRoute<any>();
  const params = route.params as RouteParams | undefined;
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [mode, setMode] = useState<'raw' | 'refined'>('refined');

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  if (!params || !params.imageUri || !params.rawPoints || params.rawPoints.length < 3) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.title}>No panel data</Text>
        <Text style={styles.subtitle}>
          Capture and outline a panel first, then you&apos;ll see it here for review.
        </Text>
      </View>
    );
  }

  const { imageUri, rawPoints, refinedPoints } = params;
  const activePoints =
    mode === 'refined' && refinedPoints && refinedPoints.length >= 3
      ? refinedPoints
      : rawPoints;

  return (
    <View style={styles.container}>
      <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <View style={StyleSheet.absoluteFill} onLayout={handleLayout}>
        {size && (
          <Svg width={size.width} height={size.height}>
            <Polygon
              points={activePoints
                .map((p) => `${p.x * size.width},${p.y * size.height}`)
                .join(' ')}
              fill="rgba(34, 197, 94, 0.25)"
              stroke="#22c55e"
              strokeWidth={2}
            />
            {activePoints.map((p, index) => (
              <Circle
                key={`${p.x}-${p.y}-${index}`}
                cx={p.x * size.width}
                cy={p.y * size.height}
                r={5}
                fill="#22c55e"
                stroke="#022c22"
                strokeWidth={1}
              />
            ))}
          </Svg>
        )}
      </View>
      <View style={styles.infoBar}>
        <View style={styles.infoLeft}>
          <Text style={styles.infoText}>
            Points: <Text style={styles.infoValue}>{activePoints.length}</Text>
          </Text>
        </View>
        <View style={styles.toggleGroup}>
          <Pressable
            style={[
              styles.toggleButton,
              mode === 'raw' && styles.toggleButtonActive,
            ]}
            onPress={() => setMode('raw')}
          >
            <Text
              style={[
                styles.toggleLabel,
                mode === 'raw' && styles.toggleLabelActive,
              ]}
            >
              Raw
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.toggleButton,
              mode === 'refined' && styles.toggleButtonActive,
            ]}
            onPress={() => setMode('refined')}
          >
            <Text
              style={[
                styles.toggleLabel,
                mode === 'refined' && styles.toggleLabelActive,
              ]}
            >
              Refined
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e5e7eb',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    lineHeight: 22,
  },
  infoText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  infoValue: {
    color: '#22c55e',
    fontWeight: '700',
  },
  infoBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(2, 6, 23, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleGroup: {
    flexDirection: 'row',
    columnGap: 8,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4b5563',
    backgroundColor: 'transparent',
  },
  toggleButtonActive: {
    backgroundColor: '#22c55e33',
    borderColor: '#22c55e',
  },
  toggleLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  toggleLabelActive: {
    color: '#e5e7eb',
    fontWeight: '600',
  },
});

