import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Circle, Polygon } from 'react-native-svg';

type Point = {
  x: number;
  y: number;
};

type NormalizedPoint = {
  x: number;
  y: number;
};

const smoothPolygon = (
  points: NormalizedPoint[],
  iterations: number = 1,
  lambda: number = 0.25,
): NormalizedPoint[] => {
  if (points.length < 3) {
    return points;
  }

  let current = points.map((p) => ({ ...p }));

  for (let iter = 0; iter < iterations; iter++) {
    const next = current.map((p) => ({ ...p }));

    for (let i = 0; i < current.length; i++) {
      const prev = current[(i - 1 + current.length) % current.length];
      const nextPoint = current[(i + 1) % current.length];

      const avgX = (prev.x + nextPoint.x) / 2;
      const avgY = (prev.y + nextPoint.y) / 2;

      next[i].x = (1 - lambda) * current[i].x + lambda * avgX;
      next[i].y = (1 - lambda) * current[i].y + lambda * avgY;

      // Clamp to [0, 1] just in case
      next[i].x = Math.max(0, Math.min(1, next[i].x));
      next[i].y = Math.max(0, Math.min(1, next[i].y));
    }

    current = next;
  }

  return current;
};

export const CapturePanelScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  const handleCaptureFrame = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync();
      setCapturedUri(photo.uri);
      setPoints([]);
    } catch (error) {
      console.warn('Failed to capture frame', error);
    }
  }, []);

  const handleTapOnFrozen = useCallback(
    (event: any) => {
      if (!size || !capturedUri) return;
      const { locationX, locationY } = event.nativeEvent;
      setPoints((prev) => [...prev, { x: locationX, y: locationY }]);
    },
    [size, capturedUri],
  );

  const handleUndo = useCallback(() => {
    setPoints((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setPoints([]);
  }, []);

  const handleDone = useCallback(() => {
    if (!capturedUri || points.length < 3) {
      return;
    }

    if (!size) {
      return;
    }

    const normalizedPoints: NormalizedPoint[] = points.map((p) => ({
      x: p.x / size.width,
      y: p.y / size.height,
    }));

    const refinedPoints = smoothPolygon(normalizedPoints);

    navigation.navigate('ReviewPanel', {
      imageUri: capturedUri,
      rawPoints: normalizedPoints,
      refinedPoints,
    });
  }, [capturedUri, points, size, navigation]);

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22c55e" />
        <Text style={styles.infoText}>Checking camera permissions…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.infoText}>
          We need access to your camera to capture the seat panel.
        </Text>
        <Text style={[styles.infoText, { marginTop: 12 }]}>
          Please grant permission in the prompt or your system settings.
        </Text>
        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Grant camera access</Text>
        </Pressable>
      </View>
    );
  }

  const hasPolygon = !!capturedUri && points.length >= 3;

  return (
    <View style={styles.container}>
      {capturedUri ? (
        <Image source={{ uri: capturedUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      )}

      <View style={styles.touchLayer} onLayout={handleLayout}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={capturedUri ? handleTapOnFrozen : handleCaptureFrame}
        >
          {capturedUri && size && points.length > 0 && (
            <Svg width={size.width} height={size.height}>
              {points.length >= 3 && (
                <Polygon
                  points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="rgba(34, 197, 94, 0.25)"
                  stroke="#22c55e"
                  strokeWidth={2}
                />
              )}
              {points.map((p, index) => (
                <Circle
                  key={`${p.x}-${p.y}-${index}`}
                  cx={p.x}
                  cy={p.y}
                  r={5}
                  fill="#22c55e"
                  stroke="#022c22"
                  strokeWidth={1}
                />
              ))}
            </Svg>
          )}
        </Pressable>
      </View>

      <View style={styles.overlay}>
        <View style={styles.overlayHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.overlayTitle}>Capture Panel</Text>
            <Text style={styles.overlaySubtitle}>
              First tap freezes the frame. Then tap around the panel edge to place points.
            </Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{points.length} pts</Text>
          </View>
        </View>
        <View style={styles.buttonsRow}>
          <Pressable
            style={[
              styles.secondaryButton,
              (!capturedUri || points.length === 0) && styles.disabledButton,
            ]}
            onPress={handleUndo}
            disabled={!capturedUri || points.length === 0}
          >
            <Text
              style={[
                styles.secondaryButtonText,
                (!capturedUri || points.length === 0) && styles.disabledButtonText,
              ]}
            >
              Undo
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.secondaryButton,
              (!capturedUri || points.length === 0) && styles.disabledButton,
            ]}
            onPress={handleClear}
            disabled={!capturedUri || points.length === 0}
          >
            <Text
              style={[
                styles.secondaryButtonText,
                (!capturedUri || points.length === 0) && styles.disabledButtonText,
              ]}
            >
              Clear
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.primaryButton,
              !hasPolygon && styles.disabledPrimaryButton,
            ]}
            onPress={handleDone}
            disabled={!hasPolygon}
          >
            <Text
              style={[
                styles.primaryButtonText,
                !hasPolygon && styles.disabledPrimaryButtonText,
              ]}
            >
              Done
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
  touchLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  centered: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e5e7eb',
    marginBottom: 8,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(2, 6, 23, 0.75)',
  },
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  overlayTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#e5e7eb',
  },
  overlaySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  chip: {
    marginLeft: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 118, 110, 0.35)',
  },
  chipText: {
    fontSize: 12,
    color: '#a5f3fc',
    fontWeight: '600',
  },
  buttonsRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  secondaryButton: {
    borderColor: '#4b5563',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  secondaryButtonText: {
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: '500',
  },
  primaryButton: {
    marginLeft: 8,
    backgroundColor: '#22c55e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  primaryButtonText: {
    color: '#022c22',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    borderColor: '#374151',
  },
  disabledButtonText: {
    color: '#6b7280',
  },
  disabledPrimaryButton: {
    backgroundColor: '#16a34a55',
  },
  disabledPrimaryButtonText: {
    color: '#064e3b',
  },
});

