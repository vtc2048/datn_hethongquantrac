function decodeUplink(input) {
    var bytes = input.bytes;
    var decoded = {};

    if (bytes.length < 25) {  
        return {
            "errors": ["Độ dài payload không hợp lệ, cần 25 byte"]
        };
    } 

    var temperature = ((bytes[0] << 8) | bytes[1]) / 10.0;
    var humidity = ((bytes[2] << 8) | bytes[3]) / 10.0;
    var pm25 = (bytes[5] << 8) | bytes[6];
    var pm10 = (bytes[7] << 8) | bytes[8];
    var pm100 = (bytes[9] << 8) | bytes[10];
    var uv = ((bytes[11] << 8) | bytes[12]) / 100.0;
    var no2 = ((bytes[13] << 8) | bytes[14]) / 100.0;
    var so2 = ((bytes[15] << 8) | bytes[16]) / 100.0;  
    var longitude = new DataView(new Uint8Array([bytes[17], bytes[18], bytes[19], bytes[20]]).buffer).getFloat32(0);
    var latitude = new DataView(new Uint8Array([bytes[21], bytes[22], bytes[23], bytes[24]]).buffer).getFloat32(0);
    var co = ((bytes[25] << 8) | bytes[26]) / 100.0;  

    return {
        "data": {
            "temperature": temperature,
            "humidity": humidity,
            "pm25": pm25,
            "pm10": pm10,
            "pm100": pm100,	
            "uv": uv,
            "no2": no2,
            "so2": so2,
            "longitude": longitude,
            "latitude": latitude,
            "co": co
        }
    };
}
