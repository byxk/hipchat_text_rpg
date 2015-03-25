// data: [ARRAY[HP,PEPPERPOINTS,SEASONINGMOD,EXP, LEVEL, GOLD],ARRAY[ITEMS],ARRAY[CLASSNAME, numOfReRolls, target, warrior mod]]
// data v2: [main: [hp, pepperpoints, mod, exp, lvl ,gold]
//           inventory: [items]
//           classInfo: [name, rerolls, target, classMod] 
//           profile: [playerName, "", "","","",""]
//           ]
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
var DiceData = require('./lib/Dice')
var ser = new Serializer();
var fs = require('fs');
var app = ack(pkg);
var http = require('http');
var monsterTimer;
var alreadyattacking = false;
var underattack = "";
var alreadyrolling = "";
var hp = 0;
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
    var matchString = this.match;
    var senderName = this.sender.name
    var senderMentionName = this.sender.mention_name;
    var senderId = this.sender.id;
    var getUser = yield this.tenantStore.get(senderId)
    initPlayer(getUser, this, senderId, senderName);

    shop_process = true;
    if (matchString[1] != "buy" || !matchString[2] ){
        printMessage("Buy and use an item automatically with /shop buy itemname.", "green", this.roomClient);
        printMessage("HealthPotion - 15g | Pepper - 3g | Bayleaf - 5g | Arenatoken - 20g", "green", this.roomClient);
        shop_process = false;
        return;
    }
    var buyingItem = matchString[2];
    logToFile(matchString[2] == "healthpotion" || matchString[2] == "pepper");
    // just gonna have a static shop for now
    var stats = getUser.main
    var playerGold = parseInt(stats[5]);
    var playerClass = getUser.classInfo
    var inventory = getUser.inventory
    logToFile("In shopbuying: " + stats)
    if (matchString[2] == "healthpotion"){
        if (15 > playerGold) {
            shop_process = false;
            return yield printMessage("Not enough gold.", "green", this.roomClient);
        }else{
            stats[5] -= 15;
            // hp heals for 30
            stats[0] += 30;
            getUser.main = stats;
            updatePlayer(getUser, this, senderId)
            shop_process = false;
            return yield printMessage("HP potion bought and used automatically, +30hp.", "green", this.roomClient);
        }
    } else if (matchString[2] == "pepper"){
        if (2 > playerGold) {
            shop_process = false;
            return yield printMessage("Not enough gold.", "green", this.roomClient);
        }else{
            stats[5] -= 3;
            // hp heals for 30
            stats[1] += 1;
            getUser.main = stats;
            updatePlayer(getUser, this, senderId)
            shop_process = false;
            return yield printMessage("Pepper bought and stored.", "green", this.roomClient);  
        }
    }else if (matchString[2] == "bayleaf"){
        if (5 > playerGold) {
            shop_process = false;
            return yield printMessage("Not enough gold.", "green", this.roomClient);
        }else{
            stats[5] -= 5;
            // hp heals for 30
            playerClass[1] += 1;
            getUser.main = stats;
            updatePlayer(getUser, this, senderId)
            shop_process = false;
            return yield printMessage("Bay leaf bought and stored.", "green", this.roomClient);  
        }
    }else if (matchString[2] == "arenatoken"){
        if (20 > playerGold) {
            shop_process = false;
            return yield printMessage("Not enough gold.", "green", this.roomClient);
        }else{
            stats[5] -= 20;
            inventory.push("arenatoken");
            getUser.inventory = inventory;
            updatePlayer(getUser, this, senderId)
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
    var matchString = this.match;
    var senderName = this.sender.name
    var senderMentionName = this.sender.mention_name;
    var senderId = this.sender.id;
    var getUser = yield this.tenantStore.get(senderId)
    initPlayer(getUser, this, senderId, senderName);

    var pclass = getUser.classInfo;
    var target = matchString[1];
    if (!matchString[1]){ 
        return yield printMessage("@" +senderMentionName + " is currently targeting + " + pclass[2] + ".", "green", this.roomClient, "text") 
    }
    if (pclass[0] != "Cleric"){
        return yield printMessage("Must be a {Cleric} to use this feature.", "red", this.roomClient, "text")
    }
    logToFile("Attempting to target " + matchString[1]);
    if (getIdFromName(this, matchString[1]) == -1){
        return yield printMessage(matchString[1] + " could not be found!", "green", this.roomClient);
    }
    yield printMessage("@" + senderMentionName + " targeted " + matchString[1] + ".", "green", this.roomClient, "text")
    pclass[2] = target.toString();
    getUser.classInfo = pclass;
    updatePlayer(getUser, this, senderId);
});

