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
 * Implements hook_civicrm_xmlMenu().
 *
 * @link https://docs.civicrm.org/dev/en/latest/hooks/hook_civicrm_xmlMenu
 */
function resource_management_civicrm_xmlMenu(&$files) {
  _resource_management_civix_civicrm_xmlMenu($files);
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
 * Implements hook_civicrm_postInstall().
 *
 * @link https://docs.civicrm.org/dev/en/latest/hooks/hook_civicrm_postInstall
 */
function resource_management_civicrm_postInstall() {
  _resource_management_civix_civicrm_postInstall();
}

/**
 * Implements hook_civicrm_uninstall().
 *
 * @link https://docs.civicrm.org/dev/en/latest/hooks/hook_civicrm_uninstall
 */
function resource_management_civicrm_uninstall() {
  _resource_management_civix_civicrm_uninstall();
}

/**
 * Implements hook_civicrm_enable().
 *
 * @link https://docs.civicrm.org/dev/en/latest/hooks/hook_civicrm_enable
 */
function resource_management_civicrm_enable() {
  _resource_management_civix_civicrm_enable();
}

/**
 * Implements hook_civicrm_disable().
 *
 * @link https://docs.civicrm.org/dev/en/latest/hooks/hook_civicrm_disable
 */
function resource_management_civicrm_disable() {
  _resource_management_civix_civicrm_disable();
}

/**
 * Implements hook_civicrm_upgrade().
 *
 * @link https://docs.civicrm.org/dev/en/latest/hooks/hook_civicrm_upgrade
 */
function resource_management_civicrm_upgrade($op, CRM_Queue_Queue $queue = NULL) {
  return _resource_management_civix_civicrm_upgrade($op, $queue);
}

/**
 * Implements hook_civicrm_managed().
 *
 * Generate a list of entities to create/deactivate/delete when this module
 * is installed, disabled, uninstalled.
 *
 * @link https://docs.civicrm.org/dev/en/latest/hooks/hook_civicrm_managed
 */
function resource_management_civicrm_managed(&$entities) {
  _resource_management_civix_civicrm_managed($entities);
}

/**
 * Implements hook_civicrm_caseTypes().
 *
 * Add CiviCase types provided by this extension.
 *
 * @link https://docs.civicrm.org/dev/en/latest/hooks/hook_civicrm_caseTypes
 */
function resource_management_civicrm_caseTypes(&$caseTypes) {
  _resource_management_civix_civicrm_caseTypes($caseTypes);
}

/**
 * Implements hook_civicrm_angularModules().
 *
 * Add Angular modules provided by this extension.
 *
 * @link https://docs.civicrm.org/dev/en/latest/hooks/hook_civicrm_angularModules
 */
function resource_management_civicrm_angularModules(&$angularModules) {
  // Auto-add module files from ./ang/*.ang.php
  _resource_management_civix_civicrm_angularModules($angularModules);
}

/**
 * Implements hook_civicrm_alterSettingsFolders().
 *
 * @link https://docs.civicrm.org/dev/en/latest/hooks/hook_civicrm_alterSettingsFolders
 */
function resource_management_civicrm_alterSettingsFolders(&$metaDataFolders = NULL) {
  _resource_management_civix_civicrm_alterSettingsFolders($metaDataFolders);
}

/**
 * Implements hook_civicrm_entityTypes().
 *
 * Declare entity types provided by this module.
 *
 * @link https://docs.civicrm.org/dev/en/latest/hooks/hook_civicrm_entityTypes
 */
function resource_management_civicrm_entityTypes(&$entityTypes) {
  _resource_management_civix_civicrm_entityTypes($entityTypes);
}

/**
 * Implements hook_civicrm_themes().
 */
function resource_management_civicrm_themes(&$themes) {
  _resource_management_civix_civicrm_themes($themes);
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
  _resource_management_civix_insert_navigation_menu($menu, NULL, [
    'label' => E::ts('Resource Management'),
    'name' => 'resource-management',
    'url' => 'civicrm/admin/resource-calendars',
    'permission' => 'administer CiviCRM',
    'operator' => 'AND',
    'separator' => 0,
  ]);
  _resource_management_civix_insert_navigation_menu($menu, 'resource-management', [
    'label' => E::ts('Resource Calendar Settings'),
    'name' => 'resource-calendar-settings',
    'url' => 'civicrm/admin/resource-calendars',
    'permission' => 'administer CiviCRM',
    'operator' => 'AND',
    'separator' => 0,
  ]);
  _resource_management_civix_insert_navigation_menu($menu, 'resource-management', [
    'label' => E::ts('Resource Management Settings'),
    'name' => 'resource-management-settings',
    'url' => 'civicrm/admin/resource-mamagement',
    'permission' => 'administer CiviCRM',
    'operator' => 'AND',
    'separator' => 0,
  ]);
  _resource_management_civix_navigationMenu($menu);
}
