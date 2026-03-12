import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { CapturePanelScreen } from './screens/CapturePanelScreen';
import { ReviewPanelScreen } from './screens/ReviewPanelScreen';

export type RootStackParamList = {
  Home: undefined;
  CapturePanel: undefined;
  ReviewPanel: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: '#020617' },
          headerTintColor: '#e5e7eb',
          contentStyle: { backgroundColor: '#020617' },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Seats Measure' }}
        />
        <Stack.Screen
          name="CapturePanel"
          component={CapturePanelScreen}
          options={{ title: 'Capture Panel' }}
        />
        <Stack.Screen
          name="ReviewPanel"
          component={ReviewPanelScreen}
          options={{ title: 'Review Panel' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

type HomeScreenProps = {
  navigation: any;
};

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Seats Measure</Text>
      <Text style={styles.subtitle}>
        Start by capturing a seat panel. Later you&apos;ll outline it and review measurements.
      </Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => navigation.navigate('CapturePanel')}
      >
        <Text style={styles.primaryButtonText}>Capture Panel</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => navigation.navigate('ReviewPanel')}
      >
        <Text style={styles.secondaryButtonText}>Go to Review (placeholder)</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#e5e7eb',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 32,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#022c22',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    borderColor: '#4b5563',
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '500',
  },
});
