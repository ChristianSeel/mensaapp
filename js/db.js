var dbCreated = false;

/*
 *
 * init cache database
 *
 */

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
	tx.executeSql('CREATE TABLE IF NOT EXISTS Mensen (mensaid unique, name, org, country, area, postal, city, address, lastcheck, lastcheck_string, lastcheck_recommendations, coord_lon, coord_lat)');
	tx.executeSql('CREATE TABLE IF NOT EXISTS FavoriteMensen (mensaid unique, isfavorite)');
	tx.executeSql('CREATE TABLE IF NOT EXISTS Meals (mealid unique, datestamp, mensaid, name, label, price, info, recommendations)');
	tx.executeSql('CREATE TABLE IF NOT EXISTS Foodplans (key unique, mensaid, datestamp, trimmings)');
	
	tx.executeSql('INSERT OR IGNORE INTO Settings (key, val) VALUES ("lastupdate", 1)');
	tx.executeSql('INSERT OR IGNORE INTO Settings (key, val) VALUES ("dbVersion", '+requiredDBVersion+')');
	
	DEBUG_MODE && console.log("[DB] db tables are created.");
}


function dropDBTables(tx) {
	tx.executeSql('DROP TABLE IF EXISTS Settings');
	tx.executeSql('DROP TABLE IF EXISTS Mensen');
	tx.executeSql('DROP TABLE IF EXISTS Meals');
	tx.executeSql('DROP TABLE IF EXISTS Foodplans');
	DEBUG_MODE && console.log("[DB] db tables droped.");
	//tx.executeSql('UPDATE Settings SET val = '+requiredDBVersion+' WHERE key = "dbVersion"');
}



/*
 *
 * Check DB version
 * checks stored db version value - used for changes on db scheme
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
		
		if (lastupdate < (getTimestamp()-60*60*24* 30) && networkState==1) doUpdate = true;
		
	} else {
		doUpdate = true;
	}
	
	
	if (doUpdate == true) {
		DEBUG_MODE && console.log("mensen data update needed.");
		$('#busy').fadeIn();
		getMensenFromApi();
		
	} else {
		// data is up to date
		
		// get one favorite mensa and display meals
		db.transaction(function(tx) {
			tx.executeSql('SELECT * FROM FavoriteMensen WHERE isfavorite = 1 ORDER BY mensaid', [], function(tx, results) {
				// success function
	
				var len = results.rows.length;
	
				if (len == 1) {
					var mensa = results.rows.item(0);
					getMenu(mensa.mensaid, getDatestamp(), false);
					$('#speiseplan .skipdayright').removeClass('inactive');
					jQT.goTo( "#speiseplan" ,"slideleft");
				}
	
			}, dbError);
		}, dbError);
		
		// refresh mensen list (distances)
		getMensenFromDB();
		
	}

}






function getMensenFromApi(listabc) {
	
	//$('#busy').fadeIn();
	
	api('getmensen', function(results){
		//success
		
		var len = results.mensen.length;

		if (len > 0) {
			db.transaction(function(tx){
				
				for (var i in results.mensen) {
					var mensa = results.mensen[i];
					
					tx.executeSql('INSERT OR IGNORE INTO Mensen (mensaid) VALUES ('+mensa.mensaid+')');
					tx.executeSql('UPDATE Mensen SET name=?, org=?, country=?, area=?, postal=?, city=?, address=?, lastcheck=?, lastcheck_string=?, lastcheck_recommendations=?, coord_lon=?, coord_lat=? WHERE mensaid='+mensa.mensaid, [mensa.name, mensa.org, mensa.country, mensa.area, mensa.postal, mensa.city, mensa.address, mensa.lastcheck, mensa.lastcheck_string, 0, mensa.coord.lon, mensa.coord.lat]);
					
					tx.executeSql('INSERT OR IGNORE INTO FavoriteMensen (mensaid,isfavorite) VALUES ('+mensa.mensaid+',0)');
				}
				
				tx.executeSql('UPDATE Settings SET val=? WHERE key="lastupdate"', [getTimestamp()]);
				
			}, dbError, function(){
				//success
				DEBUG_MODE && console.log("mensen successfull updated");
				getMensenFromDB(listabc);
			});
		} else {
			DEBUG_MODE && console.log("no mensen returned by api");
			$('#busy').fadeOut();
			$('#blocker').hide();
		}
	  
	}, function(results){
		//fail
		$('#busy').fadeOut();
		$('#blocker').hide();
		DEBUG_MODE && console.log("mensen update failed");
		DEBUG_MODE && console.log(results);
		
		if (results.error.title) {var title = results.error.title + "";} else {var title = "Fehler";}
		if (results.error.description) {var msg = results.error.description + "";} else {var msg = "Die verfügbaren Mensen konnten nicht vom Server abgerufen werden.";}
		
		navigator.notification.alert(
		    msg,  // message
		    alertDismissed,         // callback
		    title,            // title
		    'OK'                  // buttonName
		);
		
	});
		
}


/*
 *
 * Write events from database to dom
 *
 */

