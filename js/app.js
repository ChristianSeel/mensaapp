window.addEventListener('load', function() {
    new FastClick(document.getElementById('jqt'));
    new FastClick(document.getElementById('tabbar'));
}, false);

var app = {
	initialize: function() {
		this.bind();
	},
	
	bind: function() {
		document.addEventListener('deviceready', this.onDeviceReady, false);
	},
	
	onDeviceReady: function() {
	
		DEBUG_MODE && console.log("Cordova is ready.");
		
		// add some event listeners
		document.addEventListener("resume", app.onDeviceResume, false);
		document.addEventListener("backbutton", onBackKeyDown, false);
		document.addEventListener("menubutton", onMenuKeyDown, false);
		
		document.addEventListener("online", function(){
			networkState = 1;
			DEBUG_MODE && console.log("Network online.");
		}, false);
		
		document.addEventListener("offline", function(){
			networkState = 0;
			DEBUG_MODE && console.log("Network offline.");
		}, false);
		
                          
		// check network state
		networkConnection = navigator.network.connection.type;
		if (networkConnection == Connection.UNKNOWN || networkConnection == Connection.NONE) {
			networkState = 0;
			DEBUG_MODE && console.log("Network state: "+networkState);
		} else {
			networkState = 1;
			DEBUG_MODE && console.log("Network state: "+networkState);
		}
		
		refreshLocation();
		
		
		// device uuid
		uuid = DEBUG_MODE && device.uuid;
		
		
		devicePlatform = device.platform.toLowerCase();
		if (devicePlatform == "iphone" || devicePlatform == "ipad" || devicePlatform == "iphone simulator" || devicePlatform == "ipad simulator" || devicePlatform == "ipod") devicePlatform = "ios";
		$('body').addClass(devicePlatform);
		
		
		deviceVersion = device.version;
		if (deviceVersion.length > 2) deviceVersion = deviceVersion.slice(0,2);
		deviceVersion = Math.floor(deviceVersion+0);
		$('body').addClass("platformv"+deviceVersion);
		
		
				
		// init google analytics
		if (!DEBUG_MODE) {
			if (devicePlatform == "ios") {
				googleAnalytics = window.plugins.googleAnalyticsPlugin;
				googleAnalytics.startTrackerWithAccountID("UA-34897325-1");
			} else {
				googleAnalytics = window.plugins.analytics;
				googleAnalytics.start("UA-34897325-1", function(){DEBUG_MODE && console.log("Analytics: start success");}, function(){DEBUG_MODE && console.log("Analytics: start failure");});
			}
			
		}
		
		
		// hide app-splashscreen when ready
		if (devicePlatform != "android") cordova.exec(null, null, "SplashScreen", "hide", []);
		
				
		// init database
		setTimeout(initDB,500);
				
	
		// init facebook connect
		try {
			FB.init({
				appId: "385420104813730",
				nativeInterface: CDV.FB,
				useCachedDialogs: false
			});
			
		} catch (e) {
			DEBUG_MODE && console.log(e);
		}
		
		
		// fb auth.login
		FB.Event.subscribe('auth.login', function(result) {
			$('#busy').fadeIn();
			DEBUG_MODE && console.log("[Facebook] auth.login event");
			fbaccesstoken = result.authResponse.accessToken;
			
			FB.api('/me', function(meresponse) {
				fbuser = meresponse;
				DEBUG_MODE && console.log("Say hi to " + fbuser.name);
				$('#konto .scrollpanel .offline').hide();
				var kontotpl = '<div class="square innerwrapper"><img src="https://graph.facebook.com/'+fbuser.id+'/picture?fields=picture&return_ssl_resources=1&width=120&height=120" width="60" height="60" alt="Profilbild" class="userimg links"/><h3>Du bist angemeldet als:</h3><p><span class="bold">'+fbuser.name+'</span><br>'+fbuser.email+'</p></div><a id="fblogout" class="bold button blue">Abmelden</a><div class="square innerwrapper"><p>Wenn du ein Gericht empfiehlst wird deine Stimme zusammen mit deiner UserID an unsere Server übertragen und bis zum Ablauf des Speiseplans gespeichert. Außerdem wird deine Empfehlung auf Facebook veröffentlicht und ist, abhängig von deinen Privatsphäre-Einstellungen, für deine Freunde oder die Öffentlichkeit sichtbar.</p></div>';
				$('#konto .scrollpanel .online').html(kontotpl).fadeIn();
				$('#busy').fadeOut();
			});

			// pass checkpoint
			!DEBUG_MODE && googleAnalytics.trackEvent("Account", "Login");
		});
		
		
		// fb authResponseChange
		FB.Event.subscribe('auth.authResponseChange', function(response) {
			if (response.status != "connected") {
				// user is not anymore connected -> logout
				DEBUG_MODE && console.log("[Facebook] user is no longer connected (authResponseChange event)");
				fbuser = false;
				fbaccessToken = "";
				
				!DEBUG_MODE && googleAnalytics.trackEvent("Account", "Logout");
			}
		});
		
		
		// fb getLoginStatus
		FB.getLoginStatus(function(response) {
			if (response.status == 'connected') {
				DEBUG_MODE && console.log("[Facebook] User is logged in.");
			} else {
				DEBUG_MODE && console.log("[Facebook] User is NOT logged in.");
			}
		});

	},
	
	onDeviceResume: function() {
		 
		DEBUG_MODE && console.log("App resumed");
		
		networkConnection = navigator.network.connection.type;
		if (networkConnection == Connection.UNKNOWN || networkConnection == Connection.NONE) {
			networkState = 0;
			DEBUG_MODE && console.log("Network state: "+networkState);
		} else {
			networkState = 1;
			DEBUG_MODE && console.log("Network state: "+networkState);
		}
		
		refreshLocation();
		getMensenFromDB(false);
		cleanDB();
		 
	}
};



