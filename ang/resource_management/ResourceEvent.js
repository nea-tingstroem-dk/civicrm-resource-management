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
      $scope.newTitle = "";

      $scope.existingRepeats = null;
      $scope.existingRepeatsDisplay = {
        title: ts('Title'),
        start_date: ts('Start Date')
      };

      $scope.repetition_start_date = null;

      $scope.repeatHeaders = {
        repeats: 'Repeats',
        every: 'Every',
        times: 'Times',
        lastDate: 'Last Date',
        addButton: 'Add'
      };
      $scope.repeats = Array(1);

      $scope.hideTabs = {
        repeat: true,
        import: true
      };

      $scope.fieldMap = new Map();
      $scope.customMap = new Map();

      $scope.masterEventParticipants = [];
      $scope.masterEventParticipantLabels = [];

      $scope.paste_area = null;

      $scope.foundHeaders = [];
      $scope.found = [];
      $scope.notFoundHeaders = [];
      $scope.notFound = [];
      $scope.pastedColumns = null;
      $scope.pastedMappings = [];
      $scope.targetFieldsMap = [];
      $scope.uniqueRoleValues = [];
      $scope.roleIdList = null;

      $scope.participantEventQueue = null;

      // Local variable for this controller (needed when inside a callback fn where `this` is not available).
      var ctrl = this;

      function hideAllTabs() {
        for (var tab in $scope.hideTabs) {
          $scope.hideTabs[tab] = true;
        }
      }

      $scope.selectTab = function (tab) {
        hideAllTabs();
        $scope.hideTabs[tab] = false;
      };

      $scope.repeatChanged = function (index) {
        var date = moment($scope.masterEvent.start_date);
        var repeats = Array();
        for (var i = 0; i < $scope.repeats.length; i++) {
          var rep = $scope.repeats.at(i);
          var nextDate = date.add(rep.rep_freq * rep.rep_times, rep.rep_every);
          rep.rep_last_date = nextDate.format('YYYY-MM-DD HH:mm');
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
            repeats.push(nextDate.format('YYYY-MM-DDTHH:mm'));
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

      $scope.showRepeats = function (eventId) {
        crmApi4('Event', 'get', {
          select: ["title", "start_date"],
          where: [["parent_event_id", "=", eventId]]
        }).then(function (events) {
          $scope.existingRepeats = events;
        }, function (failure) {
          // handle failure
        });
      };

      $scope.changeMasterEvent = function (event_id) {
        $scope.masterEventId = event_id;
        $scope.eventSelected();
      };

      $scope.removeRepeatedEvent = function (event_id) {
        var params = {
          action: 'delete',
          event_id: event_id,
        };
        var req = {
          method: 'POST',
          url: '/civicrm/ajax/resource-advanced',
          data: 'params=' + JSON.stringify(params)
        };
        $http.defaults.headers.post["Content-Type"] = "application/x-www-form-urlencoded";
        $http(req)
          .then(function successCallback(response) {
            $scope.showRepeats($scope.masterEvent.parent_event_id);
          }, function errorCallback(response) {
            console.log(response);
          });
      };

      $scope.eventSelected = function () {
        crmApi4('Event', 'get', {
          select: ["title", "start_date", "end_date",
            "p_res.id", "p_resp.id",
            "resource.id", "resource.display_name",
            "resp.id", "resp.display_name",
            "parent_event_id"],
          join: [
            ["Participant AS p_res", "LEFT", ["p_res.event_id", "=", "id"], ["p_res.role_id", "=", 5]],
            ["Contact AS resource", "LEFT", ["resource.id", "=", "p_res.contact_id"]],
            ["Participant AS p_resp", "LEFT", ["p_resp.event_id", "=", "id"], ["p_resp.role_id", "IN", [2, 3]]],
            ["Contact AS resp", "LEFT", ["resp.id", "=", "p_resp.contact_id"]]],
          where: [["id", "=", $scope.masterEventId]],
        }).then(function (events) {
          $scope.masterEvent = events[0];
          $scope.repetition_start_date = $scope.masterEvent.start_date;
          $scope.repeatChanged(0);
          $scope.showRepeats($scope.masterEvent.parent_event_id);
          $scope.newTitle = $scope.masterEvent.title;
          crmApi4('UFGroup', 'get', {
            select: [
              "uf_field.id",
              "uf_field.field_name",
              "uf_field.field_name:label",
              "event.default_role_id",
              "SUBSTRING(uf_field.field_name, 8) AS custom_id"
            ],
            join: [
              ["Event AS event", "LEFT", "UFJoin"],
              ["UFField AS uf_field", "LEFT", ["uf_field.uf_group_id", "=", "id"]]],
            where: [
              ["event.id", "=", $scope.masterEvent.id],
              ["uf_field.field_name", "LIKE", "custom_%"]
            ],
          }).then(function (uFGroups) {
            var customIds = [];
            for (var field of uFGroups) {
              customIds.push(field['custom_id']);
              $scope.fieldMap[field['custom_id']] = {
                name: field['uf_field.field_name'],
                label: field['uf_field.field_name:label']
              };
            }
            var fieldNames = [
              "contact_id", "contact_id.external_identifier",
              "contact_id.display_name"];
            var fieldLabels = {
              id: "Id",
              contact_id: ts("Contact Id"),
              'contact_id.external_identifier': ts("External Identifier"),
              'contact_id.display_name': ts("Display Name"),
            };
            crmApi4('Participant', 'getFields', {
              where: [["custom_field_id", "IN", customIds]],
              select: ["custom_field_id", "name", "title"]
            }).then(function (fields) {
              var targets = {};
              for (var field of fields) {
                fieldNames.push(field.name);
                fieldLabels[field.name] = field.title;
                targets[field.name] = field.title;
              }
              targets['role'] = ts("Participant Role");
              $scope.targetFieldsMap = targets;
              $scope.masterEventParticipantLabels = fieldLabels;
              crmApi4('Participant', 'get', {
                select: fieldNames,
                where: [["event_id", "=", $scope.masterEvent.id]]
              }).then(function (participants) {
                $scope.masterEventParticipants = participants;
              }, function (failure) {
                console.log('Error');
              });
            }, function (failure) {
              console.log('Error');
            });
          }, function (failure) {
            console.log('Error');
          });

        }, function (failure) {
          // handle failure
        });
      };

      $scope.saveRepeatedEvents = function () {
        var params = {
          action: 'repeat',
          event_id: $scope.masterEventId,
          new_title: $scope.newTitle,
          resource_participant_id: $scope.masterEvent['p_res.id'],
          responsible_participant_id: $scope.masterEvent['p_resp.id'],
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
            $scope.repeats = [
              {
                rep_freq: "1",
                rep_every: 'week',
                rep_times: "1",
                rep_last_date: null
              }];
            $scope.showRepeats($scope.masterEvent.parent_event_id);
          }, function errorCallback(response) {
            console.log(response);
          });
      };

      $scope.pasted = function () {
        if (!$scope.paste_area) {
          return;
        }
        var params = {
          action: 'parse_pasted',
          pasted: $scope.paste_area,
        };
        var req = {
          method: 'POST',
          url: '/civicrm/ajax/resource-advanced',
          data: 'params=' + JSON.stringify(params)
        };
        $http.defaults.headers.post["Content-Type"] = "application/x-www-form-urlencoded";
        $http(req)
          .then(function successCallback(response) {
            if (response.data.found.length > 0) {
              $scope.foundHeaders = response.data.found_headers;
              $scope.found = response.data.found;
              $scope.inputFields = response.data.not_found_headers;
              $scope.pastedColumns = response.data.columns;
              if ($scope.pastedColumns.length > 0) {
                $scope.pastedMappings = Array(1);
              } else {
                $scope.pastedMappings = null;
              }
            } else {
              $scope.foundHeaders = null;
              $scope.found = null;
              $scope.pastedColumns = null;
            }

            if (response.data.not_found.length > 0) {
              $scope.notFoundHeaders = response.data.not_found_headers;
              $scope.notFound = response.data.not_found;
            } else {
              $scope.notFoundHeaders = [];
              $scope.notFound = [];
            }
            $scope.paste_area = null;
          }, function errorCallback(response) {
            console.log(response);
          });
      };

      $scope.isTargetRole = function (index) {
        if (typeof ($scope) !== 'undefined' &&
          typeof ($scope.pastedMappings[index]) !== 'undefined' &&
          'role' === $scope.pastedMappings[index].target) {
          return true;
        }
        return false;
      };

      $scope.addPasteMapping = function () {
        $scope.pastedMappings.push({});
      };

      $scope.pastedMappingsChanged = function (index) {
        var m = $scope.pastedMappings[index];
        if (m.input_field && m.target) {
          if (m.target === 'role') {
            var uniqueValues = [];
            for (var f of $scope.found) {
              if (uniqueValues.indexOf(f[m.input_field]) < 0) {
                uniqueValues.push({field: f[m.input_field]});
              }
            }
            $scope.uniqueRoleValues = uniqueValues;
            if ($scope.roleIdList === null) {
              crmApi4('OptionValue', 'get', {
                select: ["label"],
                where: [["option_group_id:name", "=", "participant_role"]]
              }).then(function (optionValues) {
                $scope.roleIdList = optionValues;
              }, function (failure) {
                // handle failure
              });
            }
          }
        }
      };

      $scope.addPastedParticipants = function (series = false) {
        var queue = [];
        if (series) {
          var firstDate = moment($scope.masterEvent.start_date);
          for (var value of $scope.existingRepeats) {
            if (moment(value.start_date) >= firstDate)
              queue.push(value);
          }
        } else {
          queue.push($scope.masterEvent);
        }
        $scope.participantEventQueue = queue;
        $scope.queueChanged();
      };

      $scope.queueChanged = function () {
        if ($scope.participantEventQueue.length === 0) {
          $scope.participantEventQueue = null;
          $scope.foundHeaders = null;
          $scope.found = null;
          $scope.notFoundHeaders = [];
          $scope.notFound = [];
          $scope.pastedMappings = null;
          $scope.eventSelected();   //refresh event data
          return;
        }

        var params = {
          action: 'add_participants',
          contacts: $scope.found,
          event_id: $scope.participantEventQueue[0].id,
          mappings: $scope.pastedMappings

        };
        var req = {
          method: 'POST',
          url: '/civicrm/ajax/resource-advanced',
          data: 'params=' + JSON.stringify(params)
        };
        $http.defaults.headers.post["Content-Type"] = "application/x-www-form-urlencoded";
        $http(req)
          .then(function successCallback(response) {
            $scope.participantEventQueue.shift();
            $scope.queueChanged();
          }, function errorCallback(response) {
            console.log(response);
          });
      }

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
