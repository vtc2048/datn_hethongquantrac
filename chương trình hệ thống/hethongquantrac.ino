#include <lmic.h>
#include <hal/hal.h>
#include <SPI.h>
#include "DHT.h"  
#include <ML8511.h>
#include <Wire.h>
#include <MQ136.h>  
#include <TinyGPS++.h> 
#include <MQ7.h>
#include <PMS5003.h>  

#define CFG_VN 1
#define DHTPIN 14
#define DHTTYPE DHT22
#define ANALOGPIN 34  
#define NO2_PIN 35 
#define MQ136_PIN 25
#define MQ7_PIN 15
#define PMS_RX 4  
#define PMS_TX 5  
#define RXD2 16
#define TXD2 17
#define GPS_BAUD 9600

ML8511 light(ANALOGPIN);
MQ136 sensor(MQ136_PIN);  
MQ7 mq7(MQ7_PIN);
PMS5003 pms(PMS_RX, PMS_TX);  // Khởi tạo PMS5003
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

float latitude = 0.0;
float longitude = 0.0;

static const PROGMEM u1_t NWKSKEY[16] = { 0x6C, 0x53, 0x8B, 0x22, 0x63, 0xD8, 0x55, 0xB1, 0xFE, 0x86, 0x31, 0x67, 0x94, 0xA2, 0x2C, 0x30 };
static const u1_t PROGMEM APPSKEY[16] = { 0x73, 0xF7, 0xEF, 0xCF, 0xAE, 0xB2, 0x24, 0xFC, 0x0E, 0xAB, 0x74, 0x03, 0x8A, 0xAB, 0xCB, 0xAB };
static const u4_t DEVADDR = 0x00D67F6D;

void os_getArtEui (u1_t* buf) { }
void os_getDevEui (u1_t* buf) { }
void os_getDevKey (u1_t* buf) { }

static uint8_t mydata[27];
static osjob_t sendjob;

const unsigned TX_INTERVAL = 10;

const lmic_pinmap lmic_pins = {
    .nss = 13,
    .rxtx = LMIC_UNUSED_PIN,
    .rst = 27,
    .dio = {26, 33, 32},
};

DHT dht(DHTPIN, DHTTYPE);

void onEvent (ev_t ev) {
  Serial.print(os_getTime());
  Serial.print(": ");
  switch(ev) {
    case EV_TXCOMPLETE:
      Serial.println(F("EV_TXCOMPLETE (includes waiting for RX windows)"));
      if (LMIC.txrxFlags & TXRX_ACK)
        Serial.println(F("Received ack"));
      if (LMIC.dataLen) {
        Serial.println(F("Received "));
        Serial.println(LMIC.dataLen);
        Serial.println(F(" bytes of payload"));
      }
      os_setTimedCallback(&sendjob, os_getTime()+sec2osticks(TX_INTERVAL), do_send);
      break;
  }
}

