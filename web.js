// data: [ARRAY[HP,PEPPERPOINTS,SEASONINGMOD,EXP, LEVEL],ARRAY[ITEMS],ARRAY[CLASSNAME, numOfReRolls]]
var typesOfMonsters = ["globin", "poring", "Ghostly Josh", "Headless Jimmy", "Spooky Jennie", "Playboy Rob", "Mad Patrick"];
var foodDrops = ["an Apple", "a Potato", "Jimmy's sandwich", "Josh's bacon", "Jennie's fruit punch", "Rob's pills", "Patrick's JapaDog"];
var classTypes = ["Cleric", "Mage", "Princess", "Warrior"];
var levelDice =["1d20", "1d20", "1d30", "1d30", "1d40","1d40","1d50","1d50","1d60"];
var monsterLevelDice = [20,30,40,50,60];
var ack = require('ac-koa').require('hipchat');
var pkg = require('./package.json');
var Serializer = require("backpack-node").system.Serializer;
var ser = new Serializer();
var fs = require('fs');
var app = ack(pkg);
var monsterTimer;
var alreadyattacking = false;
var underattack = "";
var alreadyrolling = "";
var hp = 0;
var dict = new JSdict();
var attackdmg = 0;
var chanceOfFaith = false;
var amountofExp = false;
var monsterType = "";
var monsterfoodDrop = "";
var playerDiceType;
var diceToRoll = 0;
var levelofMob = 1;
var prayer_process = false;
var inventory_process = false;
var stats_process = false;

var addon = app.addon()
	.hipchat()
	.allowRoom(true)
	.scopes('send_notification');

if (process.env.DEV_KEY) {
	addon.key(process.env.DEV_KEY);
}
String.prototype.startsWith = function(prefix) {
    return this.indexOf(prefix) === 0;
}
addon.webhook('room_message', /^\/class\s*([a-z]+)?/i, function  * () {
	console.log(this.match[1]);
	if (this.match[1] == "plsgivemesomethinggood"){
		mainArray = dict.getVal(this.sender.name);
		pclass = mainArray[2];
		
		if (pclass[0] != "") return printMessage(this.sender.name +"'s class has been chosen already. You cannot change destiny.", "red", this.roomClient);
		chosenClass = classTypes[Math.floor(Math.random() * classTypes.length)];
		printMessage(this.sender.name + "'s rolls the destiny dice and is chosen as a......<b>" + chosenClass + "</b>!!!!", "green", this.roomClient);
		
		pclass[0] = chosenClass;
		mainArray[2] = pclass;
		dict.update(this.sender.name, mainArray);
		return;
		
	}else{
		printMessage("Available classes: Cleric, Mage, Warrior, Princess. Choose with /class plsgivemesomethinggood", "yellow", this.roomClient);
	}
			
});
addon.webhook('room_message', /^[^\/].*/i, function  * () {
	if (alreadyattacking) {
		return;
	}
	var doweatk = (Math.floor(Math.random() * 20) + 1)
	if (parseInt(doweatk) == 4) {
		
		initPlayer(this.sender.name);
		alreadyattacking = true;
		underattack = this.sender.name;
		// lets get player level
		var playerLevel = dict.getVal(this.sender.name)[0][4];
		levelofMob = (Math.floor(Math.random() * (playerLevel + 1)) + 1)
		attackdmg = (Math.floor(Math.random() * (levelofMob *5)) + 1);
		hp = (Math.floor(Math.random() * (levelofMob *10)) + 1)
		chanceOfFaith = ((Math.floor(Math.random() * 4) + 1) == 2);
		amountofExp = (Math.floor(Math.random() * 10) + 0);
		monsterType = typesOfMonsters[Math.floor(Math.random() * typesOfMonsters.length)];
		monsterfoodDrop = foodDrops[Math.floor(Math.random() * foodDrops.length)];
		diceToRoll = playerLevel;
        yield printMessage("Quickly @" + this.sender.name + ", the level " 
            + levelofMob.toString() 
            + " " + monsterType + " is going after you! Roll a " + levelDice[diceToRoll] +" and defeat it. You must beat a " + hp,"red", this.roomClient,"text");
		console.log("Starting to wait for player " + underattack);
		monsterTimer = setTimeout(function (room, name) {
				console.log("Monster timed out");
				room.sendNotification(underattack + " took too long to fight back, and nearly died to the monster. 10 hp lost.");
				underattack = "";
				alreadyattacking = false;
				stats = dict.getVal(name)[0];
				stats[0] = parseInt(stats[0]) - 10;
				mainArray = dict.getVal(name);
				mainArray[0] = stats;
				dict.update(name, mainArray);
			}, 30000, this.roomClient, this.sender.name);

	}

	return;
});
addon.webhook('room_message', /^\/rpg/i, function  * () {
	yield this.roomClient.sendNotification("Available commands: roll|class|stats|inventory|pepper|rpg")
});

