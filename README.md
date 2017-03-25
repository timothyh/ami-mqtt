# ami-mqtt
Asterisk AMI to MQTT Gateway


Requires a config file - config.json

Sample below - Remember JSON doesn't allow comments

```json
{

// Connection information for Asterisk AMI

"ami_conf": {
    "host": "astrisk.local",
    "port": 1234,
    "username": "asterisk",
    "secret": "mypassword"
},

// Connection information for MQTT Broker

"mqtt_conf": {
    "host": "localhost",
    "port": "1883",
    "username": "mqttuser",
    "keepalive": 60,
    "password": "mypassword",
// Topic used for Keepalive ping messages
    "ping_topic": "pbx/_ping",
// Topic used for messages relaed to extensions
    "ext_prefix": "pbx/extension",
// Topic used 
    "trunk_prefix": "pbx/trunk"
},

// Mapping of Incoming DID to friendly names

"trunks": {
    "6405": "House",
    "12125551212": "House",
    "12125551213": "Bert",
    "12125551214": "Ernie",
    "44171234567": "Cookie"
}
}
```
