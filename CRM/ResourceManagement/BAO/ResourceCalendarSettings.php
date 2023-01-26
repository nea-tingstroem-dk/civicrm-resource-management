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

    public static function getSettingsList()
    {
        return [
            'show_end_date' => [
                'label' => E::ts('Show End Date'),
                'type' => 'boolean', 
                'description' => E::ts('Show the event with start and end dates on the calendar.') ],
            'week_begins_from_day' => [
                'label' => E::ts('Show week begins on'), 
                'type' => 'boolean', 
                'description' => E::ts('Use weekBegin settings from CiviCRM. You can override settings at Administer > Localization > Date Formats.') ],
            'time_format_24_hour' => [
                'label' => E::ts('Use 24 hour format'),
                'type' => 'boolean', 
                'description' => E::ts('Use 24 hour time format - default is AM/PM format.') ],
            'event_template' => [
                'label' => E::ts('Default Event Template'),
                'type' => 'boolean', 
                'description' => E::ts('Show the event with start and end dates on the calendar.') ],
            'host_role_id' => [
                'label' => E::ts('Host Participant Role'),
                'type' => 'boolean', 
                'description' => E::ts('Show the event with start and end dates on the calendar.') ],
            'host_status_id' => [
                'label' => E::ts('Host Participant Status'),
                'type' => 'boolean', 
                'description' => E::ts('Show the event with start and end dates on the calendar.') ],
        ];
    }
}