addon.webhook('room_message', /^\/stats\s*([a-z]+)?/i, function  * () {
	if (stats_process)
		return;
	stats_process = true;
	initPlayer(this.sender.name);
	mainArray = dict.getVal(this.sender.name);
	stats = mainArray[0];
	pclass = mainArray[2];
	yield this.roomClient.sendNotification("@" + this.sender.name + "'s stats | class: " + pclass[0] + " | hp: " + stats[0].toString() + " | Level: " + stats[4] + " | EXP: " + stats[3] + " | pepper: " + stats[1].toString() + " | seasoning modifier: " + stats[2].toString(), {
		color : 'green',
		format : 'text'
	});
	stats_process = false;
});

addon.webhook('room_message', /^\/inventory/i, function  * () {
	if (inventory_process)
		return;
	inventory_process = true;
	initPlayer(this.sender.name);
	mainArray = dict.getVal(this.sender.name);
	inventory = mainArray[1];
	yield this.roomClient.sendNotification(this.sender.name + "'s inventory: " + inventory.toString());
	inventory_process = false;
});

addon.webhook('room_message', /^\/pepper/i, function  * () {
	if (prayer_process) {
		return;
	}

	prayer_process = true;
	initPlayer(this.sender.name);
	mainArray = dict.getVal(this.sender.name);
	stats = mainArray[0];
	if (stats[1] <= 0) {
		yield this.roomClient.sendNotification(this.sender.name + " does not have enough pepper to season.");
	} else {
		var prayermod = (Math.floor(Math.random() * 5));
		stats[1] = stats[1] - 1
			stats[2] = parseInt(stats[2] + prayermod);
		yield this.roomClient.sendNotification(this.sender.name + " successfully seasoned for +" + prayermod.toString() + " modifier on next roll.");
	}
	prayer_process = false;

});

addon.webhook('room_message', /^\/roll\s*([0-9]+)?(?:d([0-9]+))?(?:\s*\+\s*([0-9]+))?/i, function  * () {
	initPlayer(this.sender.name);
	if (this.sender.name == alreadyrolling)
		return;
	alreadyrolling = this.sender.name;
	var numofvars = this.match;
	var numofdice = this.match[1];
	var numofsides = this.match[2];
	var modifier = this.match[3];
	if (parseInt(this.match[1]) > 100) {
        return yield printMessage("@" + this.sender.name + " sucks at foosball", "yellow", this.roomClient, "text")
	}
	if (this.match[1] && this.match[2] && this.match[3]) {
        var diceRoll = rollDice(parseInt(numofdice),parseInt(numofsides), parseInt(modifier));
        console.log("Mod dice roll" + diceRoll);
		var totalString = formatRoll(parseInt(numofdice),parseInt(numofsides),parseInt(modifier),diceRoll, this.sender.name);
		var total = diceRoll[0]
        yield printMessage(totalString, "purple", this.roomClient, "text");


	} else if (this.match[1] && this.match[2] || !this.match[1] && !this.match[2] && !this.match[3]) {
		var totalString = "";
		var total = 0;
		if (!this.match[1] && !this.match[2] && !this.match[3]) {
			var diceArray;
			var mainArray = dict.getVal(this.sender.name);
			var seasonMod = mainArray[0][2];
			playerDiceType = levelDice[dict.getVal(this.sender.name)[0][4]];
			diceArray = playerDiceType.split("d");
			numofdice = parseInt(diceArray[0]);
			numofsides = parseInt(diceArray[1]);
            var diceRoll = rollDice(parseInt(numofdice),parseInt(numofsides), parseInt(seasonMod));
			totalString = formatRoll(numofdice, numofsides, seasonMod, diceRoll, this.sender.name)
			total = parseInt(diceRoll[0]);
		} else {
			
			numofdice = parseInt(this.match[1]);
			numofsides = parseInt(this.match[2]);
			console.log("NUMOFDICE: " + numofdice);
			var diceResult = rollDice(numofdice,numofsides,0);
			totalString = formatRoll(numofdice, numofsides, 0 , diceResult, this.sender.name)
			total = diceResult[0];
			
		}
		yield printMessage(totalString, "purple", this.roomClient);

		if (playerDiceType){
			var diceArray = playerDiceType.split("d");
			
		}else{
			var diceArray = [0,0];
			diceArray[0]= numofdice;
			diceArray[1] = numofsides;
		}
		
		if (((this.sender.name == underattack) && (numofdice == parseInt(diceArray[0])) && (numofsides == parseInt(diceArray[1]))) ||((this.sender.name == underattack) && (this.match[1] == parseInt(diceArray[0])) && (this.match[2] == parseInt(diceArray[1]))) ) {
			clearTimeout(monsterTimer);
            underattack == "";
            alreadyattacking = false;
			console.log("TOTAL ROLL: " + total);
            classCast(this.sender.name);
			if (parseInt(total) > hp) {
			
				if (total == 20) (amountofExp = amountofExp * 2);
				yield this.roomClient.sendNotification("@" + this.sender.name + ' defeated the ' + monsterType + ' and got ' + monsterfoodDrop + ' that restores ' + Math.floor(attackdmg) + " hp along with " + amountofExp + " exp!", {
					color : 'purple',
					format : 'text'
				});
				stats = dict.getVal(this.sender.name)[0];
				stats[3] = stats[3] + amountofExp;
				stats[4] = Math.floor(stats[3] / 20);
				amountofExp = 0;
				stats[2] = 0;

				stats[0] = parseInt(stats[0]) + Math.floor(attackdmg / 2);
				if (chanceOfFaith) {
					chanceOfFaith = false;
					yield this.roomClient.sendNotification('The monster dropped some pepper! @' + this.sender.name + ' gained 1 pepper.', {
						color : 'purple',
						format : 'text'
					});
					stats[1] = stats[1] + 1;
				}
				mainArray = dict.getVal(this.sender.name);
				mainArray[0] = stats;
				dict.update(this.sender.name, mainArray);
				console.log("MAIN ARRAY: " + mainArray.toString());
				alreadyattacking = false;
			} else {
				yield this.roomClient.sendNotification("@" + this.sender.name + ' lost ' + attackdmg + ' hp!', {
					color : 'purple',
					format : 'text'
				});
				stats = dict.getVal(this.sender.name)[0];
				stats[2] = 0;
				stats[0] = parseInt(stats[0]) - parseInt(attackdmg);
				if (stats[0] <=0){
					yield this.roomClient.sendNotification("@" + this.sender.name + ' has died.', {
					color : 'red',
					format : 'text'
					});
					dict.remove(this.sender.name);
					initPlayer(this.sender.name);
				}else{
				
					mainArray = dict.getVal(this.sender.name);
					mainArray[0] = stats;
					dict.update(this.sender.name, mainArray);
				}
				underattack = ""
				alreadyattacking = false;
			}

		}
	} else if (this.match[1]) {

		yield this.roomClient.sendNotification("@" + this.sender.name + ' rolled a dice with ' + this.match[1] + ' sides ...... [' + (Math.floor(Math.random() * parseInt(this.match[1])) + 1) + ']', {
			color : 'purple',
			format : 'text'
		});

	}
	alreadyrolling = "";
});

