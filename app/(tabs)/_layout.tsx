import { Tabs } from 'expo-router'
import { Image, StyleSheet } from 'react-native'
import { Compass, Library, User, Tag } from 'lucide-react-native'
import { useEmployeeContext } from '../../contexts/EmployeeContext'
import { palette } from '../../lib/colors'

// Cream wordmark lockup for the dark (navy) header chrome — the "right
// lockup per surface" pairing: cream on dark, ink on light. Shown as the
// brand mark on the home (My Passports) header.
function HeaderLockup() {
  return (
    <Image
      source={require('../../assets/brand/okuji-lockup-cream.png')}
      style={styles.lockup}
      resizeMode="contain"
    />
  )
}

// Land on My Passports after login (splash → login → my passports).
export const unstable_settings = { initialRouteName: 'my-passports' }

export default function TabsLayout() {
  const { isEmployee, employeeMode } = useEmployeeContext()
  const showField = isEmployee && employeeMode

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: '#888',
        tabBarStyle: { backgroundColor: palette.navy, borderTopColor: '#1a2d44' },
        headerStyle: { backgroundColor: palette.navy },
        headerTintColor: palette.cream,
        headerTitleStyle: { fontWeight: '600', letterSpacing: 0.5 },
      }}
    >
      <Tabs.Screen
        name="my-passports"
        options={{
          title: 'My Passports',
          headerTitle: () => <HeaderLockup />,
          tabBarIcon: ({ color, size }) => <Library color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="field"
        options={{
          title: 'Field',
          href: showField ? undefined : null,
          tabBarIcon: ({ color, size }) => <Tag color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  lockup: { height: 24, width: 132 },
})
