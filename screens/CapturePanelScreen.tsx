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

const fitEllipseFromPoints = (
  points: NormalizedPoint[],
  sampleCount: number = 72,
): NormalizedPoint[] => {
  if (points.length < 3) {
    return points;
  }

  const n = points.length;

  // Centroid
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    cx += points[i].x;
    cy += points[i].y;
  }
  cx /= n;
  cy /= n;

  // Covariance matrix around centroid
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = points[i].x - cx;
    const dy = points[i].y - cy;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  sxx /= n;
  syy /= n;
  sxy /= n;

  // Eigen decomposition of 2x2 covariance to get principal directions
  const trace = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const disc = Math.max(0, trace * trace * 0.25 - det);
  const root = Math.sqrt(disc);
  const lambda1 = trace * 0.5 + root;
  const lambda2 = trace * 0.5 - root;

  let v1x: number;
  let v1y: number;
  if (Math.abs(sxy) > 1e-6) {
    v1x = lambda1 - syy;
    v1y = sxy;
  } else if (sxx >= syy) {
    v1x = 1;
    v1y = 0;
  } else {
    v1x = 0;
    v1y = 1;
  }
  const v1Len = Math.hypot(v1x, v1y) || 1;
  v1x /= v1Len;
  v1y /= v1Len;

  // Second axis is orthogonal
  const v2x = -v1y;
  const v2y = v1x;

  // Project points onto axes to estimate radii
  let maxProj1 = 0;
  let maxProj2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = points[i].x - cx;
    const dy = points[i].y - cy;
    const proj1 = Math.abs(dx * v1x + dy * v1y);
    const proj2 = Math.abs(dx * v2x + dy * v2y);
    if (proj1 > maxProj1) maxProj1 = proj1;
    if (proj2 > maxProj2) maxProj2 = proj2;
  }

  if (maxProj1 <= 0 || maxProj2 <= 0) {
    return points;
  }

  const a = maxProj1;
  const b = maxProj2;

  const result: NormalizedPoint[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = (2 * Math.PI * i) / sampleCount;
    const cosT = Math.cos(t);
    const sinT = Math.sin(t);

    const localX = a * cosT;
    const localY = b * sinT;

    const worldX = cx + localX * v1x + localY * v2x;
    const worldY = cy + localX * v1y + localY * v2y;

    result.push({
      x: Math.max(0, Math.min(1, worldX)),
      y: Math.max(0, Math.min(1, worldY)),
    });
  }

  return result;
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

    const refinedPoints = fitEllipseFromPoints(smoothPolygon(normalizedPoints));

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

