import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';

export type SidepanelItem = {
  key: string;
  label: string;
};

type Props = {
  items: SidepanelItem[];
  activeKey: string;
  onSelect: (key: string) => void;
};

export default function Sidepanel({ items, activeKey, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);
  const iconMap = {
    alerts: require('../assets/icons/alert-white.png'),
    documents: require('../assets/icons/document-white.png'),
    risk: require('../assets/icons/risk-white.png'),
    audit: require('../assets/icons/audit-white.png'),
    remediation: require('../assets/icons/remediation-white.png'),
    export: require('../assets/icons/export-white.png'),
    settings: require('../assets/icons/settings-white.png'),
  } as const;
  const iconFor = (key: string) => (iconMap as any)[key] ?? iconMap.alerts;

  return (
    <View
      style={[styles.sidepanel, expanded ? styles.sidepanelExpanded : styles.sidepanelCollapsed]}
      // @ts-ignore web-only
      onMouseEnter={() => setExpanded(true)}
      // @ts-ignore web-only
      onMouseLeave={() => setExpanded(false)}
    >
      <View style={styles.brandSpace}>
        {expanded && <Text style={styles.brand}>Julius Baer</Text>}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
        {items.map((item) => {
          const active = item.key === activeKey;
          return (
            <Pressable key={item.key} onPress={() => onSelect(item.key)} style={[styles.item, active && styles.itemActive]}>
              <View style={styles.itemRow}>
                <Image source={iconFor(item.key)} resizeMode="contain" style={styles.itemIcon} />
                {expanded && <Text style={[styles.itemText, active && styles.itemTextActive]}>{item.label}</Text>}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidepanel: {
    backgroundColor: '#0A7EA4',
    paddingTop: 16,
    paddingHorizontal: 12,
    height: '100%',
  },
  sidepanelCollapsed: { width: 64 },
  sidepanelExpanded: { width: 240 },
  brandSpace: { height: 36, justifyContent: 'center' },
  brand: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    marginBottom: 16,
  },
  item: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  itemActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemIcon: { width: 20, height: 20 },
  itemText: {
    color: '#e3f6ff',
    fontSize: 16,
    fontFamily: 'Inter-Medium',
  },
  itemTextActive: {
    color: '#fff',
  },
});