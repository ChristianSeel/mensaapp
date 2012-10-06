/*
 * iScroll 4 - jQTouch Bridge
 * PGstart
 */


    // initialize iscroll
    var KEY_ISCROLL_OBJ = 'iscroll_object';
    
    
    function refreshScroll($pane, jumpToTop, jumpToElem, jumpToElemOffset) {	
    	if (typeof jumpToTop == "undefined") jumpToTop = false;
    	if (typeof jumpToElem == "undefined") jumpToElem = false;
    	
    	$pane.find('.scrollwrapper').each(function (i, wrap) {
    		var $wrapper = $(wrap);
    		var scroll = $wrapper.data(KEY_ISCROLL_OBJ);
    		setTimeout(function () {
				if (scroll !== undefined && scroll !== null) {
	    			if (jumpToTop === true) {
	    				scroll.refresh();
	    				scroll.scrollTo(0,0,500);
			    		//scroll.scrollTo(0,0,500);
		    			//setTimeout(function(){scroll.refresh();},501);
	    			} else if (jumpToElem !== false) {
	    				scroll.refresh();
		    			scroll.scrollToElement(jumpToElem, 300, jumpToElemOffset)
	    			} else {
		    			scroll.refresh();
	    			}
	    			
	    		} else {
	    			buildScroll(wrap);
	    		}
			}, 0);
	    		
    	});
    }
    

    function buildScroll(wrap) {
    	var $wrapper = $(wrap);
    	var data = $wrapper.data(KEY_ISCROLL_OBJ);
    	if (data === undefined || data === null) {
    	    
    	    var scroll;
    	    var pullDownEl, pullDownOffset;
    	    var options = {
    	    	hScroll: false,
				hScrollbar: false,
				fixedScrollbar: false,
				lockDirection: false
			};
			
    	    if ($wrapper.hasClass("scrollrefresh")) {
    	    	pullDownEl =  $wrapper.find('#pullDown')[0];
    	    	//pullDownOffset = pullDownEl.offsetHeight;
    	    	//if (pullDownOffset == 0) pullDownOffset = 0;
    	    	pullDownOffset = 1;
    	    	
    	    	options = {
    	    		//useTransition: true,
    	    		//topOffset: pullDownOffset,
    	    		
    	    		hScroll: false,
					hScrollbar: false,
					fixedScrollbar: false,
					lockDirection: false,
    	    		
    	    		onRefresh: function () {
    	    			if (pullDownEl.className.match('loading')) {
    	    				pullDownEl.className = '';
    	    				pullDownEl.querySelector('.pullDownLabel').innerHTML = 'Zum Aktualisieren herunterziehen';
    	    			}
    	    		},
    	    		onScrollMove: function () {
    	    			if (this.y > 38 && !pullDownEl.className.match('flip')) {
    	    				
    	    				pullDownEl.className = 'flip';
    	    				pullDownEl.querySelector('.pullDownLabel').innerHTML = 'Zum Aktualisieren loslassen';
    	    				this.minScrollY = 0;
    	    			} else if (this.y < 38 && pullDownEl.className.match('flip')) {
    	    				pullDownEl.className = '';
    	    				pullDownEl.querySelector('.pullDownLabel').innerHTML = 'Zum Aktualisieren herunterziehen';
    	    				this.minScrollY = -pullDownOffset;
    	    			}
    	    		},
    	    		onScrollEnd: function () {
    	    			if (pullDownEl.className.match('flip')) {
    	    				pullDownEl.className = 'loading';
    	    				pullDownEl.querySelector('.pullDownLabel').innerHTML = 'Lade...';
    	    				
    	    				pullDownAction(scroll,$wrapper);	// Execute custom function (ajax call?)
    	    			}
    	    		}
    	    		
    	    	};
    	    	
    	    	scroll = new iScroll(wrap, options);
    	    	$wrapper.data(KEY_ISCROLL_OBJ, scroll);
    	    	scroll.refresh();
    	    } else {
	    	    
	    	    scroll = new iScroll(wrap, options);
	    	    $wrapper.data(KEY_ISCROLL_OBJ, scroll);
	    	    scroll.refresh();
	    	    
    	    }

    	    
    	} else {
	    	var scroll = data;
    		scroll.refresh();
    	}
    
    }
    
    
    function initiscroll() {
    	$("#jqt").children().each(function (i, pane) {
    	
    		$(pane).find('.scrollwrapper').each(function (i,wrap) {
    			buildScroll(wrap);
    		});
    	});
    
    	$(window).resize(function() {
    		$('#jqt > .current').each(function(i, one) {
    			refreshScroll($(one));
    		});
   		});
	}


$('#jqt > div').live('pageAnimationEnd', function(event, info) {
	if (info.direction == 'in') {
		refreshScroll($(this));
		
    }
});