addon.webhook('room_message', /^\/attack/i, function * () {

});

// DICE ROLLING FUNCTIONS
// ======================

// USAGE: Print this string with "@UserX: " appended to the front.
function formatRoll (num, sides, mod, res, playername) {
	var pre_str = playername + " rolled " + num + "d" + sides + "+" + mod + ": ";
	
	var res_str = "(";
	for (var i = 1; i < num+1; i++) {
		if (i == 1) {
			res_str += res[i];
		} else {
			res_str += "+" + res[i];
		}
	}
	res_str += ")";
	if (mod) {
		res_str += "+" + mod;	
	}
	res_str += " = " + res[0];

	return pre_str + res_str;
}

function rollDice (num, sides, mod) {
    console.log(num);
    console.log(sides);
    console.log(mod);
	var res = [];
	res.push(0);

	// default values
	if (!num) {
		num = 1;
	}
	if (!sides) {
		sides = 20;
	}
	if (!mod) {
		mod = 0;
	}

	// sanity check
	if (parseInt(num) > 100) {
		res[0] = -1;
		return res;
	}

	for (i = 1; i < num + 1; i++) {
		res.push(randFromRange(1, sides));
		res[0] += res[i];
	}
    res[0] += parseInt(mod);
	return res;
}

function randFromRange (low, high) {
	var diff = parseInt(high) - parseInt(low);
	return Math.floor(Math.random() * diff + parseInt(low));
}

// HIPCHAT FUNCTIONS
// =================

function printMessage (msg, clr, room, form) {
    if (form == "undefined") form = "html";
	return room.sendNotification(
		msg, 
		{
			color : clr,
			format : form
		});
	
}

// PAT'S RANDOM, UNSORTED FUNCTIONS
// ================================

function sleep (milliSeconds) {
	var startTime = new Date().getTime(); // get the current time
	while (new Date().getTime() < startTime + milliSeconds); // hog cpu
}

function initPlayer(playername) {
	stats = [100, 1, 0, 0, 0, 0];
	inventory = ["Sealed rusty pickaxe", "", ""];
	playerClass = ["","","","",""];
	mainArray = [stats, inventory,playerClass];
	if (dict.getVal(playername) == "Key not found!") {
		console.log("Creating Player: " + playername);
		dict.add(playername, mainArray);
	}
}