function getMensenFromDB(listabc){
	
	if (listabc == undefined)
		listabc = false;
	
	DEBUG_MODE && console.log("requesting mensen from db with "+ listabc);
	
	db.transaction(function(tx) {
	 //   tx.executeSql('SELECT * FROM Mensen ORDER BY org ASC, name ASC' , [],
	    tx.executeSql('SELECT * FROM Mensen LEFT OUTER JOIN FavoriteMensen ON Mensen.mensaid = FavoriteMensen.mensaid ORDER BY org ASC, name ASC' , [],
	    function(tx, results){
	    //success
	    	
			var len = results.rows.length;
			
			if (len == 0) {
				$('#busy').fadeIn();
				getMensenFromApi(listabc);
				return true;
			}
			
			var mensenliste = $('#mensen .content').html('<ul class="mensen"></ul>');
			
			var numberOfFavorites = 0;
			for (var i=0; i<len; i++){
				mensa = results.rows.item(i);
				if (mensa['isfavorite'] == 1) {
					numberOfFavorites++;
					mensenliste.append(mensenListTpl(mensa));
				}
				
				if (i == len-1 && numberOfFavorites > 0) {
					mensenliste.append('<div class="locationspinner"><p class="blanktext"><b>Mensen in der Nähe suchen...</b><br>Bestimme deinen Standort.</p></div>');
					refreshScroll($('#mensen'), false);
					$('#blocker').hide();
					hideSplashscreen();
				}
		    }

			
			if (listabc == false) {
				DEBUG_MODE && console.log("requesting device location...");
				
				// get curren user position
				navigator.geolocation.getCurrentPosition(
					function(position){
					// success
						var geoiplocation = {lat: position.coords.latitude, lon: position.coords.longitude, geoip: "false"};
						listMensenByDistance(results, mensenliste, geoiplocation);
					},
					function(error){
					// error - fallback geoip
						DEBUG_MODE && console.log("could not get native geolocation: "+error.message);
						api('getgeoip',
							function(location){
								var geoiplocation = {lat: location.geoip.lat, lon: location.geoip.lon, geoip: "true"};
								listMensenByDistance(results, mensenliste, geoiplocation);
							},
							function(error){
								DEBUG_MODE && console.log("could not get geoip: "+error.description);
								listMensenByName(results,mensenliste);
							}
						);
					},
					// options
					{
						maximumAge: 5000,
						timeout: 10000,
						enableHighAccuracy: false
					}
				);
				
			} else {
				DEBUG_MODE && console.log("abc listing required");
				listMensenByName(results,mensenliste);
			}
		    
	    }, dbError);
	}, dbError);
}






function listMensenByName(results,mensenliste){

	$('#mensen .navigationbar h1').text("Mensa auswählen");
	mensenliste.find('.locationspinner').remove();
	var len = results.rows.length;
	var listed = 0;
	var last_org = "";
	for (var i=0; i<len; i++){
		if (results.rows.item(i).isfavorite == 1) continue;
		var mensa = results.rows.item(i);
		if (last_org !== mensa.org) {
			mensenliste.append('<div class="square gray"><h3 class="smallinnerwrapper">'+mensa.org+'</h3></div>');
		}
		last_org = mensa.org;
		mensenliste.append(mensenListTpl( mensa ));
		listed++;
		if (i == (len - 1)) {
			refreshScroll($('#mensen'), true);
			$('#busy').fadeOut();
			$('#blocker').hide();
			hideSplashscreen();
			DEBUG_MODE && console.log("Listed "+listed+" Mensen.");
		}
	}
}

