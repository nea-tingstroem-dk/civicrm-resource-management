<?php
// Angular module resource_management.
// @see https://docs.civicrm.org/dev/en/latest/hooks/hook_civicrm_angularModules
return [
  'js' => [
    'ang/resource_management.js',
    'ang/resource_management/*.js',
    'ang/resource_management/*/*.js',
    'js/moment.js',
    'js/angular-wizard.min.js',
  ],
  'css' => [
    'ang/resource_management.css',
    'css/angular-wizard.min.css'
  ],
  'partials' => [
    'ang/resource_management',
  ],
  'requires' => [
    'crmUi',
    'crmUtil',
    'ngRoute',
  ],
  'settings' => [],
];
