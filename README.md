# ami-mqtt
Asterisk AMI to MQTT Gateway

Uses Asterisk AMI to read event stream from Asterisk instance and generate
status messages to forward to MQTT broker.

Events tracked:
* Incoming calls from trunks ring -> answer -> hangup
* Outgoing calls on trunks from extensions
* Extension activity for incoming, outgoing and extension to extension calls

Given the many ways Asterisk can be configured, extensions, trunks and external numbers
are determined by pattern matching numbers. The patterns are defined in config.json.

Asterisk context information is ignored.

Note that calls to pseudo phone extensions can be used to generate automation events.

Status information is determined heuristically. Your mileage will vary.

Requires a config file - config.json - See config.json.sample

Remember that comments will need to be removed and JSON is extremely picky
about formatting.