function listMensenByDistance(results,mensenliste,location){
	
	$('#mensen .navigationbar h1').text("Mensen in deiner Nähe");
	if (location.geoip == "true") mensenliste.prepend('<div class="square error"><p class="innerwrapper">Wir konnte deinen aktuellen Standort nur ungefähr lokalisieren. Die nachfolgenden Entfernungen sind daher sehr ungenau.</p></div>');
	mensenliste.find('.locationspinner').remove();
	var listed = 0;
	// sort by distance
	var mensen = new Array();
	
	var len = results.rows.length;
	for (var i=0; i<len; i++){
		mensa = results.rows.item(i);
		if (mensa['isfavorite'] == 1) continue;
		
		// calculate distance
		var dx = 111.3 * Math.cos((location.lat + mensa['coord_lat'])/2*0.01745) * (location.lon - mensa['coord_lon']);
		var dy = 111.3 * (location.lat - mensa['coord_lat']);
		mensa['distance'] = roundNumber(Math.sqrt( dx * dx + dy * dy ),2);
	
		mensen.push(mensa);
		
    }
	mensen.sort(function(a,b) {
		return parseFloat(a.distance) - parseFloat(b.distance);
	});
	var mlen = mensen.length;
	for (var i=0; i<mlen; i++){
		if (i > 49 || (mensen[i]['distance'] > 100 && i > 9) || i == (mlen - 1)) {
			mensenliste.append('<div class="square linkToAbc"><div class="innerwrapper"><h3>Alle Mensen anzeigen</h3><p>Zur alphabetischen Liste</p></div></div>');
			refreshScroll($('#mensen'), true);
			$('#busy').fadeOut();
			$('#blocker').hide();
			hideSplashscreen(); // hide dom splashscreen on init
			DEBUG_MODE && console.log("Listed "+listed+" Mensen.");
			return;
		}
		mensenliste.append(mensenListTpl(mensen[i]));
		listed++;
    }
}





function mensenListTpl(data){
	var tpl = "";
	var favoriteclass = "";
	if (data.isfavorite == 1) favoriteclass = " isfavorite";
	tpl += '<div class="square mensa" data-mensaid="'+data.mensaid+'"><span class="addFavorite'+favoriteclass+'"></span><div class="innerwrapper"><h3>'+data.name+'</h3><p><span class="org">'+data.org+'</span><br>';
	if (typeof data.distance !== "undefined") tpl += '<span class="distance">Entfernung: <span class="distance_value">'+data.distance+' km</span></span><br>';
	tpl = tpl.substr(0, tpl.length -4);
	tpl += '</p></div></div>';
	
	return tpl;
}




/*function getMenuDirect(mensaid, datestamp, redirect){
	
	$('#busy').fadeIn();
	
	var speiseplan = $('#speiseplan .content').html('<div class="mealwrapper"></div>');
	
	api('getmeals?mensaid='+mensaid, function(results){
		//success
		//DEBUG_MODE && console.log(results);
		var days = results.days.length;
		
			var found = false;
			for (var i=0; i<results.days.length; i++){
				var foodplan = results.days[i];
				
				if (foodplan.datestamp == datestamp) {
					found = true;
					$('#speiseplan .navigationbar h1').html(foodplan.label);
					
					$('#speiseplan .content').prepend('
						<div class="square"><div class="innerwrapper">
							<h3>'+results.mensa.name+'</h3>
							<p><span class="bold">'+results.mensa.org+'</span><br>Letzte Aktualisierung: '+results.mensa.lastcheck+'</p>
						</div></div>
					');
					
					for (var j=0; j<foodplan.meals.length; j++){
						var meal = foodplan.meals[j];

						//DEBUG_MODE && console.log(meal);
						if (typeof meal.recommendations == "undefined") meal.recommendations = 0;
						meal.recommendations = Math.round(Math.random() * (100 - 1)) + 1;

						speiseplan.append(mealListTpl(meal));
						
						if (j == foodplan.meals.length-1) { // last loop
							$('#busy').fadeOut();
						}
					}
				break;
				}
				
			}
			
		if (found === false) {
			DEBUG_MODE && console.log("no meals returned by api");

			if (redirect === true) setTimeout(jQT.goBack, 500);
			$('#busy').fadeOut();
			navigator.notification.alert(
			    "Keine Speiseplan-Daten gefunden.",  // message
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


}*/







