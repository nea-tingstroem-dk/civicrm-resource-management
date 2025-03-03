(function(angular, $, _) {

  angular.module('resource_management', ['mgo-angular-wizard']).config(function($routeProvider) {
      $routeProvider.when('/resource/check-in-out', {
        controller: 'Resource_managementResourceCheckInOut',
        controllerAs: '$ctrl',
        templateUrl: '~/resource_management/ResourceCheckInOut.html',

        // If you need to look up data when opening the page, list it out
        // under "resolve".
        resolve: {
          myContact: function(crmApi) {
            return crmApi('Contact', 'getsingle', {
              id: 'user_contact_id',
              return: ['first_name', 'last_name']
            });
          }
        }
      });
    }
  );

  // The controller uses *injection*. This default injects a few things:
  //   $scope -- This is the set of variables shared between JS and HTML.
  //   crmApi, crmStatus, crmUiHelp -- These are services provided by civicrm-core.
  //   myContact -- The current contact, defined above in config().
  angular.module('resource_management').controller('Resource_managementResourceCheckInOut', 
  function($scope, crmApi, crmStatus, crmUiHelp) {
    // The ts() and hs() functions help load strings for this module.
    var ts = $scope.ts = CRM.ts('resource-management');
    var hs = $scope.hs = crmUiHelp({file: 'CRM/resource_management/ResourceCheckInOut'}); // See: templates/CRM/resource_management/ResourceCheckInOut.hlp
    // Local variable for this controller (needed when inside a callback fn where `this` is not available).
    this.wizard = {
      title: "Leje af støvsuger",
      steps: [
        {
          title: "Vælg støvsuger"
        }
      ]
    };
    
    var ctrl = this

    $scope.finishedWizard = function() {
      console.log("Finished");
    };
    
    $scope.cancelledWizard = function() {
      console.log("Cancelled");
      
    };
  });

})(angular, CRM.$, CRM._);
