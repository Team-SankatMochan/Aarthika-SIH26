import Svg, { Circle } from 'react-native-svg';

const RADIUS = 90;
const STROKE = 18;
const CIRCUMFERENCE = Math.PI * RADIUS;

function zoneColor(riskRatio: number) {
    if (riskRatio < 0.5) return '#639922';
    if (riskRatio < 0.8) return '#EF9F27';
    return '#E24B4A';
}

export function GoNoGoGauge({ riskRatio }: { riskRatio: number }) {
    const clamped = Math.min(Math.max(riskRatio, 0), 1);
    const filled = CIRCUMFERENCE * clamped;
    return (
        <Svg width={220} height={120} viewBox="0 0 220 120">
            <Circle cx={110} cy={110} r={RADIUS} stroke="#E5E3DA" strokeWidth={STROKE} fill="none"
                strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`} rotation={180} origin="110, 110" />
            <Circle cx={110} cy={110} r={RADIUS} stroke={zoneColor(clamped)} strokeWidth={STROKE} fill="none"
                strokeDasharray={`${filled} ${CIRCUMFERENCE}`} strokeLinecap="round" rotation={180} origin="110, 110" />
        </Svg>
    );
}