function getMenu(mensaid, datestamp, fetchFromApi) {

	if (fetchFromApi == undefined)
		fetchFromApi = true;

	
	DEBUG_MODE && console.log("reading meals of mensa " + mensaid + " (with datestamp " + datestamp + ")");
	
	if (datestamp == getDatestamp()) $('#speiseplan .skipdayleft').addClass("inactive");
	
	$('#speiseplan .navigationbar h1').text(Datestamp2String(datestamp));
	
	if (!$('#speiseplan .scrollwrapper').hasClass('scrollrefresh')) {
		$('#speiseplan .scrollwrapper').addClass('scrollrefresh');
		var scroll = $('#speiseplan .scrollwrapper').data(KEY_ISCROLL_OBJ);
		scroll.destroy();
		$('#speiseplan .scrollwrapper').data(KEY_ISCROLL_OBJ,null)
	}
	
	$('#speiseplan').data("datestamp",datestamp);
	$('#speiseplan').data("mensaid",mensaid);
	
	if ($('#speiseplan .content .mealwrapper').length) {
		var speiseplan = $('#speiseplan .content .mealwrapper');
	} else {
		var speiseplan = $('<div class="mealwrapper"></div>').appendTo('#speiseplan .content');
	}
	$('#speiseplan .content .blanktext').remove();
	
	if ($('#speiseplan .content .mensawrapper').length) {
		var mensawrapper = $('#speiseplan .content .mensawrapper');
	} else {
		//var mensawrapper = $('#speiseplan .content').prepend('<div class="mensawrapper"></div>');
		var mensawrapper = $('<div class="mensawrapper"></div>').prependTo('#speiseplan .content')
	}
	
	speiseplan.fadeOut(100,function(){
		$(this).html("")
	
		// db request mensa
		db.transaction(function(tx) {
			tx.executeSql('SELECT * FROM Mensen WHERE mensaid = ' + mensaid + '', [], function(tx, results) {
				// success function
	
				var mensalen = results.rows.length;
	
				if (mensalen == 1) {
					var mensa = results.rows.item(0);
					mensawrapper.html('<div class="square mensainfo"><div class="innerwrapper"><h3>' + mensa.name + '</h3><p><span class="org bold">'+mensa.org+'</span><br><span class="lastcheck">Letzte Aktualisierung: '+mensa.lastcheck_string+'</span></p></div></div>');
					
					if (fetchFromApi === true && mensa.lastcheck < (getTimestamp()-(60*60*24)) && networkState==1) {
						DEBUG_MODE && console.log("foodplan older than 24h -> get new foodplan from api");
						$('#busy').fadeIn('fast');
						getMealsFromApi(mensaid, datestamp);
						return;
					}
					
					var lastcheck_recommendations = mensa.lastcheck_recommendations;
		    		DEBUG_MODE && console.log("last check for recommendations on "+lastcheck_recommendations);
					
				}
				
				
				
				// db request foodplan
				db.transaction(function(tx) {
				    tx.executeSql('SELECT * FROM Foodplans WHERE mensaid = ' + mensaid + ' AND datestamp = "' + datestamp + '"' , [], function(tx, results) {
				    	// success function
				
				    	var len = results.rows.length;
				    	var foodplan = null;
				    	
				    	if (len == 1) {
				    		
				    		foodplan = results.rows.item(0);
				    		
				    		if (foodplan.trimmings != null && foodplan.trimmings != "undefined" && typeof foodplan.trimmings != "undefined") {
					    		var trimmings = jQuery.parseJSON( foodplan.trimmings );
					    		var tlen = trimmings.length;
					    		
					    		for (var j=0; j<tlen; j++){
					    			speiseplan.append(trimmingListTpl(trimmings[j]));
					    		}
				    		}
				    	
				    	}
				    	
				    	
						// db request meals
						db.transaction(function(tx) {
							tx.executeSql('SELECT * FROM Meals WHERE mensaid = ' + mensaid + ' AND datestamp = "' + datestamp + '" ORDER BY recommendations ASC, label DESC, mealid DESC', [], function(tx, results) {
								// success function
					
								var len = results.rows.length;
								DEBUG_MODE && console.log(len + " meals found");
								
								if (len == 0) {
									if (foodplan === null && fetchFromApi === true && networkState == 1) {
										$('#busy').fadeIn('fast');
										getMealsFromApi(mensaid, datestamp);
										return;
									} else {
										DEBUG_MODE && console.log("no meals found");
										$('#busy').fadeOut();
										$('#blocker').hide();
										speiseplan.append('<p class="blanktext">Für diesen Tag stehen (noch) keine Speiseplandaten zur Verfügung.</p>');
										speiseplan.fadeIn('fast');
										refreshScroll($('#speiseplan'),true);
									/*	navigator.notification.alert("Für diese Mensa stehen im Moment keine Speiseplandaten zur Verfügung.", // message
										alertDismissed, // callback
										"Fehler", // title
										'OK' // buttonName
										);
									*/
										return;
									}
								}
					
					
					    		if (lastcheck_recommendations < (getTimestamp() - recommendations_refresh_interval) && fetchFromApi == true && networkState==1) {
									getRecommendationsFromApi(mensaid, datestamp);
								} 
					
					
								for (var i = 0; i < len; i++) {
									meal = results.rows.item(i);
									speiseplan.prepend(mealListTpl(meal));
					
									if (i == len - 1) { // last loop
									
										speiseplan.fadeIn(150);
					    				refreshScroll($('#speiseplan'),true);
					    				$('#busy').fadeOut();
										$('#blocker').hide();
									}
								}
					
							}, dbError);
						}, dbError); // db request meals

				
				    }, dbError);
				}, dbError); // db request foodplan


			}, dbError);
		}, dbError);
	
	});
}



