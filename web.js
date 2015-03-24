// data: [ARRAY[HP,PEPPERPOINTS,SEASONINGMOD,EXP, LEVEL, GOLD],ARRAY[ITEMS],ARRAY[CLASSNAME, numOfReRolls, target, warrior mod]]
var typesOfMonsters = ["globin", "poring", "Ghostly Josh", "Headless Jimmy", "Spooky Jennie", 
"Playboy Rob", "Mad Patrick", "Crazy Leo", "Sad Caledonia", 
"Master Imran", "Giant Josh", "Grapefruit Jimmy", "Fried Rob", "Potato Leo",
"Chicken Jennie", "Soup Caledonia", "Icecream Imran", "Sandwich Patrick"];
var foodDrops = ["an Apple", "a Potato", "Jimmy's sandwich", "Josh's bacon", "Jennie's fruit punch", "Rob's pills", "Patrick's JapaDog", "Leo's Monopoly", "Caledonia's Waterbottle", "Imran's Resume"];
var classTypes = ["Cleric", "Mage", "Princess", "Warrior"];
var mainShop = ["HealthPotion"]
var monsterLevelDice = [20,30,40,50,60];
var ack = require('ac-koa').require('hipchat');
var pkg = require('./package.json');
var app = ack(pkg, {store: 'MongoStore'});
var MongoStore = require('ac-node').MongoStore;
var addonStore = MongoStore(process.env[app.config.MONGO_ENV], 'dice');
var Serializer = require("backpack-node").system.Serializer;
var ser = new Serializer();
var fs = require('fs');
var app = ack(pkg);
var http = require('http');
var monsterTimer;
var alreadyattacking = false;
var underattack = "";
var alreadyrolling = "";
var hp = 0;
var dict = new JSdict();
var attackdmg;
var chanceOfFaith = false;
var amountofExp = false;
var statsAll = false;
var globalEnc = 20;
var monsterType = "";
var monsterfoodDrop = "";
var playerDiceType;
var mainTimerDuration = 300000;
var arenaStartLobby = false;
var arenaPlayers = new Array();
var gainHP;
var increaseMonsterChance = new Array();
var gMonsterChance = new Array();
var diceToRoll = 0;
var arenaStarted = {status: false}
var levelofMob = 1;
var prayer_process = false;
var inventory_process = false;
var stats_process = false;
var globalMonTimer;
var globalMonClear;
var monsterGoldDrop;
var gTarget = {name:""};
var peopleInRoom;
var globalRoom;
var shop_process;
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
// Object reference maker
Object.prototype.$=function $(val){if(val)this.valueOf=this.toSource=this.toString=function(){return val};return val;};
function isInArray(value, array) {
  return array.indexOf(value) > -1;
}
addon.webhook('room_message', /^\/shop\s*([a-z]+)?\s*([a-z]+)?/i, function  * () {
    if (shop_process){
        return
    }
    shop_process = true;
    if (this.match[1] != "buy" || !this.match[2] ){
        printMessage("Buy and use an item automatically with /shop buy itemname.", "green", this.roomClient);
        printMessage("HealthPotion - 15g | Pepper - 3g | Bayleaf - 5g | Arenatoken - 20g", "green", this.roomClient);
        shop_process = false;
        return;
    }
    var buyingItem = this.match[2];
    logToFile(this.match[2] == "healthpotion" || this.match[2] == "pepper");
    // just gonna have a static shop for now
    var playerGold = parseInt(dict.getVal(this.sender.name)[0][5]);
    var mainArray = dict.getVal(this.sender.name);
    var stats = mainArray[0];
    var playerClass = mainArray[2];
    var inventory = mainArray[1];
    logToFile("In shopbuying: " + stats)
    if (this.match[2] == "healthpotion"){
        if (15 > playerGold) {
            shop_process = false;
            return yield printMessage("Not enough gold.", "green", this.roomClient);
        }else{
            stats[5] -= 15;
            // hp heals for 30
            stats[0] += 30;
            mainArray[0] = stats;
            dict.update(this.sender.name, mainArray);
            shop_process = false;
            return yield printMessage("HP potion bought and used automatically, +30hp.", "green", this.roomClient);
        }
    } else if (this.match[2] == "pepper"){
        if (2 > playerGold) {
            shop_process = false;
            return yield printMessage("Not enough gold.", "green", this.roomClient);
        }else{
            stats[5] -= 3;
            // hp heals for 30
            stats[1] += 1;
            mainArray[0] = stats;
            dict.update(this.sender.name, mainArray);
            shop_process = false;
            return yield printMessage("Pepper bought and stored.", "green", this.roomClient);  
        }
    }else if (this.match[2] == "bayleaf"){
        if (5 > playerGold) {
            shop_process = false;
            return yield printMessage("Not enough gold.", "green", this.roomClient);
        }else{
            stats[5] -= 5;
            // hp heals for 30
            playerClass[1] += 1;
            mainArray[2] = playerClass;
            dict.update(this.sender.name, mainArray);
            shop_process = false;
            return yield printMessage("Bay leaf bought and stored.", "green", this.roomClient);  
        }
    }else if (this.match[2] == "arenatoken"){
        if (20 > playerGold) {
            shop_process = false;
            return yield printMessage("Not enough gold.", "green", this.roomClient);
        }else{
            stats[5] -= 20;
            inventory.push("arenatoken");
            mainArray[1] = inventory;
            dict.update(this.sender.name, mainArray);
            shop_process = false;
            return yield printMessage("Arenatoken bought and stored in inventory.", "green", this.roomClient); 
        }

    }else{
        shop_process = false;
        return yield printMessage("No such item exists.", "green", this.roomClient);
    }


    shop_process = false;
});
addon.webhook('room_message', /^\/target\s*([\S\s]*)$/i, function  * () {
    var mainArray = dict.getVal(this.sender.name);
    var pclass = mainArray[2];
    var target = this.match[1];
    logToFile(dict.Keys.length);
    if (!this.match[1]){ 
        return yield printMessage("@" +this.sender.mention_name + " is currently targeting + " + pclass[2] + ".", "green", this.roomClient, "text") 
    }
    if (pclass[0] != "Cleric"){
        return yield printMessage("Must be a {Cleric} to use this feature.", "red", this.roomClient, "text")
    }
    logToFile("Attempting to target " + this.match[1]);
    if (dict.getVal(this.match[1]) == "Key not found!"){
        return yield printMessage(this.match[1] + " could not be found!", "green", this.roomClient);
    }
    yield printMessage("@" + this.sender.mention_name + " targeted " + this.match[1] + ".", "green", this.roomClient, "text")
    pclass[2] = target.toString();
    mainArray[2] = pclass;
    dict.update(this.sender.name, mainArray);
});

