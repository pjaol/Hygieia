(function () {
    'use strict';

    angular
        .module('devops-dashboard')
        .controller('monitorViewController', monitorViewController)
        .controller('monitorStatusController', monitorStatusController);

    monitorViewController.$inject = ['$scope', 'monitorData', 'DASH_STATUS', '$modal', '$q'];
    function monitorViewController($scope, monitorData, DASH_STATUS, $modal, $q) {
        /*jshint validthis:true */
        var ctrl = this;

        // public variables
        ctrl.statuses = DASH_STATUS;
        ctrl.services = [];
        ctrl.dependencies = [];

        // public methods
        ctrl.openStatusWindow = openStatusWindow;
        ctrl.hasMessage = hasMessage;

        ctrl.load = function() {
            // grab data from the api
            var deferred = $q.defer();
            monitorData.details($scope.dashboard.id).then(function(data) {
                processResponse(data.result);
                deferred.resolve(data.lastUpdated);
            });
            return deferred.promise;
        };


        // method implementations
        function hasMessage(service) {
            return service.message && service.message.length;
        }

        function openStatusWindow(service) {
            // open up a new modal window for the user to set the status
            $modal.open({
                templateUrl: 'monitorStatus.html',
                controller: 'monitorStatusController',
                controllerAs: 'ctrl',
                scope: $scope,
                size: 'md',
                resolve: {
                    // make sure modal has access to the status and selected
                    statuses: function () {
                        return DASH_STATUS;
                    },
                    service: function () {
                        return {
                            id: service.id,
                            status: service.status,
                            message: service.message
                        };
                    }
                }
            }).result
                .then(function (updatedService) {
                    // if the window is closed without saving updatedService will be null
                    if(!updatedService) {
                        return;
                    }

                    // update locally
                    _(ctrl.services).forEach(function(service, idx) {
                        if(service.id == updatedService.id) {
                            ctrl.services[idx] = angular.extend(service, updatedService);
                        }
                    });

                    // update the api
                    monitorData.updateService($scope.dashboard.id, updatedService);
                });
        }

        function processResponse(response) {
            var worker = {
                    doWork: workerDoWork
                };

            worker.doWork(response, DASH_STATUS, workerCallback);
        }

        function workerDoWork(data, statuses, cb) {
            cb({
                services: get(data.services, false),
                dependencies: get(data.dependencies, true)
            });

            function get(services, dependency) {
                return _.map(services, function (item) {
                    var name = item.name;

                    if (dependency && item.applicationName) {
                        name = item.applicationName + ': ' + name;
                    }

                    if(item.status && (typeof item.status == 'string' || item.status instanceof String)) {
                        item.status = item.status.toLowerCase();
                    }

                    switch (item.status) {
                        case 'ok':
                            item.status = statuses.PASS;
                            break;
                        case 'warning':
                            item.status = statuses.WARN;
                            break;
                        case 'alert':
                            item.status = statuses.FAIL;
                            break;
                    }

                    return {
                        id: item.id,
                        name: name,
                        status: item.status,
                        message: item.message
                    };
                });
            }
        }

        function workerCallback(data) {
            //$scope.$apply(function () {
                ctrl.services = data.services;
                ctrl.dependencies = data.dependencies;
            //});
        }
    }

    monitorStatusController.$inject = ['service', 'statuses', '$modalInstance'];
    function monitorStatusController(service, statuses, $modalInstance) {
        /*jshint validthis:true */
        var ctrl = this;

        // public variables
        ctrl.service = service;
        ctrl.statuses = statuses;
        ctrl.setStatus = setStatus;

        // public methods
        ctrl.submit = submit;

        function setStatus(status) {
            ctrl.service.status = status;
        }

        function submit() {
            // pass the service back so the widget can update
            $modalInstance.close(ctrl.service);
        }
    }
})();