function refreshLocation(callback){
	if (callback == null) callback = function(){};
	// get curren user position
	navigator.geolocation.getCurrentPosition(
	    function(position){
	    // success
	    	userlocation = {lat:position.coords.latitude,lon:position.coords.longitude,timestamp:getTimestamp()};
	    	callback();
	    },
	    function(error){
	    // error
	    },
	    // options
	    {
	    	maximumAge: 5000,
			timeout: 6000,
	    	enableHighAccuracy: false
	    }
	);

}



// handle the android back button as default back button
function onBackKeyDown() {
    if (jQT.goBack() === "exit" && devicePlatform !== "ios") navigator.app.exitApp();
}

function onMenuKeyDown() {
	jQT.goTo( "#mensen" ,"");
}


/*
 *
 * JQUERY
 *
 */
$(function(){

	setTimeout(function(){
		$('#jqt').css("min-height","0px !important");
	}, 1000);
	

	// init iScroll
	initiscroll();
	
	// tabbar
	$('#tabbar li a').bind("click",function(e) {
		e.preventDefault();
		$('#tabbar li').removeClass('current');
		$(this).parents('li').addClass("current");
		var destination = $(this).data('href');
		jQT.goTo(destination ,"");
	});
	
	
	// header
	$('#header .infoIcon').bind("click",function(e) {
		e.preventDefault();
		jQT.goTo('#imprint' ,"");
	});
	
	
	// goback
	$('.goback').live("click",function(e) {
		e.preventDefault();
		jQT.goBack();
	});
	
	
	/*
	 * Links
	 */
	$('#jqt a[data-href]').live("click",function(e) {
		e.preventDefault();
		var destination = $(this).data('href');
		jQT.goTo(destination ,"slideleft");
	});
	
	
	
	
	
	// block navigation and track pageview
	$('#jqt > div').live('pageAnimationStart', function(e, data){
		if (data.direction == "in") {
			$('#tabbar li').removeClass("current");
			$('#tabbar a[data-href="#'+ $(this).attr("id") +'"]').parents('li').addClass('current');
			!DEBUG_MODE && googleAnalytics.trackPageview("/" + $(this).attr("id") );
		} else {
			disableNavigation = true;
		}
		
	});

	$('#jqt > div').live('pageAnimationEnd', function(e, data){
		if (data.direction == "out") {
			disableNavigation = false;
		}
	});
	
	
	
	// Orientation callback event
/*	$('#jqt').bind('turn', function(e, data){
		DEBUG_MODE && console.log("Orientation changed.");
	});
*/	

	// scroll to top
	$('.navigationbar h1, #header .wrapper, #header h1').live("click",function(e) {
		e.preventDefault();
		DEBUG_MODE && console.log("scrollToTop triggered!");
		var scroll = $('#jqt > .current .scrollwrapper').data(KEY_ISCROLL_OBJ);
		scroll.scrollTo(0,0,350);
	});




	
	$('#fblogin').live("click",function(e) {
		e.preventDefault();
		fbLogin();
	});
	
	$('#fblogout').live("click",function(e) {
		e.preventDefault();
		fbLogout();
	});
	
	
	
	
	
	
	
	
	/*
	 *
	 * Mensa
	 *
	 */
	
	
	
	$('.cityselector').live("click",function(e){
		e.preventDefault();
		var city = $(this).data('city');
		DEBUG_MODE && console.log("show mensen of "+city);
		getMensenFromDB(true,city);
		
		return false;
	});
	
	$('.mensa').live("click",function(e){
		e.preventDefault();
		var mensaid = $(this).data('mensaid');
		DEBUG_MODE && console.log("go to speiseplan "+mensaid);
		getMenu(mensaid, getDatestamp(), true);
		setTimeout(function(){
			jQT.goTo("#speiseplan","slideleft");
		}, 50);
		
		$('#speiseplan .skipdayright').removeClass('inactive');
		return false;
	});
	
	
	$('.mensa .addFavorite').live("click",function(e){
		e.preventDefault();
		var mensaid = $(this).parent('.mensa[data-mensaid]').data('mensaid');
		if ($(this).hasClass('isfavorite') === true) {
		    // remove from favorites
		    if (removeMensaFromFavorite(mensaid) === true) $(this).removeClass('isfavorite');
		    DEBUG_MODE && console.log("mensa "+mensaid+" removed from favorites");
	    } else {
		    // add to favorites
		    if (addMensaToFavorite(mensaid) === true) $(this).addClass('isfavorite');
		    DEBUG_MODE && console.log("mensa "+mensaid+" added to favorites");
		}
		return false;
	});
	
	$('#mensen .linkToAbc').live("click",function(e){
		e.preventDefault();
		getMensenFromDB(true, false);
	});
	
	$('#mensen .getlocation').bind("click",function(e){
		getMensenFromDB(false, false);
	});
	
	$('.mensainfo').live("click",function(e){
		e.preventDefault();
		var mensaid = $(this).data('mensaid');
		DEBUG_MODE && console.log("go to detailspage for mensa "+mensaid);
		getMensaDetails(mensaid);
//		setTimeout(function(){
			jQT.goTo("#mensa-details","slideleft");
//		}, 50);
		
		return false;
	});
	
	$('#mensa-details').bind("swipe",function(e,info) {
		e.preventDefault();
		DEBUG_MODE && console.log("swipe detected");
		
		if (info.direction == "right") {
			jQT.goBack();
		}
	});
	
	
	$('.mensacheckin').live("click",function(e){
		e.preventDefault();
		var mensaid = $(this).data('mensaid');
		DEBUG_MODE && console.log("checkin into mensa "+mensaid);
		
		if (!fbuser) {
			navigator.notification.confirm(
				'Für einen Check-in musst du dich zuerst mit Hilfe von Facebook einloggen.',  // message
				function(index){
					if (index==1) fbLogin();
				},              // callback to invoke with index of button pressed
				"Login erforderlich",            // title
				'Einloggen,Abbrechen'          // buttonLabels
			);
			return false;
		}	
		
		
		db.transaction(function(tx) {
		    tx.executeSql('SELECT * FROM Meals WHERE mensaid = ' + mensaid + ' AND datestamp = "' + getDatestamp() + '" ORDER BY recommendations ASC, label DESC, mealid DESC' , [],
		    function(tx, results){
		    //success
		    	
		    	var len = results.rows.length;
				DEBUG_MODE && console.log(len + " meals found");
				
				if (len == 0) {
					doMensaCheckin(0,mensaid);
					return;
				} else {
					$('#selectmeal ul').html('');
					for (var i = 0; i < len; i++) {
						meal = results.rows.item(i);
						$('#selectmeal ul').append('<li data-mealid="'+meal.mealid+'">'+meal.name+'</li>');
		
						if (i == len - 1) { // last loop
							$('#selectmeal ul').append('<li data-mealdid="0" data-mensaid="'+mensaid+'" class="bold">Check-in ohne weitere Angaben</li>');
							$('#selectmeal').fadeIn(150);
		    				refreshScroll($('#selectmeal'),true);
						}
					}
				}
				
			}, dbError);
		}, dbError);

		return false;
	});
	
	$('#selectmeal p.footer').bind("click",function(){
		$('#selectmeal').fadeOut();
	});
	
	$('#selectmeal ul li').live("click",function(){
		var mealid = $(this).data("mealid");
		mensaid = $(this).data('mensaid');
		doMensaCheckin(mealid,mensaid);
		$('#busy').fadeIn();
		$('#selectmeal').fadeOut();
	});
	
	
	
	
	
	/*
	 *
	 * #speiseplan
	 *
	 */
	
	// next day
	$('#speiseplan .skipdayright').live("click",function(e) {
		e.preventDefault();
		if ($(this).hasClass('inactive')) return false;
		var mensaid = $('#speiseplan').data('mensaid');
		var nextdatestamp = $('#speiseplan').data("datestamp")
		nextdatestamp = AddDays(Datestamp2Date(nextdatestamp),1);
		if (typeof mensaid == "undefined" || typeof nextdatestamp == "undefined") {
			alert("ERROR");
			return false;
		}
		getMenu(mensaid, getDatestamp(nextdatestamp), true);
		$('#speiseplan .skipdayleft').removeClass("inactive");
	});
	
	// prev day
	$('#speiseplan .skipdayleft').live("click",function(e, goBack) {
		e.preventDefault();
		if (goBack === false && $(this).hasClass('inactive')) return false;
		var mensaid = $('#speiseplan').data('mensaid');
		var nextdatestamp = $('#speiseplan').data("datestamp")
		nextdatestamp = AddDays(Datestamp2Date(nextdatestamp),-1);
		if (typeof mensaid == "undefined" || typeof nextdatestamp == "undefined") {
			alert("ERROR");
			return false;
		}

		var oldday = (nextdatestamp.getTime() < Datestamp2Date(getDatestamp()).getTime() );
		if (oldday === true && goBack === true) {
			jQT.goTo("#mensen","slideright");
			return false;
		} else if (oldday === true) {
			$('#speiseplan .skipdayleft').addClass("inactive");
			return false;
		}
		getMenu(mensaid, getDatestamp(nextdatestamp), true);
	});
	
	// swipe
	$('#speiseplan').bind("swipe",function(e,info) {
		e.preventDefault();
		DEBUG_MODE && console.log("swipe detected");
		
		if (info.direction == "left") {
			$('#speiseplan .skipdayright').trigger("click");
		} else if (info.direction == "right") {
			$('#speiseplan .skipdayleft').trigger("click", [true]);
		}
	});
	
	
	// recommend
	$('.meal .recommendations').live("click",function(e){
		e.preventDefault();
	
		if (!fbuser) {
			navigator.notification.confirm(
				'Um ein Gericht empfehlen zu können musst du dich zuerst mit Hilfe von Facebook einloggen.',  // message
				function(index){
					if (index==1) fbLogin();
				},              // callback to invoke with index of button pressed
				"Login erforderlich",            // title
				'Einloggen,Abbrechen'          // buttonLabels
			);
			return false;
		}	
		
		var mealwrapper = $(this).parent('.meal');
		var mealid = mealwrapper.data('mealid');
		var mensaid = $(this).parents('.content').find('.mensawrapper [data-mensaid]').data('mensaid');
		var mealname = $('h2',mealwrapper).text();
		var datestamp = $('#speiseplan').data('datestamp');
		
		navigator.notification.confirm(
			'Möchtest du '+ mealname +' empfehlen?',  // message
			function(index){
				if (index==1) postrecommendation(mealid,mensaid,datestamp);
			},              // callback to invoke with index of button pressed
			"Empfehlung veröffentlichen",            // title
			'Empfehlen,Abbrechen'          // buttonLabels
		);
		return false;
		
	});
	

	// show infos
	$('.meal .infoIcon, .trimming .infoIcon').live("click",function(e){
		e.preventDefault();
		var parent = $(this).parent('.square');
		if (!parent.hasClass('showInfo') === true) {
			$(this).parent('.square').siblings().removeClass('showInfo');
			parent.addClass('showInfo');
		}
	});
	
	// hide infos
	$('.meal.showInfo, .trimming.showInfo').live("click",function(e){
		e.preventDefault();
		$(this).removeClass('showInfo');
	});

}); // end of jQuery code




