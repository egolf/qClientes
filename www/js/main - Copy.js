var directions = {};
var contactsWithAddress = [];
var contactAddresses = [];
var compassWatchId = -1;
var locationWatchId = -1;
var map_with_pos = {};
var previous_pos_marker = {};

$(document).ready(function() {
    document.addEventListener("deviceready", onDeviceReady, false);
    //for testing in Chrome browser uncomment
    onDeviceReady();
});

function onDeviceReady() {

    console.log("Ready");
    $(window).bind('pageshow resize orientationchange', function(e) { // resize page if needed
        maxHeight();
    });
    $('#toggleswitch').change(function() { // toggle switch for FROM location
        var v = $(this).val();
        if (v === "on") {
            $("#fromfield").css("display", "none");
        } else {
            $("#fromfield").css("display", "block");
        }
    });

    maxHeight();
    var app = new MyApplication();
}

function maxHeight() {

    var w = $(window).height();
    var cs = $('div[data-role="content"]');
    for (var i = 0, max = cs.length; i < max; i++) {
        var c = $(cs[i]);
        var h = $($('div[data-role="header"]')[i]).outerHeight(true);
        var f = $($('div[data-role="footer"]')[i]).outerHeight(true);
        var c_h = c.height();
        var c_oh = c.outerHeight(true);
        var c_new = w - h - f - c_oh + c_h;
        var total = h + f + c_oh;
        if (c_h < c.get(0).scrollHeight) {
            c.height(c.get(0).scrollHeight);
        } else {
            c.height(c_new);
        }
    }

}

function showAlert(message, title) {
    if (window.navigator.notification) {
        window.navigator.notification.alert(message, null, title, 'OK');
    } else {
        alert(title ? (title + ": " + message) : message);
    }
}

function MyApplication() {
    var self = this;
    var connectionLess = ["undefinedAction", "about", "compass", "contacts", "addresses"];
    var forceConnectionCheck = ["search", "directions", "showAddress"];
    var states = {};
    states[Connection.UNKNOWN] = 'Unknown';
    states[Connection.ETHERNET] = 'Ethernet';
    states[Connection.WIFI] = 'WiFi';
    states[Connection.CELL_2G] = 'Mobile';
    states[Connection.CELL_3G] = 'Mobile';
    states[Connection.CELL_4G] = 'Mobile';
    states[Connection.NONE] = 'No network';

    function hasConnection() {
        if (window.navigator.connection.type === Connection.NONE) {
            return false;
        }
        return true;
    }

    this.showPhoneStatus = function() {
        showAlert(window.device.model + "(" + window.device.platform + " " + window.device.version + ")\nConnection: " + states[window.navigator.connection.type], "About");
    };

    /**
     * Calls method of MyApplication based on value of hash parameter
     * @returns {undefined}
     */
    this.route = function() {
        window.navigator.compass.clearWatch(compassWatchId);
        window.navigator.geolocation.clearWatch(locationWatchId);
        var _h = window.location.hash || "#undefinedAction";
        var stop = _h.length;
        if (_h.indexOf("?") > 0) {
            stop = _h.indexOf("?") - 1;
        }
        _h = _h.substr(1, stop);
        $("#map").html("");
        $("#addressMap").html("");

        if (!checkOK(_h)) {
            showAlert("Internet connection is required", "No internet connection");
            return;
        }

        if (typeof this[_h] === "function") {
            this[_h]();
        } else {
            window.console.log("action function not found: " + _h);
        }
    };

    function checkOK(page) {
        if (hasConnection()) {
            return true;
        }

        if (forceConnectionCheck.indexOf(page) > 0 && !hasConnection()) {
            return false;
        }
        if (!hasConnection() && (connectionLess.indexOf(page) < 0)) {
            return false;
        }
        return true;
    }

    this.address = function() {
        var mapHandler = new MapCtrl(function(error){
            window.console.error(error.message);
        });
        var address = getParmFromHash(window.location.href, "ad");
        mapHandler.address = decodeURIComponent(address);
        mapHandler.mapContainter = "addressMap";
        mapHandler.headerID = "#addressHeader";
        mapHandler.locateAddress();
    };

    this.undefinedAction = function() {
        window.console.log("Action not defined");
    };

    function init() {
        self.route();
    }

    $(window).on('hashchange', function() {
        self.route();
    });

    init();
}

