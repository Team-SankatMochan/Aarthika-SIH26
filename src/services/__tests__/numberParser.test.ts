import { parseSpokenNumber } from '../numberParser';

describe('numberParser', () => {
  it('parses Hindi voice numbers correctly', () => {
    expect(parseSpokenNumber('एक लाख').value).toBe(100000);
    expect(parseSpokenNumber('डेढ़ लाख').value).toBe(150000);
    expect(parseSpokenNumber('पचास हजार').value).toBe(50000);
    expect(parseSpokenNumber('आठ हजार पांच सौ').value).toBe(8500);
    expect(parseSpokenNumber('चार सौ').value).toBe(400);
    expect(parseSpokenNumber('साढ़े चार हजार').value).toBe(4500);
  });

  it('parses Hinglish/English voice numbers correctly', () => {
    expect(parseSpokenNumber('around 8 hazaar').value).toBe(8000);
    expect(parseSpokenNumber('monthly 10 thousand').value).toBe(10000);
    expect(parseSpokenNumber('600 litre').value).toBe(600);
    expect(parseSpokenNumber('पचपन रुपये').value).toBe(55);
  });

  it('returns unsuccess for TEXT fields / uncertain speech', () => {
    expect(parseSpokenNumber('मैं रामपुर गाँव से हूँ').success).toBe(false);
    expect(parseSpokenNumber('मैं डेयरी शुरू करना चाहता हूँ').success).toBe(false);
    expect(parseSpokenNumber('मुझे नहीं पता').success).toBe(false);
  });
});