addon.webhook('room_message', /^\/class\s*([a-z]+)?/i, function  * () {
    var matchString = this.match;
    var senderName = this.sender.name
    var senderMentionName = this.sender.mention_name;
    var senderId = this.sender.id;
    var getUser = yield this.tenantStore.get(senderId)
    initPlayer(getUser, this, senderId, senderName);

	if (matchString[1] == "plsgivemesomethinggood"){
		pclass = getUser.classInfo;

		if (parseInt(pclass[1]) <= 0){
            return printMessage(senderName +"'s class has been chosen already. You cannot change destiny.", "red", this.roomClient);
        } 
        pclass[1] -= 1;
		chosenClass = classTypes[Math.floor(Math.random() * classTypes.length)];
		printMessage(senderName + "'s rolls the destiny dice and is chosen as a......<b>" + chosenClass + "</b>!!!!", "green", this.roomClient);

		pclass[0] = chosenClass;
		getUser.classInfo = pclass;
        updatePlayer(getUser, this, senderId);
		return;

	}else{
		printMessage("Available classes: Cleric, Mage, Warrior, Princess. Choose with /class plsgivemesomethinggood. @" +
            senderMentionName + " has " + pclass[1] + "x [Bay leaf] left!", "yellow", this.roomClient, "text");
	}

});
addon.webhook('room_message', /^\/arena\s*([a-z]+)?/i, function  * () {
    return;
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
    var matchString = this.match;
    var senderName = this.sender.name
    var senderMentionName = this.sender.mention_name;
    var senderId = this.sender.id;

    var getUser = yield this.tenantStore.get(senderId)
    initPlayer(getUser, this, senderId, senderName);

    var dataBase = yield this.tenantStore.all();
    logToFile(dataBase);
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
    if ((matchString[0] == "/farm") && (globalEnc == 21) && (senderMentionName == gTarget.name)){
        logToFile("In /farm");
        globalEnc = 0;
        trigger = true;
    }

    if (!increaseMonsterChance[senderName] && (senderName != "$")){
        increaseMonsterChance[senderName] = 1;
    }
	var doweatk = randFromRange(increaseMonsterChance[senderName], 20);
    logToFile("Monster encounter rolls: " + doweatk.toString());
    logToFile("Arena started?: " + arenaStarted.status);
	if ((parseInt(doweatk) == 17 || trigger || senderName == "Patrick Tseng" || arenaStarted.status == true) && !alreadyattacking) {

		alreadyattacking = true;
		underattack = senderName;
        if (getUser.classInfo[0] == "Warrior"){
            postAttackFunc(getUser, this, senderId);
        }
		// lets get player level
        clearTimeout(globalMonClear);
		var playerLevel = getUser.main[4];
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
        yield printMessage("Quickly @" + senderMentionName + ", the level "
            + levelofMob.toString()
            + " " + monsterType + " is going after you! Roll a 1d20 and defeat it. You must beat a " + hp +". Rolling for attack damage...","red", this.roomClient,"text");
        logToFile("Attack Damage in first enc: " + attackdmg.toString())
        yield printMessage(formatRoll(Math.ceil(levelofMob/2), 8, 0, attackdmg, monsterType), "red", this.roomClient, "html");
		logToFile("Starting to wait for player " + underattack);
		monsterTimer = setTimeout(function (room, id, playerObject, self) {
            if (underattack != ""){
                var getUser = playerObject;
				logToFile("Monster timed out");
				room.sendNotification(underattack + " took too long to fight back, and nearly died to the monster. "+ attackdmg[0]+ "hp lost.");
				underattack = "";
				alreadyattacking = false;
				stats = getUser.main;
				stats[0] = parseInt(stats[0]) - attackdmg[0];
				getUser.main = stats;
                updatePlayer(getUser, self, id);
                trigger = false
            }
			}, 60000, this.roomClient, senderId, getUser, this);
    }
    increaseMonsterChance[senderName] = 1;
    trigger = false

	return;
});

