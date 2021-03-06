/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var config = require('./config');
var http = require('http');
var path = require('path');
var Instagram = require('instagram-node-lib');
var io = require('socket.io');
var _ = require('underscore');
var EventEmitter = require('events').EventEmitter;

var ev = new EventEmitter();


// ---
// Setup Instagram

Instagram.set( 'client_id', config.instagram.id );
Instagram.set( 'client_secret', config.instagram.secret );
Instagram.set( 'callback_url', config.instagram.callbackUrl );


// ---
// Setup Express

var app = express();

app.configure(function() {
	app.set('port', process.env.PORT || 3000);
	app.set('views', __dirname + '/views');
	app.set('view engine', 'hjs');
	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.cookieParser());
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(app.router);
	app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
	app.use(express.errorHandler());
});


// ---
// Request Handlers

app.get('/newphoto', routes.newphoto.get);
app.post('/newphoto', function( req, res ) {
	setTimeout(function() {
		Instagram.tags.recent({
			name     : config.hashtag,
			complete : function( r ) {
				ev.emit( 'newphoto', parseInstragram( r ) );
			}
		});
	}, 3000);

	res.end();
});

app.get('/', routes.index);


// ---
// Launch server

var server = http.createServer(app).listen(app.get('port'), function(){
	console.log("Express server listening on port " + app.get('port'));
});


// ---
// Sockets

var ioServer = io.listen( server );

ioServer.sockets.on('connection', function( socket ) {
	ev.on('newphoto', function( photos ) {
		socket.emit( 'newphoto', photos );
	});
});

ioServer.configure(function() {
	ioServer.set("transports", ["xhr-polling"]);
	ioServer.set("polling duration", 10);
	ioServer.set('log level', 1);
});


// ---
// Subscribe to instagram

Instagram.media.unsubscribe({ object: 'tag' });
process.on('exit', function() {
	Instagram.media.unsubscribe({ object: 'tag' });
});
Instagram.subscriptions.subscribe({ object: 'tag', object_id: config.hashtag });


// ---
// Helper functions

function parseInstragram( data ) {
	return _.map( data, function( imgData ) {
		return {
			id          : imgData.id,
			img         : imgData.images.standard_resolution,
			author      : imgData.user.full_name
		};
	});
}