function checkPlayer(playername){
	mainArray = dict.getVal(playername);
	if (mainArray.length == 2){
		console.log("Updating Player");
		// playerData not up to v2
		playerClass = ["","","","","","","",""];
		mainArray.push(playerClass);
	}		
}

function classCast(playername){
	var abilityCheck = randomHelper(7) == 5;
	var mainArray = dict.getVal(playername);
	var playerClass = mainArray[2];
	// 1 ability for now
	if (abilityCheck){
		switch (playerClass[0]){
			case "Cleric":
			var healPower = randomHelper(5+mainArray[0][4]);
				printMessage(playername + " casted <b>Self Renew</b> and was healed for <b>" + healPower.toString() + "</b>!", "random", this.roomClient, "html");
				stats = mainArray[0];
				stats[0] = stats[0] + healPower;
				mainArray[0] = stats;
				dict.update(playername, mainArray);
				break;
			case "Mage":
				break;
			case "Princess":
				break;
			case "Warrior":
				break;
			default:
				return;
		
		
		}
	}
	return;
}

function randomHelper(upperbound){
	return (Math.floor(Math.random() * upperbound) + 1)
}
function sendRoomMessage(message, room){
	return room.sendNotification(message);
}
function saveData(file) {
	ser.registerKnownType("JSDICT", JSdict);
	var data = ser.stringify({
			dict : dict
		});

	fs.writeFile("data", data, function (err) {
		if (err) {
			console.log(err);
		} else {
			console.log("The file was saved!");
		}
	});
}

// PERSISTENCE
// ===========

function loadData() {
	try {
		ser.registerKnownType("JSDICT", JSdict);
		var load = fs.readFileSync("data", 'utf8');
		var deserialized = ser.parse(load);
		dict = deserialized.dict;
	}
	catch(err) {
		console.log(err);
	}

}
function JSdict() {
	this.Keys = [];
	this.Values = [];
}

// Check if dictionary extensions aren't implemented yet.
// Returns value of a key
if (!JSdict.prototype.getVal) {
	JSdict.prototype.getVal = function (key) {
		if (key == null) {
			return "Key cannot be null";
		}
		for (var i = 0; i < this.Keys.length; i++) {
			if (this.Keys[i] == key) {
				return this.Values[i];
			}
		}
		return "Key not found!";
	}
}

// Check if dictionary extensions aren't implemented yet.
// Updates value of a key
if (!JSdict.prototype.update) {
	JSdict.prototype.update = function (key, val) {
		console.log("Saving dictionary first");
		saveData(dict);
		if (key == null || val == null) {
			return "Key or Value cannot be null";
		}
		// Verify dict integrity before each operation
		if (keysLength != valsLength) {
			return "Dictionary inconsistent. Keys length don't match values!";
		}
		var keysLength = this.Keys.length;
		var valsLength = this.Values.length;
		var flag = false;
		for (var i = 0; i < keysLength; i++) {
			if (this.Keys[i] == key) {
				this.Values[i] = val;
				flag = true;
				break;
			}
		}
		if (!flag) {
			return "Key does not exist";
		}
	}
}

// Check if dictionary extensions aren't implemented yet.
// Adds a unique key value pair
if (!JSdict.prototype.add) {
	JSdict.prototype.add = function (key, val) {
		console.log("Saving dictionary first");
		saveData(dict);
		// Allow only strings or numbers as keys
		if (typeof(key) == "number" || typeof(key) == "string") {
			if (key == null || val == null) {
				return "Key or Value cannot be null";
			}
			if (keysLength != valsLength) {
				return "Dictionary inconsistent. Keys length don't match values!";
			}
			var keysLength = this.Keys.length;
			var valsLength = this.Values.length;
			for (var i = 0; i < keysLength; i++) {
				if (this.Keys[i] == key) {
					return "Duplicate keys not allowed!";
				}
			}
			this.Keys.push(key);
			this.Values.push(val);
		} else {
			return "Only number or string can be key!";
		}
	}
}

// Check if dictionary extensions aren't implemented yet.
// Removes a key value pair
if (!JSdict.prototype.remove) {
	JSdict.prototype.remove = function (key) {
		if (key == null) {
			return "Key cannot be null";
		}
		if (keysLength != valsLength) {
			return "Dictionary inconsistent. Keys length don't match values!";
		}
		var keysLength = this.Keys.length;
		var valsLength = this.Values.length;
		var flag = false;
		for (var i = 0; i < keysLength; i++) {
			if (this.Keys[i] == key) {
				this.Keys.shift(key);
				this.Values.shift(this.Values[i]);
				flag = true;
				break;
			}
		}
		if (!flag) {
			return "Key does not exist";
		}
	}
}
loadData();
app.listen();
