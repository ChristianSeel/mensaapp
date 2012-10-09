/*
 *
 * init cache (lawnchair)
 *
 */

function initCache(){
	
	cache.mensen = Lawnchair({name:'mensen'},function(e){
		console.log('mensen storage opened');
		this.save({key:"1",value:"mensen"});
	});
	
	
	cache.favoritemensen = Lawnchair({name:'favoritemensen'},function(e){
		console.log('favoritemensen storage opened');
		this.save({key:"1",value:"favoritemensen"});
	});
	
	cache.settings = Lawnchair({name:'settings'},function(e){
		console.log('settings storage opened');
		this.save({key:"1",value:"settings"});
	});
	
	cache.meals = Lawnchair({name:'meals'},function(e){
		console.log('meals storage opened');
		this.save({key:"1",value:"meals"});
	});
	
	
	cache.settings.exists('lastupdate_mensen', function(exists) {
		if (!exists) {
			cache.settings.save({key:"lastupdate_mensen",value:"0"});
			refreshMensen();
		} else {
			cache.settings.get("lastupdate_mensen",function(result){
				DEBUG_MODE && console.log("lastupdate for mensen was on: "+result.value);
				if (result.value < (getTimestamp() - 60*60*24 * 14)) {
					refreshMensen();
				} else {
					mensen2dom();
				}
			});
		}
    });
}



/*
 *
 * handle database errors
 *
 */

function cacheError(error) {
	DEBUG_MODE && console.log("[Cache] cache error: "+error.message);
	$('#busy').fadeOut();
	alert("Error: " + error.message);
}


/*
 * required objects
 */

var mensaobj = ['mensaid','name','org','country','area','postal','city','address','lastcheck','lastcheck_string','coord','checkinid'];
var mealobj = ['mealid','name','label','price','info','recommendations'];






