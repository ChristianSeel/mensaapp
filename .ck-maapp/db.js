var dbCreated = false;

function initDB(){
	// open database
	db = window.openDatabase("mensaappcache", "1.0", "App Cache", 5 * 1024 * 1024);
	
	// create tables if they don't exist
	db.transaction(createDBTables, dbError, function(){
		// success function
		dbCreated = true;
		
		db.transaction(getDBversion, dbError);
	});

}



/*
 *
 * handle database errors
 *
 */

function dbError(error) {
	DEBUG_MODE && console.log("[DB] database error: "+error.code+ " ("+error.message+")");
	$('#busy').fadeOut();
	alert("Internal Error: " + error.message);
}



/*
 *
 * Create or drop db tables
 *
 */

function createDBTables(tx) {
		
	tx.executeSql('CREATE TABLE IF NOT EXISTS Settings (key unique, val)');
	tx.executeSql('CREATE TABLE IF NOT EXISTS Mensen (mensaid unique, name, org, country, area, postal, city, address, lastcheck, coord_lon, coord_lat, isfavorite)');
	tx.executeSql('CREATE TABLE IF NOT EXISTS Meals (mealid unique, datestamp, mensaid, name, label, price, info, recommendations)');
	
	tx.executeSql('INSERT OR IGNORE INTO Settings (key, val) VALUES ("lastupdate", 1)');
	tx.executeSql('INSERT OR IGNORE INTO Settings (key, val) VALUES ("dbVersion", '+requiredDBVersion+')');
	
	DEBUG_MODE && console.log("[DB] db tables are created.");
}


function dropDBTables(tx) {
	//tx.executeSql('DROP TABLE IF EXISTS Settings'); DO NOT DROP Settings, since there are some user values!
	tx.executeSql('DROP TABLE IF EXISTS Mensen');
	tx.executeSql('DROP TABLE IF EXISTS Meals');
	DEBUG_MODE && console.log("[DB] db tables droped.");
	tx.executeSql('UPDATE Settings SET val = '+requiredDBVersion+' WHERE key = "dbVersion"');
}



/*
 *
 * Check DB version
 *
 */
function getDBversion(tx) {
    tx.executeSql('SELECT * FROM Settings WHERE key = "dbVersion"', [], checkDBversion, dbError);
}

function checkDBversion(tx, results) {

	var currentVersion = results.rows.item(0).val;
	DEBUG_MODE && console.log("current db version: "+currentVersion);
	
	if (currentVersion != requiredDBVersion) {
		// app db version is not as expected -> recreate db
		DEBUG_MODE && console.log("db version not same as required.");
		dbCreated = false;
		
		db.transaction(dropDBTables, dbError, function(){
			// success function
			initDB();
		});
		
	} else {
		
		db.transaction(getLastUpdate, dbError);
		
	}
}



/*
 *
 * Check for last data update
 *
 */

function getLastUpdate(tx) {
    tx.executeSql('SELECT * FROM Settings WHERE key = "lastupdate"', [], checkLastUpdate, dbError);
}

function checkLastUpdate(tx, results) {

	var lastupdate = results.rows.item(0).val;
	var doUpdate = false;
	
	if (lastupdate != 1) {
		var lu_date = new Date(lastupdate*1000);
		DEBUG_MODE && console.log("last update on: " + lu_date.getDate() + "." + (lu_date.getMonth()+1) + "." + lu_date.getFullYear() + " " + lu_date.getHours() + ":" + lu_date.getMinutes() + ":" + lu_date.getSeconds() );
		
		if (lastupdate < (getTimestamp()-60*60*24* 30)) doUpdate = true;
		
	} else {
		doUpdate = true;
	}
	
	
	if (doUpdate == true) {
		DEBUG_MODE && console.log("full data update needed.");
		
		getMensenFromApi(function(){hideSplashscreen();});
		
	} else {
		// data is up to date
		getMensenFromDB(function(){hideSplashscreen();});
		
	}

}






