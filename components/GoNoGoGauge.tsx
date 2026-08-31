import { useEffect } from 'react';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

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
  const CENTER_Y = size * 0.5;

  const clamped = Math.min(Math.max(riskRatio, 0), 1);
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    if (animated) {
      animatedValue.value = withTiming(clamped, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      animatedValue.value = clamped;
    }
  }, [clamped, animated]);

  const animatedProps = useAnimatedProps(() => {
    const filled = CIRCUMFERENCE * animatedValue.value;
    return {
      strokeDasharray: `${filled} ${CIRCUMFERENCE}`,
    };
  });

  const needleAnimatedProps = useAnimatedProps(() => {
    const angle = 180 - animatedValue.value * 180;
    return {
      transform: `rotate(${angle} ${CENTER_X} ${CENTER_Y})`,
    };
  });

  const percentage = Math.round(clamped * 100);

  return (
    <Svg width={size} height={size * 0.55} viewBox={`0 0 ${size} ${size * 0.55}`}>
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

      {/* Threshold markers */}
      {showLabels && (
        <>
          {/* 0.4 marker */}
          <Line
            x1={CENTER_X - RADIUS * Math.cos((0.4 * Math.PI))}
            y1={CENTER_Y - RADIUS * Math.sin((0.4 * Math.PI))}
            x2={CENTER_X - (RADIUS - STROKE - 5) * Math.cos((0.4 * Math.PI))}
            y2={CENTER_Y - (RADIUS - STROKE - 5) * Math.sin((0.4 * Math.PI))}
            stroke="#888"
            strokeWidth={2}
          />
          {/* 0.7 marker */}
          <Line
            x1={CENTER_X - RADIUS * Math.cos((0.7 * Math.PI))}
            y1={CENTER_Y - RADIUS * Math.sin((0.7 * Math.PI))}
            x2={CENTER_X - (RADIUS - STROKE - 5) * Math.cos((0.7 * Math.PI))}
            y2={CENTER_Y - (RADIUS - STROKE - 5) * Math.sin((0.7 * Math.PI))}
            stroke="#888"
            strokeWidth={2}
          />
        </>
      )}

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

      {/* Needle pointer */}
      <AnimatedG animatedProps={needleAnimatedProps}>
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
      </AnimatedG>

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
            x={CENTER_X - 25}
            y={CENTER_Y - RADIUS + STROKE + 25}
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

      {/* Percentage display */}
      {showPercentage && (
        <SvgText
          x={CENTER_X}
          y={CENTER_Y + 15}
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