addon.webhook('room_message', /^\/stats\s*([\S]*)$/i, function  * () {
	if (stats_process)
		return;
	stats_process = true;
    var matchString = this.match;
    var senderName = this.sender.name
    var senderMentionName = this.sender.mention_name;
    var senderId = this.sender.id;
    var getUser = yield this.tenantStore.get(senderId)
    initPlayer(getUser, this, senderId, senderName);

    // TODO: FIX AND UPDATE
    if (matchString[1] == "all"){
        var allUsers = yield this.tenantStore.all();
        if (statsAll) {
            stats_process = false;
            return yield printMessage("It's too soon for stats all.", "red", this.roomClient, "text");
        }
    
        statsAll = true;
        var printString = "";
        for (var i in allUsers){
  
      
            var personName = i;
            if (personName.length != 7) continue;
            logToFile("Looping thru " + personName);
            var tempPlayerArray = yield this.tenantStore.get(personName);
            var tempPlayerStats = tempPlayerArray.main;
            var tempPlayerClass = tempPlayerArray.classInfo
            var profile = tempPlayerArray.profile

            yield printMessage(profile[0] + "'s stats | " 
                + tempPlayerClass[0] + " | hp: " 
                + tempPlayerStats[0].toString() + " | Level: " 
                + tempPlayerStats[4] + " | EXP: " + tempPlayerStats[3] 
                + " | pepper: " + tempPlayerStats[1].toString(), "yellow", this.roomClient, "text");


        }
            statsTimer = setTimeout(function (room) {
                logToFile("stats all is ready");
                stats_process = false;
                statsAll = false;
            }, 60000, this.roomClient);
        stats_process = false;
        return;
    }

	stats = getUser.main;
	pclass = getUser.classInfo;

    var tableString = "<table><tr><th>"+senderMentionName + ":</th><th>Class</th><th>HP</th><th>Level</th><th>EXP</th><th>Pepper</th><th>Seasoning</th><th>Gold</th></tr>" +
    	"<tr><td></td><td>" +pclass[0]+"</td><td>"+stats[0].toString()+"</td><td>"+stats[4]+"</td><td>"+stats[3]+"</td><td>"+stats[1]+"</td><td>"+stats[2].toString()+"</td><td>"+stats[5].toString()+"</td></tr></table>";

    yield printMessage(tableString, "green", this.roomClient, "html");
    //printMessage(tableString, "green", this.roomClient, "html");
    stats_process = false;
// 	yield this.roomClient.sendNotification("@" + this.sender.mention_name + "'s stats | class: " + pclass[0] + " | hp: " + stats[0].toString() + " | Level: " + stats[4] + " | EXP: " + stats[3] + " | pepper: " + stats[1].toString() + " | seasoning modifier: " + stats[2].toString(), {
// 	//	color : 'green',
// 	//	format : 'text'
// 	//});
});

addon.webhook('room_message', /^\/inventory/i, function  * () {
	if (inventory_process)
		return;
    inventory_process = true;
    var matchString = this.match;
    var senderName = this.sender.name
    var senderMentionName = this.sender.mention_name;
    var senderId = this.sender.id;
    var getUser = yield this.tenantStore.get(senderId)
    initPlayer(getUser, this, senderId, senderName);

	inventory = getUser.inventory;
	yield this.roomClient.sendNotification(senderName + "'s inventory: " + inventory.toString());
	inventory_process = false;
});

