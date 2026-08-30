import { useState } from 'react';
import { View, Text } from 'react-native';
import Slider from '@react-native-community/slider';
import { useLocalSearchParams } from 'expo-router';
import { withObservables } from '@nozbe/watermelondb/react';
import { database } from '../../model';
import { calculateEMI } from '../../engine/financials';
import { GoNoGoGauge } from '../../components/GoNoGoGauge';

function DashboardScreen({ profile }: any) {
    const [disasterImpact, setDisasterImpact] = useState(0);
    const projectedLoan = profile.capital / 0.10;
    const emi = calculateEMI(projectedLoan * (1 + disasterImpact), 12, 24);
    const riskRatio = Math.min(emi / 15000, 1);

    return (
        <View style={{ padding: 20 }}>
            <Text>Disaster impact: {(disasterImpact * 100).toFixed(0)}%</Text>
            <Slider value={disasterImpact} onValueChange={setDisasterImpact} minimumValue={0} maximumValue={1} />
            <Text>Projected EMI: ₹{emi.toFixed(0)}</Text>
            <GoNoGoGauge riskRatio={riskRatio} />
        </View>
    );
}

const Enhanced = withObservables(['profileId'], ({ profileId }: any) => ({
    profile: database.get('profiles').findAndObserve(profileId),
}))(DashboardScreen);

export default function DashboardRoute() {
    const { profileId } = useLocalSearchParams<{ profileId: string }>();
    return <Enhanced profileId={profileId} />;
}