function addMensaToFavorite(mensaid) {
	db.transaction(function(tx){
		tx.executeSql('UPDATE FavoriteMensen SET isfavorite=1 WHERE mensaid='+mensaid);
	}, dbError, function(){});
	return true;
}

function removeMensaFromFavorite(mensaid) {
	db.transaction(function(tx){
		tx.executeSql('UPDATE FavoriteMensen SET isfavorite=0 WHERE mensaid='+mensaid);
	}, dbError, function(){});
	return true;
}




// fb login function
function fbLogin(){
	FB.login(
		function(response) {
			//callback
		},
		{ scope: fbAppScope }
	);
}

function fbLogout(){
	
	$('#busy').fadeIn();
	$('#konto .scrollpanel .online').fadeOut();

	FB.logout(function(response) {
		DEBUG_MODE && console.log("[Facebook] Logout function");
		$('#konto .scrollpanel .offline').show(function(){
			refreshScroll($('#konto'));
			$('#busy').fadeOut();
		});
		
		$('#konto .scrollpanel .online').html("");
	});
}

	
	
function postrecommendation(mealid,mensaid,datestamp){
	
	if (typeof datestamp == "undefined") datestamp = getDatestamp();
	$('#busy').fadeIn();
	var url = 'http://mensaapp.de/recommendation/'+mensaid+'/'+mealid+'/';
	
	db.transaction(function(tx) {
		tx.executeSql('SELECT * FROM Meals WHERE mealid = '+mealid , [],
		function(tx, results){
			
			if (results.rows.length == 1) {
				var meal = results.rows.item(0);
			} else {
				return false; // error should not happen
			}
				
				DEBUG_MODE && console.log("request for mensa "+mensaid+" data.");
				db.transaction(function(tx) {
				    tx.executeSql('SELECT * FROM Mensen WHERE mensaid = '+mensaid , [],
				    function(tx, results){
				    //success
				    	
						if (results.rows.length == 1) {
							var mensa = results.rows.item(0);

							timezoneOffset = (new Date().getTimezoneOffset()/60) * -1;
							if (timezoneOffset > 0) { timezoneOffset = '+'+ pad(timezoneOffset,2);
								} else { timezoneOffset = '-'+ pad(timezoneOffset*-1,2);}
							
							var postobj = {meal: url, end_time: datestamp+'T16:00:00'+timezoneOffset+':00'};
							//postobj['fb:explicitly_shared'] = true;
							
							if (mensa.checkinid != "" && userlocation) {
								distance = calculateDistance({lat:mensa.coord_lat,lon:mensa.coord_lon}, {lat:userlocation.lat,lon:userlocation.lon});
								if (distance < 3) postobj['place'] = mensa.checkinid;
							}
						
							FB.api('/'+fbuser.id+'/mensa_app:recommend', 'post', postobj, function(response) {
								DEBUG_MODE && console.log(response);
								
								if (!response || response.error) {
									$('#busy').fadeOut();
									if (response.error.code == 3501) {
										// og action was already performed
										return;
									}
									
									if (response.error.code >= 200 && response.error.code < 300) {
										// permission error
										navigator.notification.confirm(
											'Für diese Aktion hast du nicht alle notwendigen Berechtigungen auf Facebook gegeben. Bitte logge dich erneut ein und erteile alle Berechtigungen.',  // message
											function(index){
												if (index==1) fbLogin();
											},              // callback to invoke with index of button pressed
											"Fehlende Berechtigungen",            // title
											'Login,Abbrechen'          // buttonLabels
										);
										return;
									}
									
									navigator.notification.alert(
										"Es trat ein Fehler bei Facebook auf. (Code "+response.error.code+")",  // message
										alertDismissed,         // callback
										"Fehler",            // title
										'OK'                  // buttonName
									);
									
								} else {
									DEBUG_MODE && console.log('Recommendation post ID: ' + response.id);
									api('/pushrecommendation?&mensaid='+mensaid+'&mealid='+mealid+'&action_id='+response.id, function(response){
										DEBUG_MODE && console.log("successfull pushed recommendation");
										$('[data-mealid="'+mealid+'"] .recommendations .value').text(response.recommendations);
										$('#busy').fadeOut();
										
										if (!DEBUG_MODE) {
											googleAnalytics.trackEvent("Recommendation", "Mensa " + mensaid, "Meal " + mealid);
										}
								
										db.transaction(function(tx) {
											tx.executeSql('UPDATE Meals SET recommendations=? WHERE mealid = ' + mealid, [response.recommendations]);
										}, function(){}, function(){});
									});
								}
							});
							
						} else {
							// mensa not found
							// ...wired error, should not happen
							$('#busy').fadeOut();
							navigator.notification.alert(
								"Es trat ein Fehler auf.",  // message
								alertDismissed,         // callback
								"Fehler",            // title
								'OK'                  // buttonName
							);
							
						}
						
					}, dbError);
				}, dbError); // mensa
				
				
		}, dbError);
	}, dbError); // meal

	
}



