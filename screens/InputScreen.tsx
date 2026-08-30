import { useState } from 'react';
import { View, TextInput, Button } from 'react-native';
import { database } from '../model';

export default function InputScreen({ navigation }: any) {
    const [capital, setCapital] = useState('');
    const [location, setLocation] = useState('');
    const [businessType, setBusinessType] = useState('');

    async function handleSubmit() {
        let newProfile: any;
        await database.write(async () => {
            newProfile = await database.get('profiles').create((p: any) => {
                p.capital = parseFloat(capital);
                p.location = location;
                p.businessType = businessType;
            });
        });
        console.log('✅ Profile saved:', newProfile.id, 'Capital:', newProfile.capital);
        navigation.navigate('Dashboard', { profileId: newProfile.id });
    }

    return (
        <View style={{ padding: 20, gap: 12 }}>
            <TextInput placeholder="Margin Capital" keyboardType="numeric" value={capital} onChangeText={setCapital} />
            <TextInput placeholder="Location" value={location} onChangeText={setLocation} />
            <TextInput placeholder="Business Type" value={businessType} onChangeText={setBusinessType} />
            <Button title="Calculate" onPress={handleSubmit} />
        </View>
    );
}