function refreshMensen(listcitys) {
	
	api('getmensen', function(results){
		//success
		
		var len = results.mensen.length;

		if (len > 0) {
				
				for (var i in results.mensen) {
					var mensa = results.mensen[i];
					
					for (var k=0;k<mensaobj.length;k++) {
						key = mensaobj[k];
						if (typeof mensa[key] == "undefined") {
							//DEBUG_MODE && console.log(key + " is undefined for mensa " + mensa.mensaid);
							mensa[key] = "";
						}
					}
					
					mensa['lastcheck_recommendations'] = 0;
					
					cache.mensen.save({key:mensa.mensaid,value:mensa});
					
					cache.favoritemensen.exists(mensa.mensaid, function(exists) {
						if (!exists) cache.favoritemensen.save({key:mensa.mensaid,value:"0"});
				    });				
				    
				    
				    // last loop
				    if (i == len-1) {
					    cache.settings.save({key:'lastupdate_mensen',value: getTimestamp()});
					    mensen2dom(listcitys);
				    }
				}
				
				
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
 * Write events from cache to dom
 *
 */

function mensen2dom(listcitiys,city){
	if (typeof listcitys == "undefined") listcitys = false;
	if (typeof city == "undefined") city = false;
}

function getMensenFromDB(listcitys,city){
	
	if (typeof listcitys == "undefined") listcitys = false;
	if (typeof city == "undefined") city = false;
	
	DEBUG_MODE && console.log("requesting mensen from db with listcitys: "+ listcitys);
	
	var wherec = "";
	if (typeof city != "undefined" && city !== false) wherec = 'WHERE Mensen.city = "'+city+'" ';
	if (listcitys && !city) {groupbyc = 'GROUP BY Mensen.city ORDER BY city ASC, name ASC ';} else if (listcitys) {groupbyc = 'ORDER BY name ASC'} else {groupbyc = 'ORDER BY org ASC, name ASC'}
	var query = 'SELECT * FROM Mensen LEFT OUTER JOIN FavoriteMensen ON Mensen.mensaid = FavoriteMensen.mensaid '+wherec+groupbyc+'';
	console.log(query);
	
	db.transaction(function(tx) {
	 //   tx.executeSql('SELECT * FROM Mensen ORDER BY org ASC, name ASC' , [],
	    tx.executeSql(query , [],
	    function(tx, results){
	    //success

			var len = results.rows.length;
			
			if (len == 0) {
				$('#busy').fadeIn();
				getMensenFromApi(listcitys);
				return true;
			}
			DEBUG_MODE && console.log(len + " Mensen von DB erhalten.");
			
			var mensenliste = $('#mensen .content').html('<ul class="mensen"></ul>');
			
			var numberOfFavorites = 0;
			
			if (listcitys == false) {
				for (var i=0; i<len; i++){
					mensa = results.rows.item(i);
					if (mensa['isfavorite'] == 1) {
						numberOfFavorites++;
						mensenliste.append(mensenListTpl(mensa));
					}
					
					if (i == len-1 && numberOfFavorites > 0) {
						mensenliste.append('<div class="smallspinner"><p class="blanktext"><b>Mensen in der Nähe suchen...</b><br>Bestimme deinen Standort.</p></div>');
						refreshScroll($('#mensen'), false);
						$('#blocker').hide();
						hideSplashscreen();
					}
			    }
			
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
								listMensenByOrg(results,mensenliste, true, false);
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
				DEBUG_MODE && console.log("city listing required");
				listMensenByOrg(results,mensenliste, listcitys, city);
			}
		    
	    }, dbError);
	}, dbError);
}






function listMensenByOrg(results,mensenliste, listcitys, city){

	$('#mensen .getlocation').show();
	mensenliste.find('.smallspinner').remove();
	
	if (city) {
		mensenliste.append('<div class="square gray"><h3 class="smallinnerwrapper">'+city+'</h3></div>');
		$('#mensen .navigationbar h1').text("Mensa auswählen");
		$('#mensen .mensagoback').unbind("click").bind("click",function(){
			getMensenFromDB(true,false)
		}).show();
	} else {
		$('#mensen .navigationbar h1').text("Stadt auswählen");
		$('#mensen .mensagoback').hide();
	}
		
	var len = results.rows.length;
	for (var i=0; i<len; i++){
		//if (results.rows.item(i).isfavorite == 1) continue;
		var mensa = results.rows.item(i);
		
		if (!city) {
			mensenliste.append('<div class="square cityselector" data-city="'+mensa.city+'"><h3 class="innerwrapper">'+mensa.city+'</h3></div>');
		} else {
			mensenliste.append(mensenListTpl( mensa ));
		}
		

		if (i == (len - 1)) {
		
			if (!city) mensenliste.append('<a href="mailto:support@mensaapp.de?subject='+ encodeURIComponent('Fehlende Mensa [MA1]') +'" class="bold button">Fehlt deine Mensa? Feedback senden!</a>');
			refreshScroll($('#mensen'), true);
			$('#busy').fadeOut();
			$('#blocker').hide();
			hideSplashscreen();
		}
	}
}

function listMensenByDistance(results,mensenliste,location){
	
	$('#mensen .getlocation').hide();
	$('#mensen .mensagoback').hide();
	$('#mensen .navigationbar h1').text("Mensen in deiner Nähe");
	if (location.geoip == "true") mensenliste.prepend('<div class="square error"><p class="innerwrapper">Wir konnte deinen aktuellen Standort nur ungefähr lokalisieren. Die nachfolgenden Entfernungen sind daher sehr ungenau.</p></div>');
	mensenliste.find('.smallspinner').remove();
	var listed = 0;
	// sort by distance
	var mensen = new Array();
	
	var len = results.rows.length;
	for (var i=0; i<len; i++){
		mensa = results.rows.item(i);
		if (mensa['isfavorite'] == 1) continue;
		
		// calculate distance
		//var dx = 111.3 * Math.cos((location.lat + mensa['coord_lat'])/2*0.01745) * (location.lon - mensa['coord_lon']);
		//var dy = 111.3 * (location.lat - mensa['coord_lat']);
		//mensa['distance'] = roundNumber(Math.sqrt( dx * dx + dy * dy ),2);
		mensa['distance'] = calculateDistance({lat:mensa['coord_lat'],lon:mensa['coord_lon']}, {lat:location.lat,lon:location.lon});
	
		mensen.push(mensa);
		
    }
	mensen.sort(function(a,b) {
		return parseFloat(a.distance) - parseFloat(b.distance);
	});
	var mlen = mensen.length;
	for (var i=0; i<mlen; i++){
		if (i > 49 || (mensen[i]['distance'] > 100 && i > 9) || i == (mlen - 1)) {
			mensenliste.append('<div class="square linkToAbc"><div class="innerwrapper"><h3>Alle Mensen anzeigen</h3><p>Zur Städteübersicht</p></div></div>');
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


function calculateDistance(mensalocation, devicelocation){
	// calculate distance
	var dx = 111.3 * Math.cos((devicelocation.lat + mensalocation.lat)/2*0.01745) * (devicelocation.lon - mensalocation.lon);
	var dy = 111.3 * (devicelocation.lat - mensalocation.lat);
	return roundNumber(Math.sqrt( dx * dx + dy * dy ),2);
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





function getMensaDetails(mensaid) {
	
	db.transaction(function(tx) {
	    tx.executeSql('SELECT * FROM Mensen WHERE mensaid = '+mensaid , [],
	    function(tx, results){
	    //success
	    	
			var len = results.rows.length;
			
			if (len == 1) {
				
				var mensa = results.rows.item(0);
				$('#mensa-details .content').html('<div class="square"><div class="innerwrapper"><h3>' + mensa.name + '</h3><p><span class="org bold">'+mensa.org+'</span></p><p>'+mensa.address+', '+mensa.postal+' '+mensa.city+'</p></div></div>');
				//$('#mensa-details .content').append('<div class="square innerwrapper"><h4>Anschrift:</h4></div>');
				if (devicePlatform == "ios") {
					var href = 'http://maps.apple.com/maps?q='+mensa.coord_lat+','+mensa.coord_lon+'';
				} else {
					var href = 'http://maps.google.com/maps?q='+mensa.coord_lat+','+mensa.coord_lon+'';
				}
				
				$('#mensa-details .content').append('<div class="square"><a href="'+href+'" target="_blank" class="gmap" style="background-image:url(http://maps.googleapis.com/maps/api/staticmap?center='+mensa.coord_lat+','+mensa.coord_lon+'&zoom=16&markers=icon:http://mensaapp.de/assets/images/icon-mappin4.png|color:red|'+mensa.coord_lat+','+mensa.coord_lon+'&size=600x440&sensor=false)"></a></div>');
				
				if (mensa.checkinid != "") $('#mensa-details .content').append('<a data-mensaid="'+mensaid+'" class="mensacheckin bold button blue icon icon-checkin">Check-in via Facebook</a>');
				
				$('#mensa-details .content').append('<a href="mailto:support@mensaapp.de?subject='+ encodeURIComponent('Falsche oder fehlende Daten bei '+mensa.name+' ('+mensa.mensaid+') [MA2]') +'" class="bold button">Falsche oder fehlende Daten? Feedback senden!</a>');
			} else {
				// mensa not found
				// ...wired error, should not happen
			}
			
		}, dbError);
	}, dbError);
	
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
					mensawrapper.html('<div class="square mensainfo" data-mensaid="'+mensaid+'"><div class="innerwrapper"><h3>' + mensa.name + '</h3><p><span class="org bold">'+mensa.org+'</span><br><span class="lastcheck">Letzte Aktualisierung: '+mensa.lastcheck_string+'</span></p></div></div>');
					
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
				    	
				    	var checkinbutton = '<a data-mensaid="'+mensaid+'" class="mensacheckin bold button blue icon icon-checkin">Check-in via Facebook</a>';
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
										//if (mensa.checkinid != "" && datestamp == getDatestamp()) speiseplan.prepend(checkinbutton);
										speiseplan.append('<p class="blanktext">Für diesen Tag stehen (noch) keine Speiseplandaten zur Verfügung.</p>');
										speiseplan.fadeIn('fast');
										refreshScroll($('#speiseplan'),true);
									/*	navigator.notification.alert("Für diese Mensa stehen im Moment keine Speiseplandaten zur Verfügung.", // message
										alertDismissed, // callback
										"Fehler", // title
										'OK' // buttonName
										);
									*/
									}
								} else {
					
					
						    		if (lastcheck_recommendations < (getTimestamp() - recommendations_refresh_interval) && fetchFromApi == true && networkState==1) {
										getRecommendationsFromApi(mensaid, datestamp);
									} 
						
						
									for (var i = 0; i < len; i++) {
										meal = results.rows.item(i);
										speiseplan.prepend(mealListTpl(meal));
						
										if (i == len - 1) { // last loop
											//if (mensa.checkinid != "" && datestamp == getDatestamp()) speiseplan.prepend(checkinbutton);
											speiseplan.fadeIn(150);
											jumpToElemOffset = 9;
											if ($('#speiseplan #pullDown').hasClass('loading')) jumpToElemOffset = 9 + 40;
						    				refreshScroll($('#speiseplan'),false,'.meal',jumpToElemOffset);
						    				$('#busy').fadeOut();
											$('#blocker').hide();
										}
									}
								}
								
								if (mensa.checkinid != "" && datestamp == getDatestamp()) {
									// get curren user position
									navigator.geolocation.getCurrentPosition(
										function(position){
										// success
											distance = calculateDistance({lat:mensa.coord_lat,lon:mensa.coord_lon}, {lat:position.coords.latitude,lon:position.coords.longitude});
											console.log(distance);
											if (distance < 5) speiseplan.prepend(checkinbutton);
										},
										function(error){
										// error
											speiseplan.prepend(checkinbutton);
										},
										// options
										{
											maximumAge: 30000,
											timeout: 3000,
											enableHighAccuracy: false
										}
									);
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
	
	if (data.info !== "") tpl += '<span class="infoIcon"></span><p class="info blanktext">Infos: '+data.info+'</p>';
	
	tpl += '<div class="innerwrapper">';
	if (data.label !== "") tpl += '<p><span class="label">'+data.label+'</span></p>';
	
	tpl += '<h2>'+data.name+'</h2>';
	
	
	if (data.price !== "") {
		var price = jQuery.parseJSON( data.price );
		tpl += '<p><span class="price">';
			for (p in price) {
				tpl += p + ': '+ price[p] + ' | ';
			}
			tpl = tpl.substr(0, tpl.length -3);
		tpl +='</span></p>';
	}
	
	
	tpl += '</div><p class="recommendations"><span class="value">'+data.recommendations+'</span> Personen empfehlen dieses Gericht.</p></div>';

	return tpl;
}


function trimmingListTpl(data){
	var tpl = '<div class="square trimming">';
	
	//if (typeof data.info !== "undefined" && data.info !== "undefined" && data.info !== "") tpl += '<span class="infoIcon"></span><p class="info blanktext">Infos: '+data.info+'</p>';
	
	
	tpl += '<div class="innerwrapper">';
	
	if (typeof data.label !== "undefined" && data.label !== "undefined" && data.label !== "") tpl += '<p class="label bold">'+data.label+'</p>';
	
	var infos = "";
	
	for (var i = 0; i < data.meals.length; i++) {
		var trimming = data.meals[i];
		tpl += '<h3>'+trimming.name+'</h3>';
		
		if (typeof trimming.price !== "undefined" && trimming.price !== "undefined" && trimming.price !== "") {
			//var price = jQuery.parseJSON( data.price );
			tpl += '<p class="price">';
				for (p in trimming.price) {
					tpl += p + ': '+ trimming.price[p] + ' | ';
				}
				tpl = tpl.substr(0, tpl.length -3);
			tpl +='</p>';
		}
		
		if (typeof trimming.info !== "undefined" && trimming.info !== "undefined" && trimming.info !== "") {
			infos += '<h3>'+trimming.name+'</h3><p>Infos: '+trimming.info+'</p>';
		}
	}
	
	
	
	tpl += '</div>';
	
	if (infos !== "") {
		tpl += '<span class="infoIcon"></span><div class="info blanktext">'+infos+'</div>';
	}
	
	tpl += '</div>';
	
	return tpl;
}


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
					
					if ( typeof meal.price == "undefined") {
						meal.price = "";
					} else {
						meal.price = JSON.stringify(meal.price);
					}
						
					if ( typeof meal.recommendations == "undefined") {
						meal.recommendations = 0;
					}
					
					for (var k=0;k<mealobj.length;k++) {
						key = mealobj[k];
						if (typeof meal[key] == "undefined") {
							DEBUG_MODE && console.log(key + " is undefined for meal " + meal.mealid);
							meal[key] = "";
						}
					}

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
					
					if ( typeof meal.price == "undefined") {
						meal.price = "";
					} else {
						meal.price = JSON.stringify(meal.price);
					}
						
					if ( typeof meal.recommendations == "undefined") {
						meal.recommendations = 0;
					}
					
					for (var k=0;k<mealobj.length;k++) {
						key = mealobj[k];
						if (typeof meal[key] == "undefined") {
							DEBUG_MODE && console.log(key + " is undefined for meal " + meal.mealid);
							meal[key] = "";
						}
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
		
		if (results.error.key == "no_meals") {
			//$('#speiseplan .content .mealwrapper').append('<p class="blanktext">'+msg+'</p>').fadeIn(150);
			getMenu(mensaid, datestamp, false);
			return;
		}
		
		getMenu(mensaid, datestamp, false);
		
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
		