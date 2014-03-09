/*!
 *  opentok-angular (https://github.com/aullman/OpenTok-Angular)
 *  
 *  Angular module for OpenTok
 *
 *  @Author: Adam Ullman (http://github.com/aullman)
 *  @Copyright (c) 2014 Adam Ullman
 *  @License: Released under the MIT license (http://opensource.org/licenses/MIT)
**/

if (!window.TB) throw new Error("You must include the TB library before the TB_Angular library");

angular.module('opentok', [])
.factory("TB", function () {
    return TB;
})
.directive('otSession', ['TB', function(TB) {
    return {
        restrict: 'E',
        scope: {
            apiKey: '@',
            sessionId: '@',
            token: '@',
            session: '=',
            streams: '=',
            publisher: '='
        },
        link: function(scope, element, attrs) {
            var apiKey = attrs.apikey,
                sessionId = attrs.sessionid,
                token = attrs.token;
            scope.streams = [];
            
            $(element).addClass("session-disconnected");

            scope.session = TB.initSession(sessionId);

            var addStreams = function addStreams(streams) {
                scope.$apply(function() {
                    scope.streams = scope.streams.concat(streams);
                });
            };

            var removeStreams = function removeStreams(streams) {
                for (var i = 0; i < streams.length; i++) {
                    for (var j = 0; j < scope.streams.length; j++) {
                        if (streams[i].streamId == scope.streams[j].streamId) {
                            scope.$apply(function() {
                                scope.streams.splice(j, 1);
                            });
                            break;
                        }
                    }
                }
            };

            scope.session.on({
                sessionConnected: function(event) {
                    addStreams(event.streams);
                    var publisherEl = angular.element("ot-publisher"),
                        publisher = scope.publisher || (publisherEl && publisherEl.scope() && publisherEl.scope().publisher);
                    if (publisher) scope.session.publish(publisher);
                    $(element).addClass("session-connected");
                    $(element).removeClass("session-disconnected");
                    scope.$emit('sessionConnected', event);
                },
                streamCreated: function(event) {
                    addStreams(event.streams);
                },
                streamDestroyed: function(event) {
                    removeStreams(event.streams);
                },
                sessionDisconnected: function(event) {
                    scope.$apply(function() {
                        scope.streams = [];
                    });
                    $(element).addClass("session-disconnected");
                    $(element).removeClass("session-connected");
                    scope.$emit('sessionDisconnected', event);
                }
            });

            scope.notMine = function(stream) {
                return stream.connection.connectionId != scope.session.connection.connectionId;
            };

            scope.session.connect(apiKey, token);
        }
    };
}])
.directive('otLayout', ['$window', '$parse', 'TB', function($window, $parse, TB) {
    return {
        restrict: 'E',
        link: function(scope, element, attrs) {
            var props = $parse(attrs.props)();
            var container = TB.initLayoutContainer(element[0], props);
            scope.$watch(function() {
                return element.children().length;
            }, container.layout);
            $window.addEventListener("resize", container.layout);
            scope.$on("otLayout", function() {
                container.layout();
            });
        }
    };
}])
.directive('otPublisher', ['$document', '$window', function($document, $window) {
    return {
        restrict: 'E',
        scope: {
            props: '&',
            publisher: '=',
            session: '='
        },
        link: function(scope, element, attrs){
            var props = scope.props() || {};
            props.width = props.width ? props.width : $(element).width();
            props.height = props.height ? props.height : $(element).height();
            var oldChildren = $(element).children();
            scope.publisher = TB.initPublisher(attrs.apikey, element[0], props);
            // Make transcluding work manually by putting the children back in there
            $(element).append(oldChildren);
            scope.publisher.on({
                accessAllowed: function(event) {
                    $(element).addClass("allowed");
                },
                loaded: function (event){
                    scope.$emit("otLayout");
                }
            });
            scope.$on("$destroy", function () {
                if (scope.session) scope.session.unpublish(scope.publisher);
                else scope.publisher.destroy();
            });
            if (scope.session) scope.session.publish(scope.publisher);
        }
    };
}])
.directive('otSubscriber', function() {
    return {
        restrict: 'E',
        scope: {
            stream: '=',
            session: "=",
            props: '&'
        },
        link: function(scope, element, attrs){
            var stream = scope.stream,
                session = scope.session,
                props = scope.props() || {};
            props.width = props.width ? props.width : $(element).width();
            props.height = props.height ? props.height : $(element).height();
            var oldChildren = $(element).children();
            var subscriber = session.subscribe(stream, element[0], props);
            subscriber.on("loaded", function () {
                scope.$emit("otLayout");
            });
            // Make transcluding work manually by putting the children back in there
            $(element).append(oldChildren);
            scope.$on("$destroy", function () {
                subscriber.destroy();
            });
        }
    };
});