import { ReactNode, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleProp, ViewStyle } from 'react-native';

/**
 * Small, shared motion (DECISIONS L1). Everything is skipped when the device asks for reduced
 * motion. Not the native driver: the web has none, and these run on few elements for a moment.
 */

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((on) => {
    reduceMotion = on;
  })
  .catch(() => undefined);

export function animate(value: Animated.Value, toValue: number, duration = 180): Animated.CompositeAnimation {
  return Animated.timing(value, {
    toValue,
    duration: reduceMotion ? 0 : duration,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: false,
  });
}

/** A scale that pops briefly each time `trigger` changes to a truthy value (a tick, a count). */
export function useBump(trigger: number | boolean): Animated.Value {
  const [scale] = useState(() => new Animated.Value(1));
  const previous = useRef(trigger);
  useEffect(() => {
    if (previous.current === trigger) return;
    previous.current = trigger;
    if (!trigger || reduceMotion) return;
    Animated.sequence([animate(scale, 1.18, 90), animate(scale, 1, 140)]).start();
  }, [trigger, scale]);
  return scale;
}

/** Fades content in and lifts it slightly when it first appears; give it a `key` to replay. */
export function RiseIn({ children, distance = 8, style }: { children: ReactNode; distance?: number; style?: StyleProp<ViewStyle> }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    animate(progress, 1, 200).start();
  }, [progress]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