addon.webhook('room_message', /^\/pepper|^\/peppa/i, function  * () {
	if (prayer_process) {
		return;
	}
	prayer_process = true;
    var matchString = this.match;
    var senderName = this.sender.name
    var senderMentionName = this.sender.mention_name;
    var senderId = this.sender.id;
    var getUser = yield this.tenantStore.get(senderId)
    initPlayer(getUser, this, senderId, senderName);

	stats = getUser.main;
	if (stats[1] <= 0) {
		yield this.roomClient.sendNotification(senderName + " does not have enough pepper to season.");
	} else {
		var prayermod = (Math.floor(Math.random() * 5));
		stats[1] = stats[1] - 1;
		stats[2] = parseInt(stats[2] + prayermod);
        getUser.main = stats;
        updatePlayer(getUser, this, senderId);
		yield this.roomClient.sendNotification(senderName + " successfully seasoned for +" + prayermod.toString() + " modifier on next roll.");

	}

	prayer_process = false;

});

addon.webhook('room_message', /^\/roll\s*([0-9]+)?(?:d([0-9]+))?(?:\s*\+\s*([0-9]+))?/i, function  * () {
    if (alreadyrolling)
        return;
    var matchString = this.match;
    var senderName = this.sender.name
    var senderMentionName = this.sender.mention_name;
    var senderId = this.sender.id;
    var getUser = yield this.tenantStore.get(senderId)
    initPlayer(getUser, this, senderId, senderName);

	alreadyrolling = senderName;
	var numofvars = matchString;
	var numofdice = matchString[1];
	var numofsides = matchString[2];
	var modifier = matchString[3];
	if (parseInt(matchString[1]) > 100) {
        return yield printMessage("@" + senderMentionName + " sucks at foosball", "yellow", this.roomClient, "text")
	}
	if (matchString[1] && matchString[2] && matchString[3]) {
        var diceRoll = rollDice(parseInt(numofdice),parseInt(numofsides), parseInt(modifier));
        logToFile("Mod dice roll" + diceRoll);
		var totalString = formatRoll(parseInt(numofdice),parseInt(numofsides),parseInt(modifier),diceRoll, senderMentionName);
		var total = diceRoll[0]
        yield printMessage(totalString, "purple", this.roomClient, "text");


	} else if (matchString[1] && matchString[2] || !matchString[1] && !matchString[2] && !matchString[3]) {
		var totalString = "";
		var total = 0;
		if (!matchString[1] && !matchString[2] && !matchString[3]) {
            if ((underattack == senderName)){
                classCast(senderName, this.roomClient, getUser, senderId, this);
                logToFile("ATTACK dmg in main thread: " + attackdmg.toString());
            }
			var seasonMod = getUser.main[2];
			numofdice = 1;
			numofsides = 20;
            var diceRoll = rollDice(parseInt(numofdice),parseInt(numofsides), parseInt(seasonMod));
			totalString = formatRoll(numofdice, numofsides, seasonMod, diceRoll, senderMentionName)
			total = parseInt(diceRoll[0]);
		} else {

			numofdice = parseInt(matchString[1]);
			numofsides = parseInt(matchString[2]);
			logToFile("NUMOFDICE: " + numofdice);
			var diceResult = rollDice(numofdice,numofsides,0);
			totalString = formatRoll(numofdice, numofsides, 0 , diceResult, senderMentionName)
			total = diceResult[0];

		}
		yield printMessage(totalString, "purple", this.roomClient, "text");


		if (((senderName == underattack) && (numofdice == 1) && (numofsides == 20 ))) {
			clearTimeout(monsterTimer);
            underattack == "";
            alreadyattacking = false;
			logToFile("TOTAL ROLL: " + total);
			if (parseInt(total) >= hp) {

				if (total == 20){
                    amountofExp = amountofExp * 2;
                    monsterGoldDrop = monsterGoldDrop * 2;
                }

				yield this.roomClient.sendNotification("@" + senderMentionName + ' defeated the ' + monsterType + ' and got ' + monsterfoodDrop + ' that restores ' + Math.floor(gainHP) + " hp along with " + amountofExp + " exp and " + monsterGoldDrop.toString() + " gold!", {
					color : 'purple',
					format : 'text'
				});
				stats = getUser.main;
				stats[3] = stats[3] + amountofExp;
                stats[5] = parseInt(stats[5]) + parseInt(monsterGoldDrop);
                var currentLevel = stats[4];
				stats[4] = Math.floor(stats[3] / 20);
                if (currentLevel < stats[4]){
                    yield printMessage("@" + senderMentionName + " has leveled up and is now level " + stats[4].toString() + ".", "yellow", this.roomClient, "text");
                }
				amountofExp = 0;
                monsterGoldDrop = 0;
				stats[2] = 0;

				stats[0] = parseInt(stats[0]) + Math.floor(gainHP);
				if (chanceOfFaith) {
					chanceOfFaith = false;
					yield this.roomClient.sendNotification('The monster dropped some pepper! @' + senderMentionName + ' gained 1 pepper.', {
						color : 'purple',
						format : 'text'
					});
					stats[1] = stats[1] + 1;
				}
				getUser.main = stats;
                updatePlayer(getUser,this, senderId);
				alreadyattacking = false;
                trigger = false;
                underattack = "";
			} else {
				yield this.roomClient.sendNotification("@" + senderMentionName + ' lost ' + attackdmg[0] + ' hp!', {
					color : 'purple',
					format : 'text'
				});
				stats = getUser.main;
				stats[2] = 0;
				stats[0] = parseInt(stats[0]) - parseInt(attackdmg[0]);
                // reset class stacks
                getUser.classInfo[3] = 0;
                logToFile("Current hp after loss: " + stats[0]);
				if (parseInt(stats[0]) <= 0){
                    logToFile("Dead player");
					yield this.roomClient.sendNotification("@" + senderMentionName + ' has died.', {
					   color : 'red',
					   format : 'text'
					});
					delPlayer(this, senderId);
				}else{
					getUser.main = stats;
                    updatePlayer(getUser, this, senderId);
				}
				underattack = ""
                trigger = false;
				alreadyattacking = false;
			}



		}
	} else if (matchString[1]) {

		yield this.roomClient.sendNotification("@" + senderMentionName + ' rolled a dice with ' + matchString[1] + ' sides ...... [' + (Math.floor(Math.random() * parseInt(matchString[1])) + 1) + ']', {
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

// data v2: [main: [ hp, pepperpoints, mod, exp, lvl ,gold]
//           inventory: [items]
//           classInfo: [name, rerolls, target, classMod] 
//           profile: [playerName, "", "","","",""]
//           ]
function initPlayer(playername, self, id, name) {
    var self = self;
    if (playername){
    logToFile("USER DOES EXIT: " + playername.main[2])
     return;
    }
    logToFile("CREATING USER: " + id);
    var playerObject = {
        main: [100,1,0,0,0,0,0],
        inventory: [],
        classInfo: ["",1,"",0,"",""],
        profile: [name, "", "","","",""]

    }
    self.tenantStore.set(id, playerObject);
    return;
}

function updatePlayer(playerObject, self, id){
    var self = self;
    self.tenantStore.set(id, playerObject);
    return logToFile("Saved PlayerObject for: " + id);
}
function delPlayer(self, id){
    var self = self;
    self.tenantStore.del(id);
    return logToFile("Deleted PlayerObject for: " + id);
}
function getIdFromName(self, name){
    var allUsers = self.tenantStore.all();
    for (var i in getUsers){
        var profile = self.tenantStore.get(i).profile;
        logToFile("Getting name from " + i);
        if (profile[0] == name){
            return i;
        }

    }
    return -1
}

function classCast(playername, roomClient, playerObject, id, self){
    var self = self;
    var senderId = id;
    var abilityCheck = randFromRange(1,2);
    logToFile("Ability Check: " + abilityCheck.toString());
    var getUser = playerObject;
    var playerClass = getUser.classInfo;
    // 1 ability for now
    if (abilityCheck == 2 || playerClass[0] == "Warrior"){
        var chooseAbility = randFromRange(1,2);
        logToFile("Ability to use: " + chooseAbility.toString());
        switch (playerClass[0]){
            case "Cleric":
                var healPower = parseInt(rollDice(parseInt(getUser.main[4]),6,0)[0]);
                var target = playerClass[2];
                if (target == ""){
                    printMessage(playername + " casted <b>Self Renew</b> and was healed for <b>" + healPower.toString() + "</b>!", "random", roomClient, "html");
                }else {
                    printMessage(playername + " casted <b>Self Renew</b> on " + target + " and healed for <b>" + healPower.toString() + "</b>!", "random", roomClient, "html");
                }
                var targetId = getIdFromName(self, target);
                var targetMainArray = self.tenantStore.get(targetId).main;
                logToFile("targerray: " + targetMainArray.toString());
                var targetStats = targetMainArray[0];
                targetStats[0] = parseInt(targetStats[0]) + healPower;
                targetMainArray.main = targetStats;
                updatePlayer(targetMainArray, self, targetId)
                break;
            case "Mage":
                if (chooseAbility == 1){
                    var magicPower = randFromRange(3, getUser.main[4]*2);
                    printMessage(playername + " peppered <b>magic missiles</b> and added <b>" + magicPower.toString() + "</b> to seasoning modifier.", "random", roomClient, "html");
                    var stats = getUser.main;
                    stats[2] = parseInt(stats[2]) + parseInt(magicPower);
                    logToFile("Magic Missiles added: " + stats.toString());
                    getUser.main = stats;
                    updatePlayer(getUser, self, senderId);
                    logToFile("Magic Missiles added to MA: " + mainArray[0][2].toString());
                }else if (chooseAbility == 2){
                    var magicHPreduce = randFromRange(1,getUser.main[4])
                    hp = hp - magicHPreduce;
                    printMessage(playername + " covered the monster in <b>Soy Sauce</b> and reduced the hp by <b>" + magicHPreduce.toString() + "</b>. HP of mob is now " + hp.toString(), "random", roomClient, "html");

                }
                break;
            case "Princess":
                if (chooseAbility ==1){
                    var princessPower = randFromRange(0, parseInt(getUser.main[4])/2);
                    printMessage(playername + " waves around the magical <b>cinnamon stick</b> and produced <b>" + princessPower.toString() + " peppers </b>.", "random", roomClient, "html");
                    getUser.main[1] += princessPower;
                    updatePlayer(getUser, self, senderId)
                }else if(chooseAbility==2){
                    logToFile("bread stick attackdmg: " + attackdmg[0]);
                    var reduceAttackDmg = randFromRange(0, attackdmg[0]);
                    printMessage(playername + " waves around the glowing <b>bread stick</b> and reduced the attack damage of the monster by <b>" +reduceAttackDmg.toString() + "</b>.", "random", roomClient, "html");
                    attackdmg[0] -= reduceAttackDmg;
                }
                break;
            case "Warrior":
                var attackModi = randFromRange(1, getUser.main[4]);
                if (playerClass[3] == "") playerClass[3] = 0;
                if ((playerClass[3] + attackModi) <= 10) {
                    playerClass[3] += attackModi;
                    printMessage(playername + " executes <b>Pancakes From Above</b> added <b>"+attackModi.toString()+"</b> to the seasoning modifier.", "random", roomClient, "html");
                }
                logToFile("atk dmg before cast: " + attackdmg.toString());
                attackdmg[0] = (attackdmg[0] * getUser.main[4]);
                if (attackdmg[0] >= 100){
                    attackdmg[0] = 100; 
                }
                logToFile("Attack dmg is currently: " + attackdmg[0])
                gainHP = Math.floor(gainHP/playerClass[3]);
                if (gainHP == 0) gainHP = 1;
                getUser.classInfo = playerClass;
                updatePlayer(getUser, self, senderId);
                break;
            default:
                return true;


        }
    }
	return true;
}

function postAttackFunc(playerObj, self, id){
    var self = self;
    var getUser = playerObj;
    if (!getUser.classInfo[3]){
        getUser.classInfo[3] == 0;
    }
    getUser.main[2] = getUser.classInfo[3];
    updatePlayer(getUser, self, id)


}
function logToFile(message){
    console.log(message);
}
function sendRoomMessage(message, room){
	return room.sendNotification(message);
}



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

