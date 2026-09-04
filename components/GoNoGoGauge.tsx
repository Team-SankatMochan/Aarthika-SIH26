import { useEffect } from 'react';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface GoNoGoGaugeProps {
  riskRatio: number;
  size?: number;
  showLabels?: boolean;
  showPercentage?: boolean;
  animated?: boolean;
}

function zoneColor(riskRatio: number) {
  if (riskRatio < 0.4) return '#639922';
  if (riskRatio < 0.7) return '#EF9F27';
  return '#E24B4A';
}

export function GoNoGoGauge({
  riskRatio,
  size = 220,
  showLabels = true,
  showPercentage = true,
  animated = true,
}: GoNoGoGaugeProps) {
  const RADIUS = (size * 90) / 220;
  const STROKE = (size * 18) / 220;
  const CIRCUMFERENCE = Math.PI * RADIUS;
  const CENTER_X = size / 2;
  const CENTER_Y = size * 0.55;

  const clamped = Math.min(Math.max(riskRatio, 0), 1);
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    if (animated) {
      // Short settle so the arc tracks fast slider drags instead of
      // perpetually chasing them with a long restarting animation.
      animatedValue.value = withTiming(clamped, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      // While a slider is actively being dragged, jump to the exact
      // value so the arc stays glued to the thumb.
      animatedValue.value = clamped;
    }
  }, [clamped, animated]);

  const animatedProps = useAnimatedProps(() => {
    const filled = CIRCUMFERENCE * animatedValue.value;
    return {
      strokeDasharray: `${filled} ${CIRCUMFERENCE * 2}`,
    };
  });

  // Calculate static needle angle from the clamped ratio
  // Since Animated.createAnimatedComponent(G) is unreliable on Android,
  // use a static rotation that updates on re-render.
  const needleAngle = clamped * 180 - 90;

  const percentage = Math.round(clamped * 100);

  return (
    <Svg width={size} height={size * 0.75} viewBox={`0 0 ${size} ${size * 0.75}`}>
      {/* Background arc */}
      <Circle
        cx={CENTER_X}
        cy={CENTER_Y}
        r={RADIUS}
        stroke="#E5E3DA"
        strokeWidth={STROKE}
        fill="none"
        strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        rotation={180}
        origin={`${CENTER_X}, ${CENTER_Y}`}
      />

      {/* Threshold markers removed for cleaner look */}

      {/* Colored arc */}
      <AnimatedCircle
        cx={CENTER_X}
        cy={CENTER_Y}
        r={RADIUS}
        stroke={zoneColor(clamped)}
        strokeWidth={STROKE}
        fill="none"
        strokeLinecap="round"
        rotation={180}
        origin={`${CENTER_X}, ${CENTER_Y}`}
        animatedProps={animatedProps}
      />

      {/* Needle pointer — static G rotation (AnimatedG crashes on Android) */}
      <G rotation={needleAngle} origin={`${CENTER_X}, ${CENTER_Y}`}>
        <Line
          x1={CENTER_X}
          y1={CENTER_Y}
          x2={CENTER_X}
          y2={CENTER_Y - RADIUS + STROKE + 8}
          stroke="#333"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Circle cx={CENTER_X} cy={CENTER_Y} r={6} fill="#333" />
      </G>

      {/* Labels */}
      {showLabels && (
        <>
          <SvgText
            x={CENTER_X - RADIUS + 15}
            y={CENTER_Y + 25}
            fontSize={size * 0.055}
            fill="#639922"
            fontWeight="bold"
          >
            GO
          </SvgText>
          <SvgText
            x={CENTER_X}
            y={CENTER_Y - RADIUS - 15}
            fontSize={size * 0.055}
            fill="#EF9F27"
            fontWeight="bold"
            textAnchor="middle"
          >
            CAUTION
          </SvgText>
          <SvgText
            x={CENTER_X + RADIUS - 35}
            y={CENTER_Y + 25}
            fontSize={size * 0.055}
            fill="#E24B4A"
            fontWeight="bold"
          >
            NO-GO
          </SvgText>
        </>
      )}

      {/* Percentage display moved inside the arc */}
      {showPercentage && (
        <SvgText
          x={CENTER_X - 10}
          y={CENTER_Y - 25}
          fontSize={size * 0.1}
          fill={zoneColor(clamped)}
          fontWeight="bold"
          textAnchor="middle"
        >
          {percentage}%
        </SvgText>
      )}
    </Svg>
  );
}