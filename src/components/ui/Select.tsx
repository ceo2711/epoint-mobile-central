import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslation } from "@/contexts/LanguageContext";
import { colors, radii } from "@/theme/tokens";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface SelectProps {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  sheetTitle?: string;
  disabled?: boolean;
}

const SHEET_SLIDE = 48;

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder,
  sheetTitle,
  disabled,
}: SelectProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 18,
        stiffness: 220,
        mass: 0.8,
      }).start();
      return;
    }

    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [open, anim]);

  function close() {
    setOpen(false);
  }

  function choose(next: string) {
    close();
    if (next !== value) onChange(next);
  }

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          pressed && styles.fieldPressed,
          disabled && styles.fieldDisabled,
        ]}
      >
        <View style={styles.fieldInner}>
          <Text
            numberOfLines={1}
            style={[styles.fieldText, !selected && styles.fieldPlaceholder]}
          >
            {selected?.label ?? placeholder ?? ""}
          </Text>
          {selected?.hint ? (
            <Text numberOfLines={1} style={styles.fieldHint}>
              {selected.hint}
            </Text>
          ) : null}
        </View>
        <View style={styles.chevronWrap}>
          <Ionicons name="chevron-down" size={18} color={colors.brand} />
        </View>
      </Pressable>

      <Modal
        visible={mounted}
        transparent
        animationType="none"
        onRequestClose={close}
      >
        <View style={styles.root}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
              },
            ]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          </Animated.View>

          <Animated.View
            style={[
              styles.sheet,
              {
                paddingBottom: Math.max(insets.bottom, 20),
                opacity: anim,
                transform: [
                  {
                    translateY: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [SHEET_SLIDE, 0],
                    }),
                  },
                  {
                    scale: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.handle} />
            {sheetTitle || label ? (
              <Text style={styles.sheetTitle}>{sheetTitle ?? label}</Text>
            ) : null}

            <ScrollView
              bounces={false}
              style={styles.list}
              contentContainerStyle={styles.listContent}
            >
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => choose(option.value)}
                    style={({ pressed }) => [
                      styles.option,
                      active && styles.optionActive,
                      pressed && styles.optionPressed,
                    ]}
                  >
                    <View style={styles.optionTexts}>
                      <Text
                        style={[styles.optionLabel, active && styles.optionLabelActive]}
                      >
                        {option.label}
                      </Text>
                      {option.hint ? (
                        <Text style={styles.optionHint}>{option.hint}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable style={styles.cancel} onPress={close}>
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brown,
  },
  field: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  fieldPressed: {
    borderColor: colors.brandMuted,
    backgroundColor: colors.brandLight,
  },
  fieldDisabled: {
    opacity: 0.6,
  },
  fieldInner: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  fieldText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
  },
  fieldPlaceholder: {
    color: colors.brownMuted,
    fontWeight: "500",
  },
  fieldHint: {
    fontSize: 12,
    color: colors.soft,
  },
  chevronWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  sheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 18,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.line,
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
    marginBottom: 4,
  },
  list: {
    flexGrow: 0,
    maxHeight: 360,
  },
  listContent: {
    gap: 12,
    paddingVertical: 6,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 64,
  },
  optionActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
  },
  optionPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  optionTexts: {
    flex: 1,
    gap: 4,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
  },
  optionLabelActive: {
    color: colors.brand,
  },
  optionHint: {
    fontSize: 13,
    color: colors.soft,
    lineHeight: 18,
  },
  cancel: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 2,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.soft,
  },
});
