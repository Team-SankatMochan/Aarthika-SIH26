import re

with open('src/app/index.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix SignUpScreen defaults
code = re.sub(r"const \[fullName, setFullName\] = useState\('.*?'\);", r"const [fullName, setFullName] = useState('');", code)
code = re.sub(r"const \[mobile, setMobile\] = useState\('.*?'\);", r"const [mobile, setMobile] = useState('');", code)
code = re.sub(r"const \[age, setAge\] = useState\('.*?'\);", r"const [age, setAge] = useState('');", code)
code = re.sub(r"const \[state, setState\] = useState\('.*?'\);", r"const [state, setState] = useState('');", code)
code = re.sub(r"const \[district, setDistrict\] = useState\('.*?'\);", r"const [district, setDistrict] = useState('');", code)
code = re.sub(r"const \[village, setVillage\] = useState\('.*?'\);", r"const [village, setVillage] = useState('');", code)
code = re.sub(r"const \[occupation, setOccupation\] = useState\('.*?'\);", r"const [occupation, setOccupation] = useState('');", code)
code = re.sub(r"const \[interestedSector, setInterestedSector\] = useState\('.*?'\);", r"const [interestedSector, setInterestedSector] = useState('');", code)
code = re.sub(r"const \[password, setPassword\] = useState\('.*?'\);", r"const [password, setPassword] = useState('');", code)

# Fix App state defaults
code = re.sub(r"state: 'Chhattisgarh'", r"state: ''", code)
code = re.sub(r"district: 'Raigarh'", r"district: ''", code)
code = re.sub(r"village: 'Dharamjaigarh'", r"village: ''", code)
code = re.sub(r"occupation: 'Farmer'", r"occupation: ''", code)
code = re.sub(r"interestedSector: 'Farming'", r"interestedSector: ''", code)
code = re.sub(r"hasExistingBusiness: 'No'", r"hasExistingBusiness: ''", code)

# Fix activeBusiness defaults
code = code.replace("sector: 'farming',", "sector: '',")
code = code.replace("title: 'Organic Vegetable Farming',", "title: '',")
code = code.replace("setupCost: 95000,", "setupCost: 0,")
code = code.replace("monthlyFixed: 4000,", "monthlyFixed: 0,")
code = code.replace("unitType: 'Kg',", "unitType: '',")
code = code.replace("pricePerUnit: 40,", "pricePerUnit: 0,")
code = code.replace("costPerUnit: 18,", "costPerUnit: 0,")
code = code.replace("salesPerMonth: 1800,", "salesPerMonth: 0,")
code = code.replace("personalCost: 8000,", "personalCost: 0,")

# Remove demo login button
demo_btn_pattern = r"<TouchableOpacity[\s\S]*?onPress=\{\(\) => handleLogin\('9876543210', 'demo'\)\}[\s\S]*?</TouchableOpacity>"
code = re.sub(demo_btn_pattern, "", code)

# Remove automatic dummy user creation
code = code.replace("const nameParts = fullName.trim().split(' ');", "const nameParts = fullName.trim().split(' ');")
# Update handleLogin to not use dummy values
code = re.sub(r"mobile: mobile \|\| prev\.mobile \|\| '9876543210',", r"mobile: mobile || prev.mobile || '',", code)
code = re.sub(r"fullName: prev\.fullName \|\| 'Ramesh Kumar',", r"fullName: prev.fullName || '',", code)
code = re.sub(r"firstName: prev\.firstName \|\| 'Ramesh',", r"firstName: prev.firstName || '',", code)


with open('src/app/index.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