function MapCtrl(onFail) {
    var map;
    var marker;
    var infoWindow;

    var self = this;
    self.mapPrinted = false;
    this.mapContainter = "map";
    this.headerID = "#noheader";
    /**
     * Address to show on map
     * @type String
     */
    this.address = "Prague";

    /**
     * Loads new map
     * @param {Function} callback function to be called when map is loaded
     * @returns {undefined}
     */
    function loadMap(mapContainer, callback, waitForPostion) {
        var latlng = new google.maps.LatLng(55.17, 23.76);
        var myOptions = {
            zoom: 6,
            center: latlng,
            streetViewControl: true,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            zoomControl: true
        };

        map = new google.maps.Map(document.getElementById(mapContainer), myOptions);
        self.map = map;
        google.maps.event.trigger(map, 'resize');

        google.maps.event.addListener(map, 'tilesloaded', function() {
            if (!self.mapPrinted) {
                self.mapPrinted = true;
                if (waitForPostion) {
                    window.navigator.geolocation.getCurrentPosition(callback, onFail, {maximumAge: 10000, timeout: 300000, enableHighAccuracy: true});
                } else {
                    callback();
                }
            }
        });
    }

    this.syncPositionWithMap = function() {
        locationWatchId = window.navigator.geolocation.watchPosition(function(position) {
            showOnMap(position, self.headerID);
        }, onFail, {maximumAge: 10000, timeout: 10000, enableHighAccuracy: true});
    };

    /**
     * Loads new map
     * @param {Function} callback function to be called when map is loaded
     * @returns {undefined}
     */
    function loadMapWatchLocation(mapContainer, callback) {
        var latlng = new google.maps.LatLng(55.17, 23.76);
        var myOptions = {
            zoom: 6,
            center: latlng,
            streetViewControl: true,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            zoomControl: true
        };

        map = new google.maps.Map(document.getElementById(mapContainer), myOptions);
        self.map = map;
        map_with_pos = map;
        google.maps.event.trigger(map, 'resize');

        google.maps.event.addListener(map, 'tilesloaded', function() {
            if (!self.mapPrinted) {
                self.mapPrinted = true;
                locationWatchId = window.navigator.geolocation.watchPosition(callback, onFail, {maximumAge: 10000, timeout: 10000, enableHighAccuracy: true});
            }
        });
    }

    function geo_error(error) {
        if (typeof error === "function") {
            error.callback();
        } else {
            showAlert("Problem with retrieving location ", "Error");
        }
    }


    /**
     * Uses Geocoder to translate string address to map position and places marker on found position
     */
    function showAddressOnMap(address, mapContainter, headerID) {
        if (address.indexOf("'") === 0) {
            address = address.substring(1, address.length);
        }
        if (address.charAt(address.length - 1) === '\'') {
            address = address.substring(0, address.length - 1);
        }

        var geocoder = new google.maps.Geocoder();
        geocoder.geocode({'address': address}, function(results, status) {
            if (status === google.maps.GeocoderStatus.OK) {
                var myOptions = {
                    zoom: 6,
                    center: new google.maps.LatLng(55.17, 23.76),
                    streetViewControl: true,
                    mapTypeId: google.maps.MapTypeId.ROADMAP,
                    zoomControl: true
                };
                map = new google.maps.Map(document.getElementById(mapContainter), myOptions);
                self.map = map;
                map.setCenter(results[0].geometry.location);
                map.setZoom(13);

                if (!marker) {
                    marker = new google.maps.Marker({
                        position: results[0].geometry.location,
                        map: map
                    });
                } else {
                    marker.setPosition(results[0].geometry.location);
                }

                if (!infoWindow) {
                    infoWindow = new google.maps.InfoWindow({
                        content: address
                    });
                } else {
                    infoWindow.setContent(address);
                }
                $(headerID).text("Location found");
                google.maps.event.addListener(marker, 'click', function() {
                    infoWindow.open(map, marker);
                });
            } else {
                geo_error(onFail);
            }
        });
    }

    function reuseOldMap() {
        try {
            if (!self.map && map_with_pos && previous_pos_marker) {
                self.map = map_with_pos; // use previous map (instead of loading a new one)
                previous_pos_marker.setMap(null); // remove previous marker
            }
        } catch (e) {
            window.console.log("nothing to reuse");
        }
    }

    /**
     * Shows reader's position on map
     */
    function showOnMap(position, headerID) {
        $(headerID).html("You Are Here");
        $.mobile.hidePageLoadingMsg();
        reuseOldMap();
        self.map.setCenter(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
        self.map.setZoom(15);

        var info =
                ('Latitude: ' + position.coords.latitude + '<br>' +
                        'Longitude: ' + position.coords.longitude + '<br>' +
                        'Altitude: ' + position.coords.altitude + '<br>' +
                        'Accuracy: ' + position.coords.accuracy + '<br>' +
                        'Altitude Accuracy: ' + position.coords.altitudeAccuracy + '<br>' +
                        'Heading: ' + position.coords.heading + '<br>' +
                        'Speed: ' + position.coords.speed + '<br>' +
                        'Timestamp: ' + new Date(position.timestamp));

        var point = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
        if (!marker) {
            marker = new google.maps.Marker({
                position: point,
                map: self.map
            });
        } else {
            marker.setPosition(point);
        }
        previous_pos_marker = marker;
        if (!infoWindow) {
            infoWindow = new google.maps.InfoWindow({
                content: info
            });
        } else {
            infoWindow.setContent(info);
        }
        google.maps.event.addListener(marker, 'click', function() {
            infoWindow.open(self.map, marker);
        });
    }



    this.locateMe = function() {
        $.mobile.showPageLoadingMsg();
        google.load("maps", "3.8", {"callback": function() {
                loadMapWatchLocation(self.mapContainter, function(position) {
                    showOnMap(position, self.headerID);
                });
            }, other_params: "sensor=true&language=en&libraries=places"});
    };

    this.locateAddress = function() {
        //$(this.headerID).text("Loading...");
        //$.mobile.showPageLoadingMsg();
        google.load("maps", "3.8", {"callback": function() {
                //$.mobile.hidePageLoadingMsg();
                showAddressOnMap(self.address, self.mapContainter, self.headerID);
            }, other_params: "sensor=true&language=en&libraries=places"});
    };

    this.findMatchingResults = function(callback) {
        $.mobile.showPageLoadingMsg();
        google.load("maps", "3.8", {"callback": function() {
                var geocoder = new google.maps.Geocoder();
                geocoder.geocode({'address': self.address}, function(results, status) {
                    $.mobile.hidePageLoadingMsg();
                    if (status === google.maps.GeocoderStatus.OK) {
                        callback(results);
                    }
                });
            }, other_params: "sensor=true&language=en&libraries=places"});
    };

    this.findDirections = function(from, to, useMyLocation, mode, callback) {
        $(self.headerID).html("Loading...");
        $.mobile.showPageLoadingMsg();
        if (useMyLocation) {
            window.navigator.geolocation.getCurrentPosition(function(position) {
                google.load("maps", "3.8", {"callback": function() {
                        loadMap(self.mapContainter, function() {
                            getDirections(new google.maps.LatLng(position.coords.latitude, position.coords.longitude), to, mode, callback);
                        }, false);
                    }, other_params: "sensor=true&language=en"});
            }, onFail, {maximumAge: 10000, timeout: 10000, enableHighAccuracy: true});
        } else {
            google.load("maps", "3.8", {"callback": function() {
                    loadMap(self.mapContainter, function() {
                        getDirections(from, to, mode, callback);
                    }, false);
                }, other_params: "sensor=true&language=en&libraries=places"});
        }
    };

    function getDirections(from, to, mode, callback) {
        var directionsDisplay = new google.maps.DirectionsRenderer();
        var directionsService = new google.maps.DirectionsService();
        directionsDisplay.setMap(self.map);
        var request = {
            origin: from,
            destination: to,
            provideRouteAlternatives: true,
            travelMode: google.maps.DirectionsTravelMode[mode]
        };
        directionsService.route(request, function(response, status) {
            $(self.headerID).html("Directions");
            $.mobile.hidePageLoadingMsg();
            directions = response;
            if (status == google.maps.DirectionsStatus.OK) {
                callback(response.routes);
            } else {
                callback([]);
            }
        });
    }

    this.printDirection = function(index) {
        $.mobile.showPageLoadingMsg();
        if (parseInt(index) < 0) {
            showAlert("Direction not found", "Problem");
            return;
        }
        var _r = directions.routes[index];
        directions.routes = [_r];
        $(self.headerID).html("Loading...");
        google.load("maps", "3.8", {"callback": function() {
                loadMap(self.mapContainter, function() {
                    var directionsDisplay = new google.maps.DirectionsRenderer();
                    directionsDisplay.setMap(self.map);
                    $(self.headerID).html(directions.routes[0].summary);
                    directionsDisplay.setDirections(directions);
                    $.mobile.hidePageLoadingMsg();
                }, false);
            }, other_params: "sensor=true&language=en&libraries=places"});
    };
}

function getParmFromHash(url, parm) {
    var re = new RegExp("#.*[?&]" + parm + "=([^&]+)(&|$)");
    var match = url.match(re);
    return(match ? match[1] : "");
}
