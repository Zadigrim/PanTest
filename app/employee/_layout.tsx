import { Stack } from 'expo-router'

export default function EmployeeLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0D1B2A' },
        headerTintColor: '#F5F0E8',
        headerTitleStyle: { fontFamily: 'serif' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'PanoplyConnect' }} />
      <Stack.Screen name="verify" options={{ title: 'Verify Experience' }} />
      <Stack.Screen
        name="redeem"
        options={{
          title: 'Prize Distribution',
          headerBackVisible: false, // Cannot dismiss without completing step 2
          gestureEnabled: false,
        }}
      />
    </Stack>
  )
}
