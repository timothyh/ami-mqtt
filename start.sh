#!/bin/bash --

exec 2>&1 >> /tmp/calls.log < /dev/null

(
while true ; do
	nodejs ami-mqtt.js 
	[ $? ne 10 ] && break
	sleep 5
done
) &