function doMensaCheckin(mealid, mensaid) {
	
	$('#busy').fadeIn();
	var mensaid = mensaid;
	if (typeof mealid == "undefined") mealid = 0;
	DEBUG_MODE && console.log("check-in for mealid "+ mealid + " at mensa "+ mensaid);
	
	
	db.transaction(function(tx) {
		tx.executeSql('SELECT * FROM Meals WHERE mealid = '+mealid , [],
		function(tx, results){
			
			if (results.rows.length == 1) {
				var meal = results.rows.item(0);
				mensaid = meal.mensaid;
			}
				
				DEBUG_MODE && console.log("request for mensa "+mensaid+" data.");
				db.transaction(function(tx) {
				    tx.executeSql('SELECT * FROM Mensen WHERE mensaid = '+mensaid , [],
				    function(tx, results){
				    //success
				    	
						if (results.rows.length == 1) {
							var mensa = results.rows.item(0);
							
							if (mensa.checkinid == "") {
								$('#busy').fadeOut();
								navigator.notification.alert(
									"Ein Check-in in dieser Mensa ist leider nicht möglich. Uns fehlt der Facebook-Ort dieser Mensa.",  // message
									alertDismissed,         // callback
									"Fehler",            // title
									'OK'                  // buttonName
								);
								return;
							}
							
							var postmessage = "Ich bin hier...";
							
							if (mealid != 0) {
								
								postmessage = meal.name;
								
							}
							
							DEBUG_MODE && console.log('process checkin with message "'+postmessage+'" at location id '+mensa.checkinid);

							
							FB.api('/'+fbuser.id+'/feed', 'post', {message: postmessage, place: mensa.checkinid}, function(response) {
								DEBUG_MODE && console.log(response);
								
								$('#busy').fadeOut();
								if (!response || response.error) {
									
									if (response.error.code >= 200 && response.error.code < 300) {
										// permission error
										navigator.notification.confirm(
											'Für diese Aktion hast du nicht alle notwendigen Berechtigungen auf Facebook gegeben. Bitte logge dich erneut ein und erteile alle Berechtigungen.',  // message
											function(index){
												if (index==1) fbLogin();
											},              // callback to invoke with index of button pressed
											"Fehlende Berechtigungen",            // title
											'Login,Abbrechen'          // buttonLabels
										);
										return;
									}

									navigator.notification.alert(
										"Es trat ein Fehler bei Facebook auf.",  // message
										alertDismissed,         // callback
										"Fehler",            // title
										'OK'                  // buttonName
									);
									
								} else {
									DEBUG_MODE && console.log('Post ID: ' + response.id);
									
									if (!DEBUG_MODE) {
										googleAnalytics.trackEvent("Check-in", "Mensa " + mensaid, "Meal " + mealid);
									}
									
									navigator.notification.alert(
										"Dein Check-in wurde auf Facebook veröffentlicht.",  // message
										alertDismissed,         // callback
										"Check-in erfolgreich",            // title
										'OK'                  // buttonName
									);
								}
							});
			
						} else {
							// mensa not found
							// ...wired error, should not happen
							$('#busy').fadeOut();
							navigator.notification.alert(
								"Es trat ein Fehler auf.",  // message
								alertDismissed,         // callback
								"Fehler",            // title
								'OK'                  // buttonName
							);
							
						}
						
					}, dbError);
				}, dbError); // mensa
				
				
		}, dbError);
	}, dbError); // meal
}



