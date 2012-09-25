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
	//	if (devicePlatform != "android") cordova.exec(null, null, "SplashScreen", "hide", []);
		
				
		// init database
		setTimeout(initDB,500);
		
		
/*		
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
*/
	},
	
	onDeviceResume: function() {
		 
		DEBUG_MODE && console.log("App resumed");
		getMensenFromDB(false);
		 
	}
};




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
	$('#tabbar a').bind("click",function(e) {
		e.preventDefault();
		var destination = $(this).data('href');
		jQT.goTo(destination ,"");
	});
	
	
	
	/*
	 * Links
	 */
	$('#jqt a[data-href]').bind("click",function(e) {
		e.preventDefault();
		var destination = $(this).data('href');
		jQT.goTo(destination ,"slideleft");
	});
	
	
	
	
	// Orientation callback event
/*	$('#jqt').bind('turn', function(e, data){
		DEBUG_MODE && console.log("Orientation changed.");
	});
*/	
	
	
	$('#jqt > div').live('pageAnimationStart', function(e, data){
		if (data.direction == "in") {
			$('#tabbar li a').removeClass("current");
			$('#tabbar a[data-href="#'+ $(this).data("tabbaritem") +'"]').addClass('current');
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
	
	
	
	$('#fblogin').live("click",function(e) {
		e.preventDefault();
		fbLogin();
	});
	
	$('#fblogout').live("click",function(e) {
		e.preventDefault();
		fbLogout();
	});
	
	
	
	$('#mensen .linkToAbc').live("click",function(e){
		e.preventDefault();
		getMensenFromDB(true);
	});
	
	
	
	$('.mensa').live("click",function(e){
		e.preventDefault();
		var mensaid = $(this).data('mensaid');
		DEBUG_MODE && console.log("go to speiseplan "+mensaid);
		getMenu(mensaid, getDatestamp(), true);
		jQT.goTo("#speiseplan","slideleft");
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
	

	// refesh Icon
	$('#events .refreshIcon').live("click",function(e) {
	    e.preventDefault();
	    if ($(this).hasClass('rotate')) {
	    	// do nothing
	    } else {
	    	$('#busy').fadeIn();
	    	$(this).addClass('rotate');
	    	getEventsFromApi(function(){
	    		$('#events .refreshIcon').removeClass('rotate');
	    		$('#busy').fadeOut();
	    	});
	    	
	    }
	});
	
	
/*	
	// event fb actions
	$('#jqt > div[data-iseventpage] a[data-fbaction]').live("click",function(e) {
	    e.preventDefault();
	    switch($(this).data('fbaction')){
		    case "rsvp_event":
		    	doRSVP($(this).data('eventfbid'));
		    	break;
		    case "event_invite":
		    	getEventInvites($(this).data('eventfbid'));
		    	break;
		    case "share":
		    	doShare($(this).data('sharelink'));
		    	break;
	    }
	});
	
*/	
	
/*	
	$('#jqt > #mensen').bind('pageAnimationStart', function(e, info){ 
		if ($(this).data('loaded') == false && info.direction == "in") {
			getMensen();
		}
	});
*/	

	

}); // end of jQuery code


function addMensaToFavorite(mensaid) {
	db.transaction(function(tx){
		tx.executeSql('UPDATE Mensen SET isfavorite=1 WHERE mensaid='+mensaid);
	}, dbError, function(){});
	return true;
}

function removeMensaFromFavorite(mensaid) {
	db.transaction(function(tx){
		tx.executeSql('UPDATE Mensen SET isfavorite=0 WHERE mensaid='+mensaid);
	}, dbError, function(){});
	return true;
}



function doLike(url,cb){
	
	if (cb == null) cb = function(){};
		
	FB.api('/'+fbuser.id+'/og.likes', 'post', { access_token: fbaccessToken, object: url}, function(response) {
		DEBUG_MODE && console.log(response);
		if (!response || response.error) {
			cb();
			if (response.error.code == 3501) {
				$(".ps-toolbar-like .ps-toolbar-content").addClass("active").delay(1000).removeClass("active");
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
			cb();
			$(".ps-toolbar-like .ps-toolbar-content").addClass("active").delay(1000).removeClass("active");
		}
	});
	
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
	$('#konto .refreshIcon').fadeOut();

	FB.logout(function(response) {
		DEBUG_MODE && console.log("[Facebook] Logout function");
		$('#konto .scrollpanel .offline').show(function(){
			refreshScroll($('#konto'));
			$('#busy').fadeOut();
		});
		
		$('#konto .scrollpanel .online').html("");
		$('[data-clearOnLogout="true"]').html("");
		$('[data-deleteOnLogout="true"]').remove("");
		
		$('#pointlog').data("loaded",false);
		$('#couponlog').data("loaded",false);
	});
}


function onLogin(){
	
	DEBUG_MODE && console.log("function onLogin fired");
	DEBUG_MODE && console.log("Hallo " + fbuser.full_name);
	
	$('#konto .scrollpanel .offline').hide();
	
	$('#konto .scrollpanel .online').html(getKontoTpl()).fadeIn();
	$('#konto .refreshIcon').fadeIn();
	
}


/*
function getKontoTpl(){
	var pluralE = "e";
	if (fbuser.numberofcoupons == 1) pluralE = "";
	var tpl = '<div class="span nopadding">
	<div id="kontooverview">
		<img class="backgroundimage" src="'+fbuser.picture+'"/>
		<div class="content">
			<div class="line"></div>
			<h2>Hi '+fbuser.first_name+'!</h2>
			<a id="totalpoints" href="#pointlog"><span>'+fbuser.totalpoints+'</span> Punkte</a>
			<a id="couponcount" href="#couponlog"><span>'+fbuser.numberofcoupons+'</span> Gutschein'+pluralE+'</a>
			<div class="userimg" style="background-image: url('+fbuser.picture+');"></div>
		</div>
	</div>
</div>

<a href="#couponlog" class="bold graybutton icon icon-coupon">Gutscheine</a>
<a href="#pointlog" class="bold graybutton icon icon-pointlog">Punkte-Historie</a>
<a id="playKontoVideo" href="#" class="bold graybutton icon icon-help">Hilfe-Video</a>
<a href="#" id="fblogout" class="bold bluebutton icon">Abmelden</a>';
return tpl
}
*/





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
	
	if (networkState==0){ // if no network return error
		response = {error:{error_key:"networkState",title:"Fehler",description:"Du hast keine Verbindung zum Internet!"}};
		fail(response);
		return false;
	}
	
	DEBUG_MODE && console.log("api request: "+url);
	
	if (url.indexOf("?") == -1) url += "?";
	url += "&ma_hash="+hash.gen("enviroment=mobile&platform="+device.platform+"&platformversion="+device.version+"&appversion="+appversion);
		
	
	$.getJSONP({
			url: api_url+url,
			cache: false,
			timeout: 40000,
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
	return (d.getFullYear()+"") + (pad(d.getMonth()+1,2)+"") + (pad(d.getDate(),2)+"");
}

function Datestamp2Date(datestamp){
	year = datestamp.substring(0,4);
	month = datestamp.substring(4,6);
	month = month - 1;
	day = datestamp.substring(6,8);
	return new Date(year, month, day);
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
