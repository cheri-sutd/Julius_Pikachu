import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  return (
    <View style={styles.sidepanel}>
      <Text style={styles.brand}>Julius Baer</Text>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          // highlights active item
          <Pressable key={item.key} onPress={() => onSelect(item.key)} style={[styles.item, active && styles.itemActive]}> 
            <Text style={[styles.itemText, active && styles.itemTextActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sidepanel: {
    width: 240,
    backgroundColor: '#0A7EA4',
    paddingTop: 16,
    paddingHorizontal: 12,
  },
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
  itemText: {
    color: '#e3f6ff',
    fontSize: 16,
    fontFamily: 'Inter-Medium',
  },
  itemTextActive: {
    color: '#fff',
  },
});