/*
 * Event FB Action: Share
 */

function doShare(sharelink){
	if (!fbuser) {
		navigator.notification.confirm(
			'Damit du diese Funktion nutzen kannst, musst du dich in dein '+fbxKontoName+' einloggen.',  // message
			function(index){
				if (index==1) fbLogin();
			},              // callback to invoke with index of button pressed
			"Login erforderlich",            // title
			'Einloggen,Abbrechen'          // buttonLabels
		);
		return false;
	}
	
	$('#busy').fadeIn();
	
	fbxapi('user/share/?&authdata=' + fbaccessToken + '&link=' + sharelink, function(response){

		$('#busy').fadeOut();
	
		DEBUG_MODE && console.log(response);
		navigator.notification.alert(
		    "Der Link zum Event wurde erfolgreich auf deinem Facebook-Profil veröffentlicht.",  // message
		    alertDismissed,         // callback
		    "Event wurde geteilt",            // title
		    'OK'                  // buttonName
		);
		
		// testflight checkpoint
		if (!DEBUG_MODE) {
			googleAnalytics.trackEvent("Events", "Share", sharelink);
		}
		
	}, function(response){
	
		DEBUG_MODE && console.log(response);
		if (response.error.title) {var title = response.error.title + "";} else {var title = "Fehler";}
		if (response.error.description) {var msg = response.error.description + "";} else {var msg = "Es ist ein unbekannter Fehler aufgetreten.";}
		
		$('#busy').fadeOut();
		
		navigator.notification.alert(
		    msg,  // message
		    alertDismissed,         // callback
		    title,            // title
		    'OK'                  // buttonName
		);		
	});
	
}








