<?php

require_once 'resource_management.civix.php';
// phpcs:disable
use CRM_ResourceManagement_ExtensionUtil as E;
// phpcs:enable

/**
 * Implements hook_civicrm_config().
 *
 * @link https://docs.civicrm.org/dev/en/latest/hooks/hook_civicrm_config/
 */
function resource_management_civicrm_config(&$config) {
  _resource_management_civix_civicrm_config($config);
}

/**
 * Implements hook_civicrm_install().
 *
 * @link https://docs.civicrm.org/dev/en/latest/hooks/hook_civicrm_install
 */
function resource_management_civicrm_install() {
  _resource_management_civix_civicrm_install();
}

/**
 * Implements hook_civicrm_enable().
 *
 * @link https://docs.civicrm.org/dev/en/latest/hooks/hook_civicrm_enable
 */
function resource_management_civicrm_enable() {
  _resource_management_civix_civicrm_enable();
}

// --- Functions below this ship commented out. Uncomment as required. ---

/**
 * Implements hook_civicrm_preProcess().
 *
 * @link https://docs.civicrm.org/dev/en/latest/hooks/hook_civicrm_preProcess
 */
//function resource_management_civicrm_preProcess($formName, &$form) {
//
//}

/**
 * Implements hook_civicrm_navigationMenu().
 *
 * @link https://docs.civicrm.org/dev/en/latest/hooks/hook_civicrm_navigationMenu
 */
function resource_management_civicrm_navigationMenu(&$menu) {
  _resource_management_civix_insert_navigation_menu($menu, 'Administer', [
    'label' => E::ts('Resource Management'),
    'name' => 'resource-management',
    'url' => 'civicrm/admin/resource-calendars',
    'permission' => 'administer CiviCRM',
    'operator' => 'AND',
    'separator' => 0,
  ]);
  _resource_management_civix_insert_navigation_menu($menu, 'Administer/resource-management', [
    'label' => E::ts('Resource Calendar Settings'),
    'name' => 'resource-calendar-settings',
    'url' => 'civicrm/admin/resource-calendars',
    'permission' => 'administer CiviCRM',
    'operator' => 'AND',
    'separator' => 0,
  ]);
  _resource_management_civix_insert_navigation_menu($menu, 'Administer/resource-management', [
    'label' => E::ts('Resource Management Settings'),
    'name' => 'resource-management-settings',
    'url' => 'civicrm/admin/resource-mamagement',
    'permission' => 'administer CiviCRM',
    'operator' => 'AND',
    'separator' => 0,
  ]);
  _resource_management_civix_navigationMenu($menu);
}
