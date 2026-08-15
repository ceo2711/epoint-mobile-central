import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Polyline } from "react-native-svg";

import { colors, radii } from "@/theme/tokens";

export const STATUS_CHART_COLORS: Record<string, string> = {
  PENDIENTE_CONTACTAR: "#c4a35a",
  LEAD_CONTACTADO: "#5a8f63",
  LEAD_CERRADO: "#b54a3a",
  CONTRATO_ENVIADO: "#8b6f5c",
  PAGO_COMPLETADO: "#3d6b45",
  PENDIENTE_DE_REVISION: "#c4a35a",
  RECHAZADO: "#b54a3a",
  APROBADO_PARA_ONBOARDING: "#5a8f63",
  EN_CARGA_DATOS: "#8b6f5c",
  DOCUMENTOS_EN_REVISION: "#7aad82",
  LISTO_PARA_TRABAJAR: "#3d6b45",
  ONBOARDING_EN_PROGRESO: "#5a8f63",
  ONBOARDING_COMPLETADO: "#3d6b45",
  INACTIVO: "#a08070",
};

export type ChartSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

export function formatPercent(rate: number | null | undefined): string {
  if (rate == null || Number.isNaN(rate)) return "—";
  const rounded = Math.round(rate * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

export function DonutChart({
  slices,
  centerValue,
  centerLabel,
  size = 156,
}: {
  slices: ChartSlice[];
  centerValue: string | number;
  centerLabel: string;
  size?: number;
}) {
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  const visible = slices.filter((slice) => slice.value > 0);

  let offset = 0;
  const arcs = visible.map((slice) => {
    const length = total > 0 ? (slice.value / total) * circumference : 0;
    const item = { ...slice, length, dashOffset: -offset };
    offset += length;
    return item;
  });

  return (
    <View style={styles.donutWrap}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.line}
          strokeWidth={stroke}
        />
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          {arcs.map((arc) => (
            <Circle
              key={arc.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={stroke}
              strokeDasharray={`${arc.length} ${circumference - arc.length}`}
              strokeDashoffset={arc.dashOffset}
              strokeLinecap="butt"
            />
          ))}
        </G>
      </Svg>
      <View pointerEvents="none" style={styles.donutCenter}>
        <Text style={styles.donutValue}>{centerValue}</Text>
        <Text style={styles.donutLabel}>{centerLabel}</Text>
      </View>
    </View>
  );
}

export function StackedBar({ slices }: { slices: ChartSlice[] }) {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  if (total <= 0) {
    return <View style={[styles.stacked, styles.stackedEmpty]} />;
  }

  return (
    <View style={styles.stacked}>
      {slices
        .filter((slice) => slice.value > 0)
        .map((slice) => (
          <View
            key={slice.key}
            style={{
              flex: slice.value,
              backgroundColor: slice.color,
              minWidth: 4,
            }}
          />
        ))}
    </View>
  );
}

export function BarList({ slices }: { slices: ChartSlice[] }) {
  const max = Math.max(...slices.map((slice) => slice.value), 1);

  return (
    <View style={styles.barList}>
      {slices.map((slice) => (
        <View key={slice.key} style={styles.barRow}>
          <View style={styles.barMeta}>
            <View style={[styles.dot, { backgroundColor: slice.color }]} />
            <Text style={styles.barLabel} numberOfLines={1}>
              {slice.label}
            </Text>
            <Text style={styles.barValue}>{slice.value}</Text>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${Math.max(4, (slice.value / max) * 100)}%`,
                  backgroundColor: slice.color,
                  opacity: slice.value === 0 ? 0.25 : 1,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

export function Sparkline({
  points,
  color = colors.brand,
  height = 72,
}: {
  points: number[];
  color?: string;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  const path = useMemo(() => {
    if (width <= 0 || points.length < 2) return "";
    const max = Math.max(...points, 1);
    const padY = 6;
    return points
      .map((point, index) => {
        const x = (index / (points.length - 1)) * width;
        const y = height - padY - (point / max) * (height - padY * 2);
        return `${x},${y}`;
      })
      .join(" ");
  }, [height, points, width]);

  return (
    <View style={{ height }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {path ? (
            <Polyline
              points={path}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  donutWrap: {
    width: 156,
    height: 156,
    alignItems: "center",
    justifyContent: "center",
  },
  donutCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  donutValue: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.brown,
  },
  donutLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.soft,
    textAlign: "center",
  },
  stacked: {
    height: 12,
    borderRadius: radii.pill,
    overflow: "hidden",
    flexDirection: "row",
    backgroundColor: colors.line,
  },
  stackedEmpty: {
    opacity: 0.5,
  },
  barList: {
    gap: 10,
  },
  barRow: {
    gap: 6,
  },
  barMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  barLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
  },
  barValue: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.brown,
  },
  barTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.line,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: radii.pill,
  },
});