function alertDismissed(){DEBUG_MODE && console.log("alert dismissed");}

function hideSplashscreen() {
	// hide dom-splashscreen when done
	$('#splashscreen').fadeOut();
	
}






/*
 *
 * API REQUEST
 * jsonp calls to api
 *
 */
function api(url, success, fail) {
	
	if (success == null) success = function(){};
	if (fail == null) fail = function(){};
	
	if (networkState==0){ // if no network return error
		response = {error:{error_key:"networkState",title:"Fehler",description:"Du hast keine Verbindung zum Internet!"}};
		fail(response);
		return false;
	}
	
	DEBUG_MODE && console.log("api request: "+url);
	
	if (url.indexOf("?") == -1) url += "?";
	var hash = "enviroment=mobile&platform="+device.platform+"&platformversion="+device.version+"&appversion="+appversion;
	if (fbuser) hash += "&fbuid="+fbuser.id;
	url += "&ma_hash="+hash.gen();
		
	
	$.getJSONP({
			url: api_url+url,
			cache: false,
			timeout: 30000,
			success: function(response){
			
				if (DEBUG_MODE && response.debug) console.log("Debug response: "+response.debug);
				
				if (response.error) {
					fail(response);
				} else {
					success(response);
				}
				
			}
	});				
	
}



