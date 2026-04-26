import { Tabs } from 'expo-router'
import { Text } from 'react-native'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#C9A84C',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: { backgroundColor: '#0D1B2A', borderTopColor: '#1a2d44' },
        headerStyle: { backgroundColor: '#0D1B2A' },
        headerTintColor: '#F5F0E8',
        headerTitleStyle: { fontFamily: 'serif', letterSpacing: 1 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🗺</Text>,
        }}
      />
      <Tabs.Screen
        name="my-passports"
        options={{
          title: 'My Passports',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📖</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text>,
        }}
      />
    </Tabs>
  )
}
