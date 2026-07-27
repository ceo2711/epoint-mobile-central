import { useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RectButton, Swipeable } from "react-native-gesture-handler";

import { colors, radii } from "@/theme/tokens";

const ROW_GAP = 8;
const ACTION_WIDTH = 88;

type Props = {
  children: React.ReactNode;
  disabled?: boolean;
  onDelete: () => void;
  /** Si se pasa, el swipe muestra Editar (verde) + Eliminar. */
  onEdit?: () => void;
  deleteLabel?: string;
  editLabel?: string;
  deleteWidth?: number;
};

/**
 * Swipe izquierda → acciones.
 * Con onEdit: Editar (verde) + Eliminar (rojo).
 * Sin onEdit: solo Eliminar.
 * Al eliminar: fade + slide + colapso de altura.
 */
export function SwipeToDeleteRow({
  children,
  disabled = false,
  onDelete,
  onEdit,
  deleteLabel = "Eliminar",
  editLabel = "Editar",
  deleteWidth = ACTION_WIDTH,
}: Props) {
  const swipeRef = useRef<Swipeable>(null);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const height = useRef(new Animated.Value(0)).current;
  const marginBottom = useRef(new Animated.Value(ROW_GAP)).current;
  const measuredRef = useRef(0);
  const [lockedHeight, setLockedHeight] = useState(false);
  const [exiting, setExiting] = useState(false);

  const showEdit = typeof onEdit === "function";
  const actionsWidth = showEdit ? deleteWidth * 2 + 8 : deleteWidth;

  const runExit = () => {
    if (exiting || disabled) return;
    setExiting(true);

    const currentHeight = measuredRef.current || 64;
    height.setValue(currentHeight);
    setLockedHeight(true);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: false,
      }),
      Animated.timing(translateX, {
        toValue: -56,
        duration: 180,
        useNativeDriver: false,
      }),
      Animated.timing(height, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(marginBottom, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false,
      }),
    ]).start(({ finished }) => {
      if (finished) onDelete();
      else {
        setExiting(false);
        setLockedHeight(false);
        opacity.setValue(1);
        translateX.setValue(0);
        height.setValue(currentHeight);
        marginBottom.setValue(ROW_GAP);
      }
    });
  };

  const handleEdit = () => {
    if (disabled || exiting || !onEdit) return;
    swipeRef.current?.close();
    onEdit();
  };

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-actionsWidth, 0],
      outputRange: [1, 0.75],
      extrapolate: "clamp",
    });

    return (
      <View style={[styles.actions, { width: actionsWidth }]}>
        {showEdit ? (
          <RectButton
            enabled={!disabled && !exiting}
            accessibilityRole="button"
            accessibilityLabel={editLabel}
            onPress={handleEdit}
            style={[styles.actionBtn, styles.editBtn]}
          >
            <Animated.View style={[styles.actionInner, { transform: [{ scale }] }]}>
              <Ionicons name="pencil-outline" size={20} color={colors.white} />
              <Text style={styles.actionText}>{editLabel}</Text>
            </Animated.View>
          </RectButton>
        ) : null}
        <RectButton
          enabled={!disabled && !exiting}
          accessibilityRole="button"
          accessibilityLabel={deleteLabel}
          onPress={runExit}
          style={[styles.actionBtn, styles.deleteBtn]}
        >
          <Animated.View style={[styles.actionInner, { transform: [{ scale }] }]}>
            <Ionicons name="trash-outline" size={20} color={colors.white} />
            <Text style={styles.actionText}>{deleteLabel}</Text>
          </Animated.View>
        </RectButton>
      </View>
    );
  };

  return (
    <Animated.View
      pointerEvents={exiting ? "none" : "auto"}
      style={[
        styles.rowWrap,
        { opacity, marginBottom, transform: [{ translateX }] },
        lockedHeight ? { height, overflow: "hidden" } : null,
      ]}
      onLayout={(e) => {
        if (exiting || lockedHeight) return;
        const next = Math.ceil(e.nativeEvent.layout.height);
        if (next > 0) measuredRef.current = next;
      }}
    >
      <Swipeable
        ref={swipeRef}
        enabled={!disabled && !exiting}
        overshootRight={false}
        friction={2}
        rightThreshold={40}
        renderRightActions={renderRightActions}
      >
        {children}
      </Swipeable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rowWrap: {},
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  actionBtn: {
    flex: 1,
    marginLeft: 8,
    borderRadius: radii.control,
    overflow: "hidden",
  },
  editBtn: {
    backgroundColor: colors.brand,
  },
  deleteBtn: {
    backgroundColor: colors.danger,
  },
  actionInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 8,
  },
  actionText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "700",
  },
});
