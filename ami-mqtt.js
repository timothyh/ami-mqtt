'use strict'
//
//
// Uses Asterisk AMI to route caller-id information to a MQTT broker
// 
// Also handles extenstion to extension calls
// 
// Does not handle outgoing calls
// 
// Significant Events:
// 	56   event: 'DialBegin',
// 	56   event: 'DialEnd',
// 	77   event: 'Hangup',
// 	75   event: 'NewConnectedLine',
// 	67   event: 'Newstate',
// 
// Significant States:
// 	channelstatedesc: 'Down',
// 	channelstatedesc: 'Ring',
// 	channelstatedesc: 'Ringing',
// 	channelstatedesc: 'Up',
// 
// Sample event message:
// 	event: 'NewConnectedLine',
// 	channelstatedesc: 'Ring',
// 	channel:
// 	exten: '12125551212',
// 	destexten: '323',
// 	calleridnum: '15105551212',
// 	calleridname: 'ROAD RUNNER',
// 	connectedlinenum: '12125551212',
// 	connectedlinename: '',
// 	destcalleridnum: '323',
// 	destcalleridname: 'Wile Coyote',
// 
//

String.prototype.inList = function ( list ) {
    return ( list.indexOf( this.toString() ) != -1 )
}

require('log-timestamp')(function() { return new Date().toString() + ": %s" });

var namiLib = require( "nami" )
var mqtt = require( "mqtt" )

var config = require('./config.json');

var ami_conf = config.ami_conf

var mqtt_conf = config.mqtt_conf

/* Incoming lines => event.exten */

var trunks = config.trunks

var callers = { }

var ami_activity = Date.now()
var mqtt_activity = Date.now()

var client = mqtt.connect( {
    host: mqtt_conf.host,
    port: mqtt_conf.port,
    username: mqtt_conf.username,
    password: mqtt_conf.password,
    keepalive: mqtt_conf.keepalive
} )

client.on( 'connect', function () {
    console.log( "Connected to MQTT Broker" )
    client.subscribe( mqtt_conf.ping_topic )
} )

var nami = new( namiLib.Nami )( ami_conf )

nami.logLevel = 1

nami.on('namiConnectionClose', function (data) {
    console.warn('Reconnecting to AMI...');
    setTimeout(function () { nami.open(); }, 5000);
});

nami.on('namiInvalidPeer', function (data) {
        console.error("Invalid AMI Salute. Not an AMI?");
        process.exit(1);
});
nami.on('namiLoginIncorrect', function () {
        console.error("Invalid AMI Credentials");
        process.exit(1);
});
nami.on( 'namiEvent', function ( event ) {
    ami_activity = Date.now()

    if ( !event.event.inList( [ 'NewConnectedLine', 'DialBegin', 'DialEnd', 'Hangup' ] ) ) {
        return
    }
    if ( !event.channelstatedesc.inList( [ 'Down', 'Rsrvd', 'Ring', 'Ringing', 'Up' ] ) ) {
        return
    }

    // var tmp = []
    // tmp[ 0 ] = event.event
    // tmp[ 1 ] = event.channelstatedesc
    // tmp[ 2 ] = event.channel.replace( /^[^\/]+\//, '' ).replace( /-[^-]+$/, '' )
    // tmp[ 3 ] = event.exten
    // tmp[ 4 ] = event.destexten
    // tmp[ 5 ] = event.calleridnum
    // tmp[ 6 ] = event.calleridname
    // tmp[ 7 ] = event.connectedlinenum
    // tmp[ 8 ] = event.connectedlinename
    // tmp[ 9 ] = event.destcalleridnum
    // tmp[ 10 ] = event.destcalleridname

    delete event.lines
    delete event.EOL
    console.log( util.inspect(event) )

    // New incoming call
    if ( event.event === 'NewConnectedLine' &&
        event.channelstatedesc === 'Ring' &&
        trunks[ event.exten ] ) {
	callers[event.calleridnum] = event.calleridname.replace( /[_\s]+/g, ' ' )
        var trunk = trunks[ event.exten ].toLowerCase()
        var tmp = {
            trunk: trunks[ event.exten ],
            to_num: event.exten,
            from_num: event.calleridnum === 'Unavailable' ? '' : event.calleridnum,
            from_name: event.calleridname.replace( /[_\s]+/g, ' ' ),
            state: event.channelstatedesc,
            timestamp: Date(),
        }
        // console.log(mqtt_conf.trunk_prefix + '/' + trunk + ": " + JSON.stringify(tmp))
        client.publish( mqtt_conf.trunk_prefix + '/' + trunk, JSON.stringify( tmp ) )
    // Ring internal extensions
    } else if ( event.event === 'DialBegin' &&
        event.channelstatedesc === 'Ring' &&
        event.destcalleridname ) {
        var ext = event.destcalleridnum
        var tmp = {
            to_num: event.destcalleridnum,
            from_num: event.calleridnum === 'Unavailable' ? '' : event.calleridnum,
            from_name: callers[event.calleridnum] ? callers[event.calleridnum] : event.calleridname.replace( /[_\s]+/g, ' ' ),
            state: event.channelstatedesc,
            timestamp: Date(),
        }
        // console.log(mqtt_conf.ext_prefix + '/' + ext + ": " + JSON.stringify(tmp))
        client.publish( mqtt_conf.ext_prefix + '/' + ext, JSON.stringify( tmp ) )
    }
} )

process.on( 'SIGTERM', function () {
    nami.close( function () {
        console.warn( "Exiting on SIGTERM" )
    } )
    process.exit( 1 )
} )
process.on( 'SIGINT', function () {
    nami.close( function () {
        console.warn( "Exiting on SIGINT" )
    } )
    process.exit( 1 )
} )

// MQTT Activity

client.on( 'message', function ( topic, message ) {
    mqtt_activity = Date.now()
} )

// AMI Keepalive

setInterval( function () {
    nami.send( new namiLib.Actions.Ping(), function ( response ) {
        if ( response.ping !== 'Pong' ) {
            return
        }
        ami_activity = Date.now()
    } )
}, 60000 )

// MQTT Keepalive
setInterval( function () {
    client.publish( mqtt_conf.ping_topic, JSON.stringify( {
        timestamp: Date()
    } ) )
}, 60000 )

setInterval( function () {
    var ami_last = ( Date.now() - ami_activity ) / 1000.0
    if ( ami_last >= 90 ) {
        console.warn( "Exit due to AMI inactivity" )
        process.exit( 10 )
    }
    var mqtt_last = ( Date.now() - mqtt_activity ) / 1000.0
    if ( mqtt_last >= 90 ) {
        console.warn( "Exit due to MQTT inactivity" )
        process.exit( 10 )
    }
}, 10000 )

console.log( "Starting" )

nami.open()