/*
 *
 * GET JSONP
 * function to handle jsonp with timeouts and errors
 *
 */
$.getJSONP = function(s) {
        s.dataType = 'jsonp';
        $.ajax(s);

        // figure out what the callback fn is
        var $script = $(document.getElementsByTagName('head')[0].firstChild);
        var url = $script.attr('src') || '';
        var cb = (url.match(/callback=(\w+)/)||[])[1];
        if (!cb)
            return; // bail
        var t = 0, cbFn = window[cb];
        
        $script[0].onerror = function(e) {
            $script.remove();
            handleError(s, {}, "error", e);
            clearTimeout(t);
        };

        if (!s.timeout)
            return;

        window[cb] = function(json) {
            clearTimeout(t);
            cbFn(json);
            cbFn = null;
        };

        t = setTimeout(function() {
            $script.remove();
            handleError(s, {}, "timeout");
            if (cbFn)
                window[cb] = function(){};
        }, s.timeout);
        
        function handleError(s, o, msg, e) {
            DEBUG_MODE && console.log("[ERROR] api request failed ("+msg+") at "+api_url+url);
            if (msg == "timeout") {
            	s.success({status:"error",error:{title:"Zeitüberschreitung",description:"Der Server antwortete nicht rechtzeitig. Mögliche Ursache ist eine schlechte Internetverbindung."}});
            } else {
	            s.success({status:"error",error:{title:"Fehler",description:"Es konnte keine Verbindung zum Server aufgebaut werden. Bitte versuche es später noch einmal."}});
            }
            
        }
    };



