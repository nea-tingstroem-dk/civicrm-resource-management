<?php
use CRM_ResourceManagement_ExtensionUtil as E;
return [
  'name' => 'ResourceCalendar',
  'table' => 'civicrm_resource_calendar',
  'class' => 'CRM_ResourceManagement_DAO_ResourceCalendar',
  'getInfo' => fn() => [
    'title' => E::ts('Resource Calendar'),
    'title_plural' => E::ts('Resource Calendars'),
    'description' => E::ts('FIXME'),
    'log' => TRUE,
  ],
  'getFields' => fn() => [
    'id' => [
      'title' => E::ts('ID'),
      'sql_type' => 'int unsigned',
      'input_type' => 'Number',
      'required' => TRUE,
      'description' => E::ts('Unique ResourceCalendar ID'),
      'primary_key' => TRUE,
      'auto_increment' => TRUE,
    ],
    'calendar_title' => [
      'title' => E::ts('Calendar Title'),
      'sql_type' => 'varchar(255)',
      'input_type' => 'Text',
      'description' => E::ts('Calendar Title'),
      'add' => '1.0',
    ],
    'calendar_type' => [
      'title' => E::ts('Calendar Type'),
      'sql_type' => 'varchar(64)',
      'input_type' => 'Text',
      'description' => E::ts('Null or calendar type name'),
      'add' => '1.0',
    ],
  ],
];
