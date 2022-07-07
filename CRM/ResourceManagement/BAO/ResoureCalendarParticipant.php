<?php
use CRM_ResourceManagement_ExtensionUtil as E;

class CRM_ResourceManagement_BAO_ResoureCalendarParticipant extends CRM_ResourceManagement_DAO_ResoureCalendarParticipant {

  /**
   * Create a new ResoureCalendarParticipant based on array-data
   *
   * @param array $params key-value pairs
   * @return CRM_ResourceManagement_DAO_ResoureCalendarParticipant|NULL
   *
  public static function create($params) {
    $className = 'CRM_ResourceManagement_DAO_ResoureCalendarParticipant';
    $entityName = 'ResoureCalendarParticipant';
    $hook = empty($params['id']) ? 'create' : 'edit';

    CRM_Utils_Hook::pre($hook, $entityName, CRM_Utils_Array::value('id', $params), $params);
    $instance = new $className();
    $instance->copyValues($params);
    $instance->save();
    CRM_Utils_Hook::post($hook, $entityName, $instance->id, $instance);

    return $instance;
  } */

}
