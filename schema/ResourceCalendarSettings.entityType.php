<?php
use CRM_ResourceManagement_ExtensionUtil as E;
return [
  'name' => 'ResourceCalendarSettings',
  'table' => 'civicrm_resource_calendar_settings',
  'class' => 'CRM_ResourceManagement_DAO_ResourceCalendarSettings',
  'getInfo' => fn() => [
    'title' => E::ts('Resource Calendar Settings'),
    'title_plural' => E::ts('Resource Calendar Settingses'),
    'description' => E::ts('FIXME'),
    'log' => TRUE,
  ],
  'getIndices' => fn() => [
    'index_calendar_id_config_key' => [
      'fields' => [
        'calendar_id' => TRUE,
        'config_key' => TRUE,
      ],
      'unique' => TRUE,
    ],
  ],
  'getFields' => fn() => [
    'id' => [
      'title' => E::ts('ID'),
      'sql_type' => 'int unsigned',
      'input_type' => 'Number',
      'required' => TRUE,
      'description' => E::ts('Unique ResourceCalendarSettings ID'),
      'primary_key' => TRUE,
      'auto_increment' => TRUE,
    ],
    'calendar_id' => [
      'title' => E::ts('Calendar ID'),
      'sql_type' => 'int unsigned',
      'input_type' => 'EntityRef',
      'description' => E::ts('FK to ResourceCalendar'),
      'entity_reference' => [
        'entity' => 'ResourceCalendar',
        'key' => 'id',
        'on_delete' => 'CASCADE',
      ],
    ],
    'config_key' => [
      'title' => E::ts('Config Key'),
      'sql_type' => 'varchar(64)',
      'input_type' => 'Text',
      'required' => TRUE,
      'description' => E::ts('Configuration key'),
    ],
    'config_value' => [
      'title' => E::ts('Config Value'),
      'sql_type' => 'varchar(255)',
      'input_type' => 'Text',
      'description' => E::ts('Configuration value'),
    ],
  ],
];