void do_send(osjob_t* j) {
  if (LMIC.opmode & OP_TXRXPEND) {
    Serial.println(F("OP_TXRXPEND, not sending"));
  } else {
    float temperature = dht.readTemperature();
    Serial.print("Temperature: "); Serial.print(temperature); Serial.println(" *C");
    int16_t Temp_int = temperature * 10;
    
    float rHumidity = dht.readHumidity();
    Serial.print("%Humidity "); Serial.print(rHumidity); Serial.println("%RH");
    int16_t Humid_int = rHumidity * 10;

    uint16_t pm25 = 0;
    uint16_t pm10 = 0;
    uint16_t pm100 = 0;
    if (pms.readData()) {
      pm25 = pms.getPM25();
      pm10 = pms.getPM10();
      pm100 = pms.getPM100();
      Serial.print("PM2.5: "); Serial.print(pm25); Serial.println(" ug/m3");
      Serial.print("PM10: "); Serial.print(pm10); Serial.println(" ug/m3");
      Serial.print("pm100: "); Serial.print(pm100); Serial.println(" ug/m3");
    }

    float UV_intensity = light.getUV() / 100;  
    Serial.print("UV: "); Serial.print(UV_intensity); Serial.println(" mW/cm^2");
    int16_t UV_int = UV_intensity * 100; 

    int no2_raw = analogRead(NO2_PIN); 
    float no2_ppb = no2_raw * 0.1;
    uint16_t no2_int = no2_ppb;
    Serial.print("NO2: "); Serial.print(no2_ppb); Serial.println(" ug/m3");

    float so2_ppm = sensor.readPPM();  
    if (so2_ppm == -1.0) {
      Serial.println("Error: Invalid SO2 ppm");
      so2_ppm = 0;  
    }
    Serial.print("SO2: "); Serial.print(so2_ppm); Serial.println(" ug/m3");
    uint16_t so2_int = so2_ppm * 100;  

    float co_ppm = mq7.readPPM();
    if (co_ppm == -1.0) {
      Serial.println("Error: Invalid CO ppm");
      co_ppm = 0;
    }
    Serial.print("CO: "); Serial.print(co_ppm); Serial.println(" ug/m3");
    uint16_t co_int = co_ppm * 10;

    unsigned long start = millis();
    while (millis() - start < 1000) {
      while (gpsSerial.available() > 0) {
        gps.encode(gpsSerial.read());
      }
      if (gps.location.isUpdated()) {
        latitude = gps.location.lat();
        longitude = gps.location.lng();
        Serial.print("LAT: "); Serial.println(latitude, 6);
        Serial.print("LON: "); Serial.println(longitude, 6);
      }
    } 
    uint32_t lat_int = *(uint32_t*)&latitude;
    uint32_t lon_int = *(uint32_t*)&longitude;

    mydata[0] = (Temp_int >> 8) & 0xFF;  
    mydata[1] = Temp_int & 0xFF;         
    mydata[2] = (Humid_int >> 8) & 0xFF; 
    mydata[3] = Humid_int & 0xFF;        
    mydata[4] = 0x00;                    
    mydata[5] = (pm25 >> 8) & 0xFF;      
    mydata[6] = pm25 & 0xFF;             
    mydata[7] = (pm10 >> 8) & 0xFF;      
    mydata[8] = pm10 & 0xFF;             
    mydata[9] = (pm100 >> 8) & 0xFF;     
    mydata[10] = pm100 & 0xFF;           
    mydata[11] = (UV_int >> 8) & 0xFF;  
    mydata[12] = UV_int & 0xFF;  
    mydata[13] = (no2_int >> 8) & 0xFF;  
    mydata[14] = no2_int & 0xFF;         
    mydata[15] = (so2_int >> 8) & 0xFF;  
    mydata[16] = so2_int & 0xFF;         
    mydata[17] = (lon_int >> 24) & 0xFF;
    mydata[18] = (lon_int >> 16) & 0xFF;
    mydata[19] = (lon_int >> 8) & 0xFF;
    mydata[20] = lon_int & 0xFF;
    mydata[21] = (lat_int >> 24) & 0xFF;
    mydata[22] = (lat_int >> 16) & 0xFF;
    mydata[23] = (lat_int >> 8) & 0xFF;
    mydata[24] = lat_int & 0xFF;
    mydata[25] = (co_int >> 8) & 0xFF;
    mydata[26] = co_int & 0xFF;

    LMIC_setTxData2(1, mydata, sizeof(mydata), 0);
    Serial.println(F("Packet queued"));
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println(F("Starting"));
  
  dht.begin();
  pms.begin();  
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, RXD2, TXD2);
  Serial.println("GPS Serial started at 9600 baud rate");
  mq7.begin();
  mq7.calibrateR0();

  os_init();
  LMIC_reset();

  uint8_t appskey[sizeof(APPSKEY)];
  uint8_t nwkskey[sizeof(NWKSKEY)];
  memcpy_P(appskey, APPSKEY, sizeof(APPSKEY));
  memcpy_P(nwkskey, NWKSKEY, sizeof(NWKSKEY));
  LMIC_setSession(0x13, DEVADDR, nwkskey, appskey);

  LMIC_setupChannel(0, 921400000, DR_RANGE_MAP(DR_SF12, DR_SF7), BAND_CENTI);
  LMIC_setupChannel(1, 921600000, DR_RANGE_MAP(DR_SF12, DR_SF7B), BAND_CENTI);
  LMIC_setupChannel(2, 921800000, DR_RANGE_MAP(DR_SF12, DR_SF7), BAND_CENTI);
  LMIC_setupChannel(3, 922000000, DR_RANGE_MAP(DR_SF12, DR_SF7), BAND_CENTI);
  LMIC_setupChannel(4, 923200000, DR_RANGE_MAP(DR_SF12, DR_SF7), BAND_CENTI);
  LMIC_setupChannel(5, 922400000, DR_RANGE_MAP(DR_SF12, DR_SF7), BAND_CENTI);
  LMIC_setupChannel(6, 922600000, DR_RANGE_MAP(DR_SF12, DR_SF7), BAND_CENTI);
  LMIC_setupChannel(7, 922800000, DR_RANGE_MAP(DR_SF12, DR_SF7), BAND_CENTI);
  LMIC_setupChannel(8, 922700000, DR_RANGE_MAP(DR_FSK, DR_FSK), BAND_MILLI);

  LMIC_setLinkCheckMode(0);
  LMIC.dn2Dr = DR_SF9;
  LMIC_setDrTxpow(DR_SF7, 14);

  do_send(&sendjob);
}

void loop() {
  os_runloop_once();
}
