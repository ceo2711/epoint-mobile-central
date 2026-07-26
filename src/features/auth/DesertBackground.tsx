import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, StyleSheet, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type DustMote = {
  id: number;
  x: number;
  y: number;
  radius: number;
  speed: number;
  opacity: number;
  phase: number;
};

const DUNE_LAYERS = [
  { base: 0.58, amp: 28, freq: 0.0045, color: "rgba(67, 47, 35, 0.55)", duration: 28000 },
  { base: 0.68, amp: 36, freq: 0.0058, color: "rgba(61, 40, 23, 0.72)", duration: 22000 },
  { base: 0.78, amp: 42, freq: 0.0072, color: "rgba(45, 27, 15, 0.88)", duration: 16000 },
  { base: 0.88, amp: 22, freq: 0.009, color: "#1a1008", duration: 12000 },
] as const;

function seededRandom(seed: number): number {
  const value = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function buildDunePath(
  width: number,
  height: number,
  baseY: number,
  amplitude: number,
  frequency: number,
  phase: number,
): string {
  const span = width * 2;
  let d = `M 0 ${height} L 0 ${baseY}`;
  for (let x = 0; x <= span; x += 10) {
    const y =
      baseY +
      Math.sin(x * frequency + phase) * amplitude +
      Math.sin(x * frequency * 0.45 + phase * 1.3) * amplitude * 0.35;
    d += ` L ${x} ${y}`;
  }
  d += ` L ${span} ${height} Z`;
  return d;
}

function createDust(width: number, height: number): DustMote[] {
  const groundTop = height * 0.3;
  const groundSpan = Math.max(height - groundTop, 1);
  return Array.from({ length: 56 }, (_, index) => {
    const roll = seededRandom(index + 1);
    const band = seededRandom(index + 21);
    const yFactor = index % 4 === 0 ? Math.pow(band, 0.75) : band;
    return {
      id: index,
      x: seededRandom(index + 11) * width,
      y: groundTop + yFactor * groundSpan,
      radius: 0.9 + roll * 2.2,
      speed: 0.22 + seededRandom(index + 31) * 0.45,
      opacity: 0.22 + roll * 0.42,
      phase: seededRandom(index + 51) * Math.PI * 2,
    };
  });
}

function DuneLayer({
  width,
  height,
  base,
  amp,
  freq,
  color,
  duration,
  reducedMotion,
}: {
  width: number;
  height: number;
  base: number;
  amp: number;
  freq: number;
  color: string;
  duration: number;
  reducedMotion: boolean;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 0;
      return;
    }
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [duration, progress, reducedMotion]);

  const animatedProps = useAnimatedProps(() => {
    "worklet";
    const phase = progress.value * Math.PI * 2;
    const baseY = height * base;
    const span = width * 2;
    let d = `M 0 ${height} L 0 ${baseY}`;
    for (let x = 0; x <= span; x += 12) {
      const y =
        baseY +
        Math.sin(x * freq + phase) * amp +
        Math.sin(x * freq * 0.45 + phase * 1.3) * amp * 0.35;
      d += ` L ${x} ${y}`;
    }
    d += ` L ${span} ${height} Z`;
    return { d };
  });

  if (reducedMotion) {
    return (
      <Path
        d={buildDunePath(width, height, height * base, amp, freq, 0)}
        fill={color}
      />
    );
  }

  return <AnimatedPath animatedProps={animatedProps} fill={color} />;
}

function DustLayer({
  width,
  height,
  reducedMotion,
}: {
  width: number;
  height: number;
  reducedMotion: boolean;
}) {
  const dust = useMemo(() => createDust(width, height), [width, height]);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withRepeat(
      withTiming(1, { duration: 12000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [progress, reducedMotion]);

  return (
    <>
      {dust.map((mote) => (
        <DustDot
          key={mote.id}
          mote={mote}
          width={width}
          height={height}
          progress={progress}
          reducedMotion={reducedMotion}
        />
      ))}
    </>
  );
}

function DustDot({
  mote,
  width,
  height,
  progress,
  reducedMotion,
}: {
  mote: DustMote;
  width: number;
  height: number;
  progress: SharedValue<number>;
  reducedMotion: boolean;
}) {
  const animatedProps = useAnimatedProps(() => {
    "worklet";
    if (reducedMotion) {
      return {
        cx: mote.x,
        cy: mote.y,
        opacity: mote.opacity,
      };
    }
    const t = progress.value * Math.PI * 2;
    const drift = Math.sin(t + mote.phase) * mote.speed * 18;
    let x = mote.x + drift + progress.value * width * 0.08 * mote.speed;
    while (x > width + 10) x -= width + 20;
    while (x < -10) x += width + 20;
    const y = mote.y + Math.sin(t * 1.2 + mote.phase) * 6;
    const pulse = 0.75 + Math.sin(t + mote.phase) * 0.25;
    return {
      cx: x,
      cy: y,
      opacity: mote.opacity * pulse,
    };
  });

  return (
    <AnimatedCircle
      animatedProps={animatedProps}
      r={mote.radius}
      fill="rgb(236, 233, 216)"
    />
  );
}

export function DesertBackground() {
  const { width, height } = useWindowDimensions();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReducedMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const w = Math.max(width, 1);
  const h = Math.max(height, 1);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={["#1a1008", "#2d1b0f", "#4b240f", "#6b3d1f", "#8a5a32"]}
        locations={[0, 0.35, 0.62, 0.82, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient
            id="sunGlow"
            cx={String(w * 0.72)}
            cy={String(h * 0.38)}
            rx={String(w * 0.42)}
            ry={String(w * 0.42)}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor="rgb(232, 196, 140)" stopOpacity="0.45" />
            <Stop offset="0.35" stopColor="rgb(196, 168, 130)" stopOpacity="0.22" />
            <Stop offset="0.7" stopColor="rgb(75, 36, 15)" stopOpacity="0.08" />
            <Stop offset="1" stopColor="rgb(26, 16, 8)" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient
            id="heatHaze"
            cx={String(w * 0.5)}
            cy={String(h * 0.72)}
            rx={String(w * 0.7)}
            ry={String(w * 0.55)}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor="rgb(240, 234, 218)" stopOpacity="0.08" />
            <Stop offset="1" stopColor="rgb(26, 16, 8)" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle
          cx={w * 0.72}
          cy={h * 0.38}
          r={w * 0.42}
          fill="url(#sunGlow)"
        />
        <Circle
          cx={w * 0.5}
          cy={h * 0.72}
          r={w * 0.7}
          fill="url(#heatHaze)"
        />

        {DUNE_LAYERS.map((layer) => (
          <DuneLayer
            key={layer.base}
            width={w}
            height={h}
            base={layer.base}
            amp={layer.amp}
            freq={layer.freq}
            color={layer.color}
            duration={layer.duration}
            reducedMotion={reducedMotion}
          />
        ))}

        <DustLayer width={w} height={h} reducedMotion={reducedMotion} />
      </Svg>
    </View>
  );
}
