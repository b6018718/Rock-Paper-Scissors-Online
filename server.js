var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var sql = require("mssql");

app.use(express.static('./'));

var playersWaiting = 0;
var roomsActive = 0;
var waitingList = [];
var gameList = [];
var users = [];

app.get('/', function(req, res){
	var file = './Rock Paper Scissors.html';
	res.set('Content-Type', 'text/html');
	console.log(req.headers.host);
	res.sendFile(file, {root: __dirname});
});

// On Connection
io.on('connection', function(socket) {
	// Connection
	let msg = "Hello";
	socket.emit('goToLobby', msg);

	function findIndex(list, roomNo){
		return list.room === roomNo;
	}

	// Name button
	socket.on('nameSelected', function(name) {
		if (!(users.includes(name))) {
			console.log(name + ' has connected');
			socket.username = name;
			socket.room = null;
			users.push(socket.username);

			if(playersWaiting > 0){
				//Join Room
				--playersWaiting;
				/*console.log(JSON.stringify(waitingList));*/
				let roomNo = waitingList[0].room;
				socket.join(roomNo);
				index = gameList.findIndex(x => x.room === roomNo);
				gameList[index].playerTwo = name;
				socket.room = roomNo;

				var players = {}
				players.playerOne = gameList[index].playerOne;
				players.playerTwo = name;
				io.to(roomNo).emit('gameFound', players);
				waitingList.shift();
				io.to(roomNo).emit('chatMessage', gameList[index].playerOne + ' has connected');
				io.to(roomNo).emit('chatMessage', gameList[index].playerTwo + ' has connected');
			}
			else {
				var gameObject = {};
				gameObject.room = roomsActive;
				gameObject.playerOne = name;
				gameObject.playerTwo = null;
				gameObject.attackSelected = false;
				gameObject.playerOneAttack = null;
				gameObject.playerTwoAttack = null;
				/*gameObject.countdown = 5;*/
				waitingList.push(gameObject);
				gameList.push(gameObject);
				socket.join(roomsActive);
				socket.room = gameObject.room;
				++roomsActive;
				++playersWaiting;
				socket.emit('displayLobby');
			}

			/*console.log("Waiting list is " + JSON.stringify(waitingList));*/
			/*console.log("Game List is... " + JSON.stringify(gameList));*/
		} else {
			let msg = ""
			socket.emit('nameAlreadyInUse', msg);
		}
	});

	socket.on('attackSelected', function(hand){
		let roomNo = socket.room;
		index = gameList.findIndex(x => x.room === roomNo);
		if (gameList[index].attackSelected == false){
			gameList[index].attackSelected = true;
			if(socket.username == gameList[index].playerOne)
				gameList[index].playerOneAttack = hand;
			else
				gameList[index].playerTwoAttack = hand;
		}
		else {
			if(socket.username == gameList[index].playerOne && gameList[index].playerOneAttack == null) {
				//Player One
				socket.emit('attacked', gameList[index].playerTwoAttack);
				socket.broadcast.to(gameList[index].room).emit('attacked', hand);
			} else if (socket.username == gameList[index].playerTwo && gameList[index].playerTwoAttack == null) {
				//Player Two
				socket.emit('attacked', gameList[index].playerOneAttack);
				socket.broadcast.to(gameList[index].room).emit('attacked', hand);
			}
			gameList[index].attackSelected = false;
			gameList[index].playerOneAttack = null;
			gameList[index].playerTwoAttack = null;
		}
	});

	socket.on('chatMessage', function(msg){
		msg = "<" + socket.username + "> " + msg;
		io.to(socket.room).emit('chatMessage', msg);
	});

	socket.on('disconnect', function(){
		disconnectFromGameFunc();
		console.log(socket.username + ' has disconnected');
	});

	socket.on('disconnectFromGame', function() {
		disconnectFromGameFunc();
		let msg = 'Hi';
		socket.emit('goToLobby', msg);
	});

	function disconnectFromGameFunc(){
		if (socket.room != null) {
			// Disconnect Message
			let msg = socket.username + ' has disconnected';
			io.to(socket.room).emit('chatMessage', msg);
			io.to(socket.room).emit('findNewGameButton', msg);

			let roomNo = socket.room;
			index = gameList.findIndex(x => x.room === roomNo);
			if (gameList[index]) {
				if(gameList[index].playerOne != null && gameList[index].playerTwo == null){

					// Javascript label, ugh
					outerloop:
					for (var i = waitingList.length - 1; i >= 0; i--) {
						if(waitingList[i].playerOne == socket.username){
							playersWaiting--;
							waitingList.splice(waitingList[i], 1);
							let userIndexToRemove = users.indexOf(socket.username);
							users.splice(userIndexToRemove, 1);
							break outerloop;
						}
					}
				}

				if(gameList[index].playerOne == socket.username) {
					gameList[index].playerOne = null;
					socket.leave(roomNo);
					let userIndexToRemove = users.indexOf(socket.username);
					users.splice(userIndexToRemove, 1);
				}
				else if (gameList[index].playerTwo == socket.username){
					gameList[index].playerTwo = null;
					socket.leave(roomNo);
					let userIndexToRemove = users.indexOf(socket.username);
					users.splice(userIndexToRemove, 1);
				}

				if(gameList[index].playerOne == null && gameList[index].playerTwo == null) {
					/*console.log("Removing... " + gameList[index]);*/
					gameList.splice(index, 1);
					socket.leave(roomNo);
				}
			}
			/*console.log(JSON.stringify(gameList));*/
		}
	}
});

// Set the port (5002) for the server to broadcast on
http.listen(5002, function(){
  console.log('Server is running..');
});