function getMensenFromApi(cb) {
	
	if (cb == null) cb = function(){};
	
	api('getmensen', function(results){
		//success
		
		var len = results.mensen.length;

		if (len > 0) {
			db.transaction(function(tx){
				
				for (var i in results.mensen) {
					var mensa = results.mensen[i];
					
					tx.executeSql('INSERT OR IGNORE INTO Mensen (mensaid) VALUES ('+mensa.mensaid+')');
					tx.executeSql('UPDATE Mensen SET name=?, org=?, country=?, area=?, city=?, lastcheck=?, coord_lon=?, coord_lat=? WHERE mensaid='+mensa.mensaid, [mensa.name, mensa.org, mensa.country, mensa.area, mensa.city, mensa.lastcheck, mensa.coord.lon, mensa.coord.lat]);
				}
				
			}, dbError, function(){
				//success
				getMensenFromDB(cb);
				DEBUG_MODE && console.log("mensen successfull updated");
			});
		} else {
			DEBUG_MODE && console.log("no mensen returned by api");
			cb();
		}
	  
	}, function(results){
		//fail
		DEBUG_MODE && console.log("mensen update failed");
		DEBUG_MODE && console.log(results);
		
		cb();
		
		if (results.error.title) {var title = results.error.title + "";} else {var title = "Fehler";}
		if (results.error.description) {var msg = results.error.description + "";} else {var msg = "Es ist ein unbekannter Fehler aufgetreten.";}
		
		navigator.notification.alert(
		    msg,  // message
		    alertDismissed,         // callback
		    title,            // title
		    'OK'                  // buttonName
		);
		
	});
		
}



function getMensenFromDB(cb){
	if (cb == null) cb = function(){};
	db.transaction(getMensen, dbError);
	
	setTimeout(function(){cb();}, 350);
}


/*
 *
 * Write events from database to dom
 *
 */

function getMensen(tx) {
    tx.executeSql('SELECT * FROM Mensen ORDER BY org ASC' , [], writeMensen, dbError);
}