addon.webhook('room_message', /^\/class\s*([a-z]+)?/i, function  * () {
	logToFile(this.match[1]);
	if (this.match[1] == "plsgivemesomethinggood"){
		mainArray = dict.getVal(this.sender.name);
		pclass = mainArray[2];

		if (parseInt(pclass[1]) <= 0){
            return printMessage(this.sender.name +"'s class has been chosen already. You cannot change destiny.", "red", this.roomClient);
        } 
        pclass[1] -= 1;
		chosenClass = classTypes[Math.floor(Math.random() * classTypes.length)];
		printMessage(this.sender.name + "'s rolls the destiny dice and is chosen as a......<b>" + chosenClass + "</b>!!!!", "green", this.roomClient);

		pclass[0] = chosenClass;
		mainArray[2] = pclass;
		dict.update(this.sender.name, mainArray);
		return;

	}else{
        var mainArray = dict.getVal(this.sender.name);
        var pclass = mainArray[2];
        var rerolls = pclass[1];
        if (pclass[1] == "" && pclass[1] != 0){ 
            logToFile("REROLLS: " + rerolls);
            pclass[1] = 1;
        }
        mainArray[2] = pclass;
        dict.update(this.sender.name, mainArray);
		printMessage("Available classes: Cleric, Mage, Warrior, Princess. Choose with /class plsgivemesomethinggood. @" +
            this.sender.mention_name + " has " + pclass[1] + "x [Bay leaf] left!", "yellow", this.roomClient, "text");
	}

});
addon.webhook('room_message', /^\/arena\s*([a-z]+)?/i, function  * () {
    var mainArray = dict.getVal(this.sender.name);
    var playerInventory = mainArray[1];
    if (this.match[1] == "join" && arenaStartLobby && !isInArray(this.sender.name, arenaPlayers)){
        arenaPlayers.push(this.sender.name);
        
        yield printMessage("@" + this.sender.mention_name + " has joined the arena! Need " + (3- arenaPlayers.length).toString() + " more players!", "yellow", this.roomClient, "text");
        if (arenaPlayers.length == 3){
            arenaPlayers = new Array();
            arenaStartLobby = false;
            yield printMessage("Enough players have joined! Starting arena. For the next minute, all message will trigger monster encounters!", "yellow", this.roomClient, "text");
            arenaStarted.status = true;
            logToFile("Starting arena");
            var arenaTimer = setTimeout(function (start, room) {
                    logToFile("ending arena");
                    arenaStarted.status = false;
                    printMessage("Arena has ended.", "green", room, "text");
                    clearTimeout(monsterTimer)
                }, 20000, arenaStarted, this.roomClient)

        }
    }else if (isInArray("arenatoken", playerInventory) && !arenaStartLobby){
        playerInventory.splice(playerInventory.indexOf("arenatoken"), 1);
        mainArray[1] = playerInventory;
        dict.update(this.sender.name, mainArray);
        yield printMessage("@" + this.sender.mention_name + " has started an arena! Requires 3 other players to start. Type '/arena join' to help start it!", "yellow", this.roomClient, "text");
        arenaStartLobby = true;

    }else{
        return yield printMessage("No arena has been started", "yellow", this.roomClient, "text");
    }
    
});
addon.webhook('room_message', /^[^\/].*|^\/farm/i, function  * () {
    if (alreadyattacking) {
        return;
    }
    if (!globalMonTimer){
        logToFile("In Timer setup");
        globalMonTimer = setInterval(function(roomC, tar) {
            var today = new Date().getHours();
            var day = new Date().getDay();
            logToFile("Current hour: " + today);
            // time on vm
            if (today <= 24 && today >= 17 && !alreadyattacking && (day != 0) && (day != 7) && (underattack == "") && (arenaStarted.status == false)) {

                var rand = Math.floor(Math.random() * gMonsterChance.length)
                logToFile("Rand is currently: " + rand.toString());
                logToFile("ArraySze is currently: " + gMonsterChance.length.toString());
                gTarget.name = gMonsterChance[rand];
                //tar.$("Patrick");
                if (gTarget.name != "undefined"){
                    logToFile("Target is currently: " + gTarget.name);
                    printMessage("@"+gTarget.name + " hears something rustle in the tall grass...poke ball ready...", "purple", roomC, "text");
                    globalEnc = 21;
                    gMonsterChance.splice(rand, 1);
                    globalMonClear = setTimeout(function (tar) {
                        logToFile("grass timed out");
                        gTarget.name = "";
                        if (gMonsterChance.length == 0){
                        fillMonsterChanceArray();
                        logToFile("Monster array is currently: " + gMonsterChance);
                        }
                    }, 30000, gTarget);
                }
            }
        }, 600000, this.roomClient, gTarget)

    }
    var trigger = false;
    if ((this.match[0] == "/farm") && (globalEnc == 21) && (this.sender.mention_name == gTarget.name)){
        logToFile("In /farm");
        globalEnc = 0;
        trigger = true;
    }

    if (!increaseMonsterChance[this.sender.name] && (this.sender.name != "$")){
        increaseMonsterChance[this.sender.name] = 1;
    }
	var doweatk = randFromRange(increaseMonsterChance[this.sender.name], 20);
    logToFile("Monster encounter rolls: " + doweatk.toString());
    logToFile("Arena started?: " + arenaStarted.status);
	if ((parseInt(doweatk) == 17 || trigger || arenaStarted.status == true) && !alreadyattacking) {

		initPlayer(this.sender.name);
		alreadyattacking = true;
		underattack = this.sender.name;
        if (dict.getVal(this.sender.name)[2][0] == "Warrior"){
            postAttackFunc(this.sender.name);
        }
		// lets get player level
        clearTimeout(globalMonClear);
		var playerLevel = dict.getVal(this.sender.name)[0][4];
        if ((playerLevel - 2) <=0) {
            levelofMob = 1
        }else{
		  levelofMob = randFromRange(playerLevel-2, (playerLevel +1));
        }
		// attackdmg = (Math.floor(Math.random() * (levelofMob *5)) + levelofMob);
        // roll a xd8
        attackdmg = (rollDice(Math.ceil(parseInt(levelofMob)/2),8,0));
        logToFile("The monster rolled: " + attackdmg.toString());
        if (levelofMob > 19){
             levelofMob == 18;
        } 
		hp = randFromRange(levelofMob, 19);
        logToFile("HP of monster :" + hp);
        logToFile("Level of monster: " + levelofMob);

        gainHP = hp;
        if (gainHP == "Infinity"){
            gainHP = 1;
        }
        logToFile("GainHp: " + gainHP);
		chanceOfFaith = (randFromRange(1,4)== 2);
		amountofExp = randFromRange(1,10);
        logToFile("HP3 of monster :" + hp);
        monsterGoldDrop = randFromRange(1,levelofMob);
		monsterType = typesOfMonsters[Math.floor(Math.random() * typesOfMonsters.length)];
		monsterfoodDrop = foodDrops[Math.floor(Math.random() * foodDrops.length)];
		diceToRoll = playerLevel;
        logToFile("HP4 of monster :" + hp);
        yield printMessage("Quickly @" + this.sender.mention_name + ", the level "
            + levelofMob.toString()
            + " " + monsterType + " is going after you! Roll a 1d20 and defeat it. You must beat a " + hp +". Rolling for attack damage...","red", this.roomClient,"text");
        logToFile("Attack Damage in first enc: " + attackdmg.toString())
        yield printMessage(formatRoll(Math.ceil(levelofMob/2), 8, 0, attackdmg, monsterType), "red", this.roomClient, "html");
		logToFile("Starting to wait for player " + underattack);
		monsterTimer = setTimeout(function (room, name) {
            if (underattack != ""){
				logToFile("Monster timed out");
				room.sendNotification(underattack + " took too long to fight back, and nearly died to the monster. "+ attackdmg[0]+ "hp lost.");
				underattack = "";
				alreadyattacking = false;
				stats = dict.getVal(name)[0];
				stats[0] = parseInt(stats[0]) - attackdmg[0];
				mainArray = dict.getVal(name);
				mainArray[0] = stats;
				dict.update(name, mainArray);
                trigger = false
            }
			}, 60000, this.roomClient, this.sender.name);
    }
    increaseMonsterChance[this.sender.name] = 1;
    trigger = false

	return;
});

addon.webhook('room_message', /^\/stats\s*([\S]*)$/i, function  * () {
	if (stats_process)
		return;
	stats_process = true;
	initPlayer(this.sender.name);
    if (this.match[1] == "all"){
        if (statsAll) {
            stats_process = false;
            return yield printMessage("It's too soon for stats all.", "red", this.roomClient, "text");
        }
    
        statsAll = true;
        var printString = "";
        for (var i in dict.Keys){
            try{
      
            var personName = dict.Keys[i];

            logToFile("Looping thru " + personName);
            var tempPlayerArray = dict.getVal(personName);
            var tempPlayerStats = tempPlayerArray[0];
            var tempPlayerClass = tempPlayerArray[2];

            yield printMessage(personName + "'s stats | " 
                + tempPlayerClass[0] + " | hp: " 
                + tempPlayerStats[0].toString() + " | Level: " 
                + tempPlayerStats[4] + " | EXP: " + tempPlayerStats[3] 
                + " | pepper: " + tempPlayerStats[1].toString(), "yellow", this.roomClient, "text");
            }catch(err){
                logToFile(err);
            }

        }
            statsTimer = setTimeout(function (room) {
                logToFile("stats all is ready");
                stats_process = false;
                statsAll = false;
            }, 60000, this.roomClient);
        stats_process = false;
        return;
    }
	mainArray = dict.getVal(this.sender.name);
	stats = mainArray[0];
	pclass = mainArray[2];

    var tableString = "<table><tr><th>"+this.sender.mention_name + ":</th><th>Class</th><th>HP</th><th>Level</th><th>EXP</th><th>Pepper</th><th>Seasoning</th><th>Gold</th></tr>" +
    	"<tr><td></td><td>" +pclass[0]+"</td><td>"+stats[0].toString()+"</td><td>"+stats[4]+"</td><td>"+stats[3]+"</td><td>"+stats[1]+"</td><td>"+stats[2].toString()+"</td><td>"+stats[5].toString()+"</td></tr></table>";

    yield printMessage(tableString, "green", this.roomClient, "html");
    //printMessage(tableString, "green", this.roomClient, "html");
    stats_process = false;
// 	yield this.roomClient.sendNotification("@" + this.sender.mention_name + "'s stats | class: " + pclass[0] + " | hp: " + stats[0].toString() + " | Level: " + stats[4] + " | EXP: " + stats[3] + " | pepper: " + stats[1].toString() + " | seasoning modifier: " + stats[2].toString(), {
// 	//	color : 'green',
// 	//	format : 'text'
// 	//});
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

addon.webhook('room_message', /^\/pepper|^\/peppa/i, function  * () {
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
        return yield printMessage("@" + this.sender.mention_name + " sucks at foosball", "yellow", this.roomClient, "text")
	}
	if (this.match[1] && this.match[2] && this.match[3]) {
        var diceRoll = rollDice(parseInt(numofdice),parseInt(numofsides), parseInt(modifier));
        logToFile("Mod dice roll" + diceRoll);
		var totalString = formatRoll(parseInt(numofdice),parseInt(numofsides),parseInt(modifier),diceRoll, this.sender.mention_name);
		var total = diceRoll[0]
        yield printMessage(totalString, "purple", this.roomClient, "text");


	} else if (this.match[1] && this.match[2] || !this.match[1] && !this.match[2] && !this.match[3]) {
		var totalString = "";
		var total = 0;
		if (!this.match[1] && !this.match[2] && !this.match[3]) {
            if ((underattack == this.sender.name)){
                classCast(this.sender.name, this.roomClient, dict, attackdmg);
                logToFile("ATTACK dmg in main thread: " + attackdmg.toString());
            }
			var mainArray = dict.getVal(this.sender.name);
			var seasonMod = mainArray[0][2];
			numofdice = 1;
			numofsides = 20;
            var diceRoll = rollDice(parseInt(numofdice),parseInt(numofsides), parseInt(seasonMod));
			totalString = formatRoll(numofdice, numofsides, seasonMod, diceRoll, this.sender.mention_name)
			total = parseInt(diceRoll[0]);
		} else {

			numofdice = parseInt(this.match[1]);
			numofsides = parseInt(this.match[2]);
			logToFile("NUMOFDICE: " + numofdice);
			var diceResult = rollDice(numofdice,numofsides,0);
			totalString = formatRoll(numofdice, numofsides, 0 , diceResult, this.sender.mention_name)
			total = diceResult[0];

		}
		yield printMessage(totalString, "purple", this.roomClient, "text");


		if (((this.sender.name == underattack) && (numofdice == 1) && (numofsides == 20 ))) {
			clearTimeout(monsterTimer);
            underattack == "";
            alreadyattacking = false;
			logToFile("TOTAL ROLL: " + total);
			if (parseInt(total) >= hp) {

				if (total == 20){
                    amountofExp = amountofExp * 2;
                    monsterGoldDrop = monsterGoldDrop * 2;
                }

				yield this.roomClient.sendNotification("@" + this.sender.mention_name + ' defeated the ' + monsterType + ' and got ' + monsterfoodDrop + ' that restores ' + Math.floor(gainHP) + " hp along with " + amountofExp + " exp and " + monsterGoldDrop.toString() + " gold!", {
					color : 'purple',
					format : 'text'
				});
				stats = dict.getVal(this.sender.name)[0];
				stats[3] = stats[3] + amountofExp;
                stats[5] = parseInt(stats[5]) + parseInt(monsterGoldDrop);
                var currentLevel = stats[4];
				stats[4] = Math.floor(stats[3] / 20);
                if (currentLevel < stats[4]){
                    yield printMessage("@" + this.sender.mention_name + " has leveled up and is now level " + stats[4].toString() + ".", "yellow", this.roomClient, "text");
                }
				amountofExp = 0;
                monsterGoldDrop = 0;
				stats[2] = 0;

				stats[0] = parseInt(stats[0]) + Math.floor(gainHP);
				if (chanceOfFaith) {
					chanceOfFaith = false;
					yield this.roomClient.sendNotification('The monster dropped some pepper! @' + this.sender.mention_name + ' gained 1 pepper.', {
						color : 'purple',
						format : 'text'
					});
					stats[1] = stats[1] + 1;
				}
				mainArray = dict.getVal(this.sender.name);
				mainArray[0] = stats;
				dict.update(this.sender.name, mainArray);
				logToFile("MAIN ARRAY: " + mainArray.toString());
				alreadyattacking = false;
                trigger = false;
                underattack = "";
			} else {
				yield this.roomClient.sendNotification("@" + this.sender.mention_name + ' lost ' + attackdmg[0] + ' hp!', {
					color : 'purple',
					format : 'text'
				});
				stats = dict.getVal(this.sender.name)[0];
				stats[2] = 0;
				stats[0] = parseInt(stats[0]) - parseInt(attackdmg[0]);
                mainArray[2][3] = 0;
                logToFile("Current hp after loss: " + stats[0]);
				if (parseInt(stats[0]) <= 0){
                    logToFile("Dead player");
					yield this.roomClient.sendNotification("@" + this.sender.mention_name + ' has died.', {
					color : 'red',
					format : 'text'
					});
					dict.remove(this.sender.name);
                    saveData(dict);
					initPlayer(this.sender.name);
				}else{

					mainArray = dict.getVal(this.sender.name);
					mainArray[0] = stats;
					dict.update(this.sender.name, mainArray);
				}
				underattack = ""
                trigger = false;
				alreadyattacking = false;
			}
            postAttackFunc(this.sender.name);



		}
	} else if (this.match[1]) {

		yield this.roomClient.sendNotification("@" + this.sender.mention_name + ' rolled a dice with ' + this.match[1] + ' sides ...... [' + (Math.floor(Math.random() * parseInt(this.match[1])) + 1) + ']', {
			color : 'purple',
			format : 'text'
		});

	}
	alreadyrolling = "";
});

addon.webhook('room_message', /^\/attack/i, function * () {

});

function getAllPeople(people){
    var LineByLineReader = require('line-by-line'),
        lr = new LineByLineReader('people.txt');

    lr.on('error', function (err) {
        // 'err' contains error object
    });

    lr.on('line', function (line) {
        increaseMonsterChance[line] = 1;
        logToFile(line);
    });

    lr.on('end', function () {
        // All lines are read, file is closed now.
    });
}
function fillMonsterChanceArray(){
    var LineByLineReader = require('line-by-line'),
        lr = new LineByLineReader('peopleTag.txt');

    lr.on('error', function (err) {
        // 'err' contains error object
    });

    lr.on('line', function (line) {
        gMonsterChance.push(line);
        logToFile(gMonsterChance);
    });

    lr.on('end', function () {
        // All lines are read, file is closed now.
    });
}


// DICE ROLLING FUNCTIONS
// ======================

// USAGE: Print this string with "@UserX: " appended to the front.
function formatRoll (num, sides, mod, res, playername) {
    logToFile(num)
    logToFile(sides)
    logToFile(mod)
    logToFile(res)
	var pre_str = "@" + playername + " rolled " + num.toString() + "d" + sides.toString() + "+" + mod.toString() + ": ";

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
    logToFile(num);
    logToFile(sides);
    logToFile(mod);
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
    res[0] = parseInt(res[0]) + parseInt(mod);
	return res;
}

function randFromRange (low, high) {

    var roll = Math.floor(Math.random()*(parseInt(high)-parseInt(low)+1)+parseInt(low));

    return roll;
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
	inventory = ["", "", ""];
	playerClass = ["","","","",""];
	mainArray = [stats, inventory,playerClass];
	if (dict.getVal(playername) == "Key not found!") {
		logToFile("Creating Player: " + playername);
		dict.add(playername, mainArray);
	}
}

function checkPlayer(playername){
	mainArray = dict.getVal(playername);
	if (mainArray.length == 2){
		logToFile("Updating Player");
		// playerData not up to v2
		playerClass = ["","","","","","","",""];
		mainArray.push(playerClass);
	}
}

function classCast(playername, roomClient, mainDict, admg){
    var abilityCheck = randFromRange(1,2);

    logToFile("Ability Check: " + abilityCheck.toString());
    var mainArray = dict.getVal(playername);
    var playerClass = mainArray[2];
    // 1 ability for now
    if (abilityCheck == 2 || playerClass[0] == "Warrior"){
        var chooseAbility = randFromRange(1,2);
        logToFile("Ability to use: " + chooseAbility.toString());
        switch (playerClass[0]){
            case "Cleric":
                var healPower = parseInt(rollDice(parseInt(mainArray[0][4]),6,0)[0]);
                var target = playerClass[2];
                if (target == ""){
                    printMessage(playername + " casted <b>Self Renew</b> and was healed for <b>" + healPower.toString() + "</b>!", "random", roomClient, "html");
                }else {
                    printMessage(playername + " casted <b>Self Renew</b> on " + target + " and healed for <b>" + healPower.toString() + "</b>!", "random", roomClient, "html");
                }
                var targetMainArray = dict.getVal(target);
                logToFile("targerray: " + targetMainArray.toString());
                var targetStats = targetMainArray[0];
                targetStats[0] = parseInt(targetStats[0]) + healPower;
                targetMainArray[0] = targetStats;
                dict.update(target, targetMainArray);
                break;
            case "Mage":
                if (chooseAbility == 1){
                    var magicPower = randFromRange(3, mainArray[0][4]*2);
                    printMessage(playername + " peppered <b>magic missiles</b> and added <b>" + magicPower.toString() + "</b> to seasoning modifier.", "random", roomClient, "html");
                    var stats = mainArray[0];
                    stats[2] = parseInt(stats[2]) + parseInt(magicPower);
                    logToFile("Magic Missiles added: " + stats.toString());
                    mainArray[0] = stats;
                    logToFile("Magic Missiles added to MA: " + mainArray[0][2].toString());
                    dict.update(playername, mainArray);
                }else if (chooseAbility == 2){
                    var magicHPreduce = randFromRange(1,mainArray[0][4])
                    hp = hp - magicHPreduce;
                    printMessage(playername + " covered the monster in <b>Soy Sauce</b> and reduced the hp by <b>" + magicHPreduce.toString() + "</b>. HP of mob is now " + hp.toString(), "random", roomClient, "html");

                }
                break;
            case "Princess":
                if (chooseAbility ==1){
                    var princessPower = randFromRange(0, parseInt(mainArray[0][4])/2);
                    printMessage(playername + " waves around the magical <b>cinnamon stick</b> and produced <b>" + princessPower.toString() + " peppers </b>.", "random", roomClient, "html");
                    mainArray[0][1] += princessPower;
                    dict.update(playername, mainArray);
                }else if(chooseAbility==2){
                    logToFile("bread stick attackdmg: " + attackdmg[0]);
                    var reduceAttackDmg = randFromRange(0, attackdmg[0]);
                    printMessage(playername + " waves around the glowing <b>bread stick</b> and reduced the attack damage of the monster by <b>" +reduceAttackDmg.toString() + "</b>.", "random", roomClient, "html");
                    attackdmg[0] -= reduceAttackDmg;
                }
                break;
            case "Warrior":
                var attackModi = randFromRange(1, mainArray[0][4]);
                if (playerClass[3] == "") playerClass[3] = 0;
                if ((playerClass[3] + attackModi) <= 10) {
                    playerClass[3] += attackModi;
                    printMessage(playername + " executes <b>Pancakes From Above</b> added <b>"+attackModi.toString()+"</b> to the seasoning modifier.", "random", roomClient, "html");
                }
                logToFile("atk dmg before cast: " + attackdmg.toString());
                attackdmg[0] = (attackdmg[0] * mainArray[0][4]);
                if (attackdmg[0] >= 100){
                    attackdmg[0] = 100; 
                }
                logToFile("Attack dmg is currently: " + attackdmg[0])
                gainHP = Math.floor(gainHP/playerClass[3]);
                if (gainHP == 0) gainHP = 1;
                mainArray[2] = playerClass;
                dict.update(playername, mainArray);
                break;
            default:
                return true;


        }
    }
	return true;
}

function postAttackFunc(name){
    if (!dict.getVal(name)[2][3]){
        dict.getVal(name)[2][3] == 0;
    }
    dict.getVal(name)[0][2] = dict.getVal(name)[2][3];


}
function logToFile(message){
    console.log(message);
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
			logToFile(err);
		} else {
			logToFile("The file was saved!");
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
		logToFile(err);
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
        logToFile("Saving dictionary first");
        saveData(dict);
	}

}

// Check if dictionary extensions aren't implemented yet.
// Adds a unique key value pair
if (!JSdict.prototype.add) {
	JSdict.prototype.add = function (key, val) {

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
            logToFile("Saving dictionary first");
            saveData(dict);
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
        logToFile("Saving dictionary first");
        saveData(dict);
		if (!flag) {
			return "Key does not exist";
		}
	}
}

loadData();
app.listen();
getAllPeople(peopleInRoom);
logToFile(peopleInRoom);
fillMonsterChanceArray();

var timer = setInterval(function() {
 logToFile("Adding 1 to everyone") 

 for(var i in increaseMonsterChance) {
    if (increaseMonsterChance[i] <= 15)
        increaseMonsterChance[i] += 1;
    logToFile(i + "'s chances are now " + increaseMonsterChance[i]);
 }

}, 60000)

