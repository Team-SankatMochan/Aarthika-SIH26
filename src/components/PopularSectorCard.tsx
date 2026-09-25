import React, { useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  Image,
  Platform,
  ImageSourcePropType,
} from 'react-native';

interface PopularSectorCardProps {
  id: string;
  label: string;
  sub: string;
  image?: ImageSourcePropType;
  icon?: string;
  type?: 'sector' | 'action';
  actionBadgeText?: string;
  onPress: () => void;
  width?: number;
  isFocused?: boolean;
  scrollX?: Animated.Value;
  index?: number;
  snapInterval?: number;
}

export const PopularSectorCard: React.FC<PopularSectorCardProps> = ({
  id,
  label,
  sub,
  image,
  icon = '🌾',
  type = 'sector',
  actionBadgeText = 'View 16+ Categories →',
  onPress,
  width = 280,
  isFocused = false,
  scrollX,
  index,
  snapInterval,
}) => {
  const [isActive, setIsActive] = useState(false);
  const [touchScaleAnim] = useState(() => new Animated.Value(1));

  // Touch press animation
  const handlePressIn = () => {
    setIsActive(true);
    Animated.spring(touchScaleAnim, {
      toValue: 0.97,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const handlePressOut = () => {
    setIsActive(false);
    Animated.spring(touchScaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  // Continuous Center Focus Animation via scrollX interpolation
  let scaleTransform: any = touchScaleAnim;
  let translateYTransform: any = 0;
  let opacityTransform: any = 1;

  if (scrollX && index !== undefined && snapInterval && snapInterval > 0) {
    const inputRange = [
      (index - 1) * snapInterval,
      index * snapInterval,
      (index + 1) * snapInterval,
    ];

    scaleTransform = scrollX.interpolate({
      inputRange,
      outputRange: [0.90, 1.05, 0.90],
      extrapolate: 'clamp',
    });

    translateYTransform = scrollX.interpolate({
      inputRange,
      outputRange: [6, -10, 6],
      extrapolate: 'clamp',
    });

    opacityTransform = scrollX.interpolate({
      inputRange,
      outputRange: [0.80, 1, 0.80],
      extrapolate: 'clamp',
    });
  }

  if (type === 'action') {
    return (
      <Animated.View
        style={[
          styles.container,
          { width },
          {
            opacity: opacityTransform,
            transform: [
              { scale: scaleTransform },
              { translateY: translateYTransform },
            ],
          },
        ]}
      >
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[styles.card, styles.actionCard, isActive && styles.cardActive]}
        >
          <View style={styles.actionIconCircle}>
            <Text style={{ fontSize: 26 }}>➔</Text>
          </View>
          <Text style={styles.actionCardTitle}>{label}</Text>
          <Text style={styles.actionCardSub}>{sub}</Text>
          <View style={styles.actionBadge}>
            <Text style={styles.actionBadgeText}>{actionBadgeText}</Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { width },
        {
          opacity: opacityTransform,
          transform: [
            { scale: scaleTransform },
            { translateY: translateYTransform },
          ],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.card, isActive && styles.cardActive]}
      >
        {image ? (
          <Image source={image} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={styles.iconPlaceholder}>
            <Text style={{ fontSize: 48 }}>{icon}</Text>
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{label}</Text>
          <Text style={styles.cardSub} numberOfLines={2}>{sub}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: 'rgba(216, 194, 181, 0.45)',
    borderRadius: 24,
    padding: 12,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#8e4e14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
  cardActive: {
    borderColor: '#8e4e14',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  cardImage: {
    width: '100%',
    height: 145,
    borderRadius: 16,
    marginBottom: 10,
  },
  iconPlaceholder: {
    width: '100%',
    height: 145,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: '#f5f4e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    alignItems: 'center',
    width: '100%',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1b1c15',
    textAlign: 'center',
  },
  cardSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3f6653',
    marginTop: 3,
    textAlign: 'center',
    lineHeight: 16,
  },
  actionCard: {
    backgroundColor: '#f5f4e8',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(142, 78, 20, 0.45)',
    justifyContent: 'center',
    minHeight: 228,
  },
  actionIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#f4a261',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#8e4e14',
    textAlign: 'center',
  },
  actionCardSub: {
    fontSize: 12,
    color: '#534439',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 8,
    lineHeight: 16,
  },
  actionBadge: {
    marginTop: 14,
    backgroundColor: '#8e4e14',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  actionBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});
