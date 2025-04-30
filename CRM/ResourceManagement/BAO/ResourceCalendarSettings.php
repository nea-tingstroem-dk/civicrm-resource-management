<?php
use CRM_ResourceManagement_ExtensionUtil as E;

class CRM_ResourceManagement_BAO_ResourceCalendarSettings extends CRM_ResourceManagement_DAO_ResourceCalendarSettings {

  /**
   * Create a new ResourceCalendarSettings based on array-data
   *
   * @param array $params key-value pairs
   * @return CRM_ResourceManagement_DAO_ResourceCalendarSettings|NULL
   *
  public static function create($params) {
    $className = 'CRM_ResourceManagement_DAO_ResourceCalendarSettings';
    $entityName = 'ResourceCalendarSettings';
    $hook = empty($params['id']) ? 'create' : 'edit';

    CRM_Utils_Hook::pre($hook, $entityName, CRM_Utils_Array::value('id', $params), $params);
    $instance = new $className();
    $instance->copyValues($params);
    $instance->save();
    CRM_Utils_Hook::post($hook, $entityName, $instance->id, $instance);

    return $instance;
  } */

    public static function getAllSettings($calender_id)
    {
        $settings = [];
        $dao = new self();
        $dao->calendar_id = $calender_id;
        $dao->find();
        while ($dao->fetch()) {
            $setting = $dao->config_value;
            if ($setting === null) {
              continue;
            }
            if (str_starts_with($setting, '[')) {
                $settings[$dao->config_key] =  explode(',', substr($setting, 1, strlen($setting) - 2));
            } else {
                $settings[$dao->config_key] =  $setting;
            }
        }
        return $settings;
    }
}
