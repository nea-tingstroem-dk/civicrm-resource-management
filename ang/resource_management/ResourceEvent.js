(function (angular, $, _) {

  angular.module('resource_management').config(function ($routeProvider) {
    $routeProvider.when('/resource/manage-event', {
      controller: 'Resource_managementResourceEvent',
      controllerAs: '$ctrl',
      templateUrl: '~/resource_management/ResourceEvent.html',

      // If you need to look up data when opening the page, list it out
      // under "resolve".
      resolve: {
      }
    });
  }
  );

  // The controller uses *injection*. This default injects a few things:
  //   $scope -- This is the set of variables shared between JS and HTML.
  //   crmApi, crmStatus, crmUiHelp -- These are services provided by civicrm-core.
  //   myContact -- The current contact, defined above in config().
  angular.module('resource_management').controller('Resource_managementResourceEvent',
    function ($scope, crmApi4, crmStatus, crmUiHelp, $location, $http) {
      // The ts() and hs() functions help load strings for this module.
      var ts = $scope.ts = CRM.ts('resource-management');
      var hs = $scope.hs = crmUiHelp({file: 'CRM/resource_management/ResourceEvent'}); // See: templates/CRM/resource_management/ResourceEvent.hlp
      $scope.parameters = $location.search();
      $scope.masterEventId = null;
      $scope.masterEvent = null;

      $scope.repetition_start_date = null;

      $scope.repeatHeaders = {
        repeatds: 'Repeats',
        every: 'Every',
        times: 'Times',
        lastDate: 'Last Date',
        addButton: 'Add'
      };
      $scope.repeats = Array(1);

      $scope.hideTabs = {
        repeat: true,
        participants: true
      };
      // Local variable for this controller (needed when inside a callback fn where `this` is not available).
      var ctrl = this;

      function hideAllTabs() {
        $scope.hideTabs.repeat = true;
        $scope.hideTabs.participants = true;
      }

      $scope.selectTab = function (tab) {
        hideAllTabs();
        if (tab === 'repeat') {
          $scope.hideTabs.repeat = false;
        } else if (tab === 'participants') {
          $scope.hideTabs.participants = false;
        }
      };

      $scope.repeatChanged = function (index) {
        var date = moment($scope.masterEvent.start_date);
        var repeats = Array();
        for (var i = 0; i < $scope.repeats.length; i++) {
          var rep = $scope.repeats.at(i);
          var nextDate = date.add(rep.rep_freq * rep.rep_times, rep.rep_every);
          rep.rep_last_date = nextDate.format('YYYY-MM-DD');
          repeats.push(rep);
          date = nextDate.clone();
        }
        $scope.repeats = repeats;
      };

      $scope.expandDates = function () {
        var date = moment($scope.masterEvent.start_date);
        var repeats = Array();
        for (var i = 0; i < $scope.repeats.length; i++) {
          var rep = $scope.repeats.at(i);
          for (var j = 0; j < rep.rep_times; j++) {
            var nextDate = date.add(rep.rep_freq, rep.rep_every);
            repeats.push(nextDate.format('YYYY-MM-DDThh:mm'));
            date = nextDate.clone();
          }
        }
        return repeats;
      };

      $scope.addRepeat = function () {
        $scope.repeats.push({
          rep_freq: "1",
          rep_every: 'week',
          rep_times: "1",
          rep_last_date: null
        });
        $scope.repeatChanged(0);
      };

      $scope.removeRepeat = function (index) {
        var repeats = Array();
        for (var i = 0; i < $scope.repeats.length; i++) {
          if (i === index) {
            continue;
          }
          var rep = $scope.repeats.at(i);
          repeats.push(rep);
        }
        $scope.repeats = repeats;
        $scope.repeatChanged(0);
      };

      $scope.eventSelected = function () {
        crmApi4('Event', 'get', {
          select: ["title", "start_date", "end_date", 
            "p_res.id", "p_resp.id",
            "resource.id", "resource.display_name", 
            "resp.id", "resp.display_name"],
          join: [["Participant AS p_res", "LEFT", ["p_res.event_id", "=", "id"], ["p_res.role_id", "=", 5]], 
            ["Contact AS resource", "LEFT", ["resource.id", "=", "p_res.contact_id"]], 
            ["Participant AS p_resp", "LEFT", ["p_resp.event_id", "=", "id"], ["p_resp.role_id", "IN", [2, 3]]], ["Contact AS resp", "LEFT", ["resp.id", "=", "p_resp.contact_id"]]],
          where: [["id", "=", $scope.masterEventId]],
        }).then(function (events) {
          $scope.masterEvent = events[0];
          $scope.repetition_start_date = $scope.masterEvent.start_date;
          $scope.repeatChanged(0);
        }, function (failure) {
          // handle failure
        });
      };

      $scope.saveRepeatedEvents = function () {
        var params = {
          action: 'repeat',
          event_id: $scope.masterEventId,
          resource_participant_id: $scope.masterEvent['p_res.id'],
          responsible_participant_id: $scope.masterEvent['P_resp.id'],
          dates: $scope.expandDates(),
        };
        var req = {
          method: 'POST',
          url: '/civicrm/ajax/resource-advanced',
          data: 'params=' + JSON.stringify(params)
        };
        $http.defaults.headers.post["Content-Type"] = "application/x-www-form-urlencoded";
        $http(req)
          .then(function successCallback(response) {
            console.log(response);
          }, function errorCallback(response) {
            console.log(response);
          });

      };

      $scope.repeats[0] = {
        rep_freq: "1",
        rep_every: 'week',
        rep_times: "1",
        rep_last_date: null
      };

      if ($scope.parameters.event_id) {
        $scope.masterEventId = $scope.parameters.event_id;
        $scope.eventSelected();
      }

    });

})(angular, CRM.$, CRM._);
