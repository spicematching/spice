import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';

function TabIcon({ emoji, size }: { emoji: string; size?: number }) {
  return <Text style={{ fontSize: size ?? 20 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopColor: '#333',
          height: 84,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#888',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'さがす',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji={focused ? '🔥' : '🔍'} />
          ),
        }}
      />
      <Tabs.Screen
        name="popular"
        options={{
          title: '人気',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji={focused ? '👑' : '✨'} />
          ),
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={styles.postButton}>
              <Text style={styles.postButtonText}>＋</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'マッチ',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji={focused ? '💬' : '💭'} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'マイページ',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji={focused ? '👤' : '👥'} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  postButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  postButtonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: -2,
  },
});