function writeMensen(tx, results) {
	var len = results.rows.length;
	
	if (len == 0) {
		getMensenFromApi();
		return true;
	}
	
	// get curren user position
	api('getgeoip',
	
		function(location){
			var mensenliste = $('#mensen .content').html('<ul class="mensen"></ul>');
			// sort by distance
			var mensen = new Array();
			for (var i=0; i<len; i++){
				mensa = results.rows.item(i);
				//mensen[i]['distance'] = Math.sqrt( squareit(location.geoip.lon - mensen[i]['coord_lon']) + squareit(location.geoip.lat - mensen[i]['coord_lat']) );
				var dx = 111.3 * Math.cos((location.geoip.lat + mensa['coord_lat'])/2*0.01745) * (location.geoip.lon - mensa['coord_lon']);
				var dy = 111.3 * (location.geoip.lat - mensa['coord_lat']);
				mensa['distance'] = roundNumber(Math.sqrt( dx * dx + dy * dy ),2);
				if (mensa['isfavorite'] == 1) {
					mensenliste.append(mensenListTpl(mensa));
				} else {
					mensen.push(mensa);
				}
		    }
			mensen.sort(function(a,b) {
				return parseFloat(a.distance) - parseFloat(b.distance);
			});
			var mlen = mensen.length;
			for (var i=0; i<mlen; i++){
				if (i > 100 || (mensen[i]['distance'] > 150 && i > 25) || i == (mlen - 1)) {
					mensenliste.append('
						<div class="square" class="linkToAbc">
							<div class="innerwrapper">
								<h3>Alle Mensen anzeigen</h3>
								<p>Zur alphabetischen Liste</p>
							</div>
						</div>
					');
					refreshScroll($('#mensen'));
					return;
				}
				mensenliste.append(mensenListTpl(mensen[i]));
		    }
		       
		},
		
		function(error){
			$('#mensen .scrollpanel').html('<ul class="mensen"></ul>');
			// abc
		    for (var i=0; i<len; i++){
				$('#mensen .scrollpanel ul.mensen').append(mensenListTpl(results.rows.item(i)));
				if (i == (len - 1)) refreshScroll($('#mensen'));
		    }
		}
	);
	
	
    

}

function mensenListTpl(data){
	var tpl = "";
	var favoriteclass = "";
	if (data.isfavorite == 1) favoriteclass = " isfavorite";
	tpl += '
			<div class="square mensa" data-mensaid="'+data.mensaid+'">
				<span class="addFavorite'+favoriteclass+'"></span>
				<div class="innerwrapper">
					<h3>'+data.name+'</h3>
					<p><span class="org">'+data.org+'</span><br>
		';
	if (typeof data.distance !== "undefined") tpl += '<span class="distance">Entfernung: <span class="distance_value">'+data.distance+' km</span></span><br>';
	tpl = tpl.substr(0, tpl.length -4);
	tpl += '</p>
				</div>
			</div>
			';
	
	return tpl;
}

function getSingleMensa(mensaid){
	
	// db request
	db.transaction(function(tx){
		tx.executeSql('SELECT * FROM Mensen WHERE mensaid = '+mensaid , [],
			function(tx, results) {
			// success function
			
				var len = results.rows.length;
				
				if (len == 0) {
					getMealsFromApi(mensaid);
					return;
				}
				
				var speiseplan = $('#speiseplan .content').html('<div class="mealwrapper"></div>');
				
				speiseplan.prepend(mealListTpl(meal));
				
				for (var i=0; i<len; i++){
					meal = results.rows.item(i);
					speiseplan.append(mealListTpl(meal));
			    }
				
				
				
			}, dbError);
	}, dbError);
}




/*

function getMenu(mensaid, datestamp){
	
	$('#busy').fadeIn('fast');
	console.log("reading meals of mensa "+mensaid);
	
	// db request
	db.transaction(function(tx){
		tx.executeSql('SELECT * FROM Meals WHERE mensaid = '+mensaid+' AND datestamp = "'+datestamp+'" ORDER BY recommendations DESC' , [],
			function(tx, results) {
			// success function
			
				var len = results.rows.length;
				
				if (len == 0) {
					getMealsFromApi(mensaid);
					return;
				}
				
				var speiseplan = $('#speiseplan .content').html('<div class="mealwrapper"></div>');
				
				//speiseplan.prepend(mealListTpl(meal));
				
				for (var i=0; i<len; i++){
					meal = results.rows.item(i);
					speiseplan.append(mealListTpl(meal));
					if(i == len-1) $('#busy').fadeOut();
			    }
			    
				
				
				
			}, dbError);
	}, dbError);
}


function getMealsFromApi(mensaid){
	
	api('getmeals?mensaid='+mensaid, function(results){
		//success
		//DEBUG_MODE && console.log(results);
		var days = results.days.length;
		
		if (days > 0) {
			db.transaction(function(tx){
				
				for (var i=0; i<results.days.length; i++){
					var foodplan = results.days[i];
					
					for (var j=0; j<foodplan.meals.length; j++){
						var meal = foodplan.meals[j];
						
						if (typeof meal.price !== "undefined") meal.price = new String(meal.price);
						if (typeof meal.recommendations == "undefined") meal.recommendations = 0;
						meal.recommendations = (Math.random() * (100 - 1)) + 100;
						tx.executeSql('INSERT OR IGNORE INTO Meals (mealid) VALUES ('+meal.mealid+')');
						tx.executeSql('UPDATE Meals SET datestamp=?, mensaid=?, name=?, label=?, price=?, info=?, recommendations=? WHERE mealid='+meal.mealid, [foodplan.datestamp, mensaid, meal.name, meal.label, meal.price, meal.info, meal.recommendations]);
					}
				}
				
			}, dbError, function(){
				//success
				getMenu(mensaid); // endlosscheife wenn geforderten daten nicht in der api waren..
				DEBUG_MODE && console.log("meals successfull updated");
			});
		} else {
			DEBUG_MODE && console.log("no meals returned by api");
			$('#busy').fadeOut();
			navigator.notification.alert(
			    "Für diese Mensa stehen im Moment keine Speiseplandaten zur Verfügung.",  // message
			    alertDismissed,         // callback
			    "Fehler",            // title
			    'OK'                  // buttonName
			);
			return false;
		}
	  
	}, function(results){
		//fail
		DEBUG_MODE && console.log("meals update failed");
		DEBUG_MODE && console.log(results);
		$('#busy').fadeOut();
		
		if (results.error.title) {var title = results.error.title + "";} else {var title = "Fehler";}
		if (results.error.description) {var msg = results.error.description + "";} else {var msg = "Es ist ein unbekannter Fehler aufgetreten.";}
		
		navigator.notification.alert(
		    msg,  // message
		    alertDismissed,         // callback
		    title,            // title
		    'OK'                  // buttonName
		);
		
	});
		
}

function mealListTpl(data){
	var tpl = '<div class="square meal" data-mealid="'+data.mealid+'">
				<div class="innerwrapper">
				<h3>'+data.name+'</h3>
				<p>';
	if (data.label !== "undefined") tpl += '<span class="label">'+data.label+'</span><br>';
	
	if (data.price !== "undefined") {
		data.price = jQuery.parseJSON(data.price);
		tpl += '<span class="price">';
			for (p in data.price) {
				tpl += p + ': '+ data.price[p] + ' | ';
			}
			tpl = tpl.substr(0, tpl.length -3);
		tpl +='</span><br>';
	}
	
	if (data.info !== "undefined") tpl += '<span class="info">'+data.info+'</span><br>';
	
	tpl = tpl.substr(0, tpl.length -4);
	
	tpl += '
					</p>
				</div>
			</div>
			';
	
	return tpl;
}


*/













function pullDownAction (scroll,$wrapper) {
			
			if ($wrapper.parent().attr('id') == 'events') {
				getEventsFromApi();
				
			} else {
				setTimeout(function () {	// <-- Simulate network congestion, remove setTimeout from production!
						
					alert('yeah! 42!');
						
					scroll.refresh();		// Remember to refresh when contents are loaded (ie: on ajax completion)
				}, 1500);	// <-- Simulate network congestion, remove setTimeout from production!
			}
				
}
		