function mealListTpl(data){
	var tpl = '<div class="square meal" data-mealid="'+data.mealid+'">';
	
	if (typeof data.info !== "undefined" && data.info !== "undefined" && data.info !== "") tpl += '<span class="infoIcon"></span><p class="info blanktext">Infos: '+data.info+'</p>';
	
	tpl += '<div class="innerwrapper">';
	if (typeof data.label !== "undefined" && data.label !== "undefined" && data.label !== "") tpl += '<p><span class="label">'+data.label+'</span></p>';
	
	tpl += '<h2>'+data.name+' </h2><p>';
	
	
	if (typeof data.price !== "undefined" && data.price !== "undefined" && data.price !== "") {
		var price = jQuery.parseJSON( data.price );
		tpl += '<span class="price">';
			for (p in price) {
				tpl += p + ': '+ price[p] + ' | ';
			}
			tpl = tpl.substr(0, tpl.length -3);
		tpl +='</span><br>';
	}
	
	tpl = tpl.substr(0, tpl.length -4);
	
	tpl += '</p></div><p class="recommendations"><span class="value">'+data.recommendations+'</span> Personen empfehlen dieses Gericht.</p></div>';
	
	return tpl;
}


function trimmingListTpl(data){
	var tpl = '<div class="square trimming"><div class="innerwrapper">';
	
	if (typeof data.label !== "undefined" && data.label !== "undefined" && data.label !== "") tpl += '<p class="label bold">'+data.label+'</p>';
	
	for (var i = 0; i < data.meals.length; i++) {
		var trimming = data.meals[i];
		tpl += '<h3>'+trimming.name+' </h3>';
		
		if (typeof trimming.price !== "undefined" && trimming.price !== "undefined" && trimming.price !== "") {
			//var price = jQuery.parseJSON( data.price );
			tpl += '<p class="price">';
				for (p in trimming.price) {
					tpl += p + ': '+ trimming.price[p] + ' | ';
				}
				tpl = tpl.substr(0, tpl.length -3);
			tpl +='</p>';
		}
		
		if (typeof trimming.info !== "undefined" && trimming.info !== "undefined" && trimming.info !== "") tpl += '<p class="info">Infos: '+trimming.info+'</p>';
	}
	
	tpl += '</div></div>';
	
	return tpl;
}


/*
function getRecommendationsFromApi(mensaid, datestamp) {

	DEBUG_MODE && console.log("fetching recommendations of mensa " + mensaid + " from api");
	
	api('getrecommendations?mensaid=' + mensaid, function(results) {
		//success

		db.transaction(function(tx) {
			
			// update lastcheck value
			tx.executeSql('UPDATE Mensen SET lastcheck_recommendations=? WHERE mensaid = ' + mensaid, [getTimestamp()]);
			
			for (var i = 0; i < results.meals.length; i++) {
				var meal = results.meals[i];
				
				// debug: add random recommendations
				if (DEBUG_MODE && meal.recommendations == 0) meal.recommendations = Math.round(Math.random() * (100 - 1)) + 100;
				
				// insert recommendations
				tx.executeSql('INSERT OR IGNORE INTO Meals (mealid) VALUES (' + meal.mealid + ')');
				tx.executeSql('UPDATE Meals SET recommendations=? WHERE mealid = ' + meal.mealid, [meal.recommendations]);
				
				
			}

		}, dbError, function() {
			//success
			DEBUG_MODE && console.log("recommendations successfull updated");
			getMenu(mensaid, datestamp, false);
		});

	}, function(results) {
		//fail
		DEBUG_MODE && console.log("recommendations update failed");
		DEBUG_MODE && console.log(results);
		
		// continue with display menu, even if recommendations couldn't be loaded
		getMenu(mensaid, datestamp, false);
		
		if (results.error.title) {
			var title = results.error.title + "";
		} else {
			var title = "Fehler";
		}
		if (results.error.description) {
			var msg = results.error.description + "";
		} else {
			var msg = "Es ist ein unbekannter Fehler aufgetreten.";
		}

		navigator.notification.alert(msg, // message
		alertDismissed, // callback
		title, // title
		'OK' // buttonName
		);

	});
}
*/


function getRecommendationsFromApi(mensaid, datestamp) {

	DEBUG_MODE && console.log("fetching recommendations and meals of mensa " + mensaid + " from api");
	
	api('getmeals?mensaid=' + mensaid, function(results) {
		//success
		var days = results.days.length;

		db.transaction(function(tx) {
			
			// update lastcheck value
			tx.executeSql('UPDATE Mensen SET lastcheck=?, lastcheck_string=?, lastcheck_recommendations=? WHERE mensaid = ' + mensaid, [results.mensa.lastcheck, results.mensa.lastcheck_string, getTimestamp()]);
			
			// remove old meals and inser new ones
			tx.executeSql('DELETE FROM Meals WHERE mensaid = ' + mensaid + ' AND datestamp = "' + datestamp + '"');
			
			for (var i = 0; i < results.days.length; i++) {
				var foodplan = results.days[i];
				
				// foodplan
				foodplan.trimmings = JSON.stringify(foodplan.trimmings);
				tx.executeSql('INSERT OR IGNORE INTO Foodplans (key) VALUES ("' + mensaid + '-' + foodplan.datestamp + '")');
				tx.executeSql('UPDATE Foodplans SET mensaid=?, datestamp=?, trimmings=? WHERE key = "' + mensaid + '-' + foodplan.datestamp + '"', [mensaid, foodplan.datestamp, foodplan.trimmings]);
	
				// meals
				for (var j = 0; j < foodplan.meals.length; j++) {
					var meal = foodplan.meals[j];
					
					if ( typeof meal.label == "undefined")
						meal.label = "";
						
					if ( typeof meal.info == "undefined")
						meal.info = "";
					
					if ( typeof meal.name == "undefined")
						meal.name = "";
					
					meal.price = JSON.stringify(meal.price);
						
					if ( typeof meal.recommendations == "undefined") {
						meal.recommendations = 0;
					}
					//if (DEBUG_MODE)  meal.recommendations = Math.round(Math.random() * (100 - 1));

					tx.executeSql('INSERT OR IGNORE INTO Meals (mealid) VALUES (' + meal.mealid + ')');
					tx.executeSql('UPDATE Meals SET datestamp=?, mensaid=?, name=?, label=?, price=?, info=?, recommendations=? WHERE mealid=' + meal.mealid, [foodplan.datestamp, mensaid, meal.name, meal.label, meal.price, meal.info, meal.recommendations]);
					
					$('[data-mealid="'+meal.mealid+'"] .recommendations .value').text(meal.recommendations);
				}
			}

		}, dbError, function() {
			//success
			DEBUG_MODE && console.log("recommendations and meals successfull updated");
		});

	}, function(results) {
		//fail
		DEBUG_MODE && console.log("recommendations and meals update failed");
		DEBUG_MODE && console.log(results);
	});

}