function getTimestamp(){
	return Math.round(+new Date()/1000);
}


function getDatestamp(time){
	if (typeof time == "undefined") {
		d = new Date();
	} else {
		d = time;
	}
	return (d.getFullYear()+"") + "-" + (pad(d.getMonth()+1,2)+"") + "-" + (pad(d.getDate(),2)+"");
}

function Datestamp2Date(datestamp){
/*
	year = datestamp.substring(0,4);
	month = datestamp.substring(5,7);
	month = month - 1;
	day = datestamp.substring(7,9);
*/
	parts = datestamp.split("-");
	month = parts[1] - 1;
	return new Date(parts[0], month, parts[2]);
}

function Datestamp2String(datestamp){
	if (typeof datestamp == "undefined") {
		d = new Date();
	} else {
		d = Datestamp2Date(datestamp);
	}
	var daylabels = new Array("Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag");
	return (daylabels[d.getDay()] + ", der " + pad(d.getDate(),2) + "." + pad(d.getMonth()+1,2) + "." + d.getFullYear());
}

function AddDays(date, amount)
{
    var tzOff = date.getTimezoneOffset() * 60 * 1000;
    var t = date.getTime();
    t += (1000 * 60 * 60 * 24) * amount;
    var d = new Date();
    d.setTime(t);
    var tzOff2 = d.getTimezoneOffset() * 60 * 1000;
    if (tzOff != tzOff2)
    {
        var diff = tzOff2 - tzOff;
        t += diff;
        d.setTime(t);
    }
    return d;
}


function roundNumber(num, dec) {
	return Math.round(num*Math.pow(10,dec))/Math.pow(10,dec);
}

function pad(num, size) {
    var s = "000000000" + num;
    return s.substr(s.length-size);
}

function squareit(number) {
   return number * number;
}

function calculateDistance(mensalocation, devicelocation){
	// calculate distance
	var dx = 111.3 * Math.cos((devicelocation.lat + mensalocation.lat)/2*0.01745) * (devicelocation.lon - mensalocation.lon);
	var dy = 111.3 * (devicelocation.lat - mensalocation.lat);
	return roundNumber(Math.sqrt( dx * dx + dy * dy ),2);
}



function abc(el) {
	this.element = el;

	this.element.addEventListener('touchstart', this, false);
}

abc.prototype = {
	handleEvent: function(e) {
		switch(e.type) {
			case 'touchstart': this.onTouchStart(e); break;
			case 'touchmove': this.onTouchMove(e); break;
			case 'touchend': this.onTouchEnd(e); break;
		}
	},
	
	onTouchStart: function(e) {
		e.preventDefault();
		this.element.className = 'hover';

		var theTarget = e.target;
		if(theTarget.nodeType == 3) theTarget = theTarget.parentNode;
		theTarget = theTarget.innerText;

		if( document.getElementById(theTarget) ) {
			//fscroll.scrollTo(-document.getElementById(theTarget).offsetTop, '0s');
			fscroll.scrollToElement('dt#'+theTarget, 1);
		}
			

		this.element.addEventListener('touchmove', this, false);
		this.element.addEventListener('touchend', this, false);

		return false;
	},

	onTouchEnd: function(e) {
		e.preventDefault();
		this.element.className = '';

		this.element.removeEventListener('touchmove', this, false);
		this.element.removeEventListener('touchend', this, false);
		
		return false;
	},

	onTouchMove: function(e) {
		e.preventDefault();
		var theTarget = document.elementFromPoint(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
		if(theTarget.nodeType == 3) theTarget = theTarget.parentNode;
		theTarget = theTarget.innerText;

		if( document.getElementById(theTarget) ) {
			fscroll.scrollToElement('dt#'+theTarget, 1);
			/*
			theTarget = -document.getElementById(theTarget).offsetTop;
			if( theTarget<fscroll.maxScroll )
				theTarget = fscroll.maxScroll;
			DEBUG_MODE && console.log("scroll to position "+theTarget);
			fscroll.scrollTo(0,theTarget, '0');
			*/
		}

		return false;
	}
}