function getMealsFromApi(mensaid, datestamp) {

	DEBUG_MODE && console.log("fetching meals of mensa " + mensaid + " from api");
	
	api('getmeals?mensaid=' + mensaid, function(results) {
		//success
		var days = results.days.length;

		db.transaction(function(tx) {
			
			// update lastcheck value
			tx.executeSql('UPDATE Mensen SET lastcheck=?, lastcheck_string=?, lastcheck_recommendations=? WHERE mensaid = ' + mensaid, [results.mensa.lastcheck, results.mensa.lastcheck_string, getTimestamp()]);
			
			// remove old meals and inser new ones
			tx.executeSql('DELETE FROM Meals WHERE mensaid = ' + mensaid + ' AND datestamp = "' + datestamp + '"');
			
			for (var i = 0; i < results.days.length; i++) {
				var foodplan = results.days[i];
				
				// foodplan
				foodplan.trimmings = JSON.stringify(foodplan.trimmings);
				tx.executeSql('INSERT OR IGNORE INTO Foodplans (key) VALUES ("' + mensaid + '-' + foodplan.datestamp + '")');
				tx.executeSql('UPDATE Foodplans SET mensaid=?, datestamp=?, trimmings=? WHERE key = "' + mensaid + '-' + foodplan.datestamp + '"', [mensaid, foodplan.datestamp, foodplan.trimmings]);
	
				// meals
				for (var j = 0; j < foodplan.meals.length; j++) {
					var meal = foodplan.meals[j];
					
					if ( typeof meal.label == "undefined")
						meal.label = "";
						
					if ( typeof meal.info == "undefined")
						meal.info = "";
					
					if ( typeof meal.name == "undefined")
						meal.name = "";
					
					meal.price = JSON.stringify(meal.price);
						
					if ( typeof meal.recommendations == "undefined") {
						meal.recommendations = 0;
						//meal.recommendations = Math.round(Math.random() * (100 - 1)) + 100;
					}

					tx.executeSql('INSERT OR IGNORE INTO Meals (mealid) VALUES (' + meal.mealid + ')');
					tx.executeSql('UPDATE Meals SET datestamp=?, mensaid=?, name=?, label=?, price=?, info=?, recommendations=? WHERE mealid=' + meal.mealid, [foodplan.datestamp, mensaid, meal.name, meal.label, meal.price, meal.info, meal.recommendations]);
				}
			}

		}, dbError, function() {
			//success
			DEBUG_MODE && console.log("meals successfull updated");
			getMenu(mensaid, datestamp, false);
		});

	}, function(results) {
		//fail
		DEBUG_MODE && console.log("meals update failed");
		DEBUG_MODE && console.log(results);
		$('#busy').fadeOut();
		$('#blocker').hide();
		
		if (results.error.title) {
			var title = results.error.title + "";
		} else {
			var title = "Fehler";
		}
		if (results.error.description) {
			var msg = results.error.description + "";
		} else {
			var msg = "Es ist ein unbekannter Fehler aufgetreten.";
		}
		
		if (results.error.key == "no_meals") $('#speiseplan .content .mealwrapper').append('<p class="blanktext">'+msg+'</p>').fadeIn(150);

		navigator.notification.alert(msg, // message
		alertDismissed, // callback
		title, // title
		'OK' // buttonName
		);

	});

}





function cleanDB(){
	DEBUG_MODE && console.log("[DB] Cleaning");
	//nextdatestamp = getDatestamp(AddDays(Datestamp2Date(getDatestamp()),7));
	nextdatestamp = getDatestamp();
	console.log("[DB] Cleaning Meals older than "+nextdatestamp);
	
	db.transaction(function(tx) {
		tx.executeSql('DELETE FROM Meals WHERE datestamp < "' + nextdatestamp + '"');
		tx.executeSql('DELETE FROM Foodplans WHERE datestamp < "' + nextdatestamp + '"');
	});
	
}











function pullDownAction (scroll,$wrapper) {

			$('#blocker').show(); //block UI during request
			switch ($wrapper.parent().attr('id')) {
			
			case "speiseplan":
				getMealsFromApi($('#speiseplan').data('mensaid'), $('#speiseplan').data('datestamp'));
				break;
			
			
			case "mensen":
				getMensenFromApi();
				break;
			
			
			default:
			/*	setTimeout(function () {	// <-- Simulate network congestion, remove setTimeout from production!
					alert('yeah! 42!');
				//	scroll.refresh();		// Remember to refresh when contents are loaded (ie: on ajax completion)
					$('#blocker').hide(); //block UI during request
				}, 1500);	// <-- Simulate network congestion, remove setTimeout from production!
			*/
				break;
			}
				
}
		