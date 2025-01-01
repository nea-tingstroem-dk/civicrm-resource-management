<?php
use CRM_ResourceManagement_ExtensionUtil as E;
return [
  'name' => 'ResourceCalendarColor',
  'table' => 'civicrm_resource_calendar_color',
  'class' => 'CRM_ResourceManagement_DAO_ResourceCalendarColor',
  'getInfo' => fn() => [
    'title' => E::ts('Resource Calendar Color'),
    'title_plural' => E::ts('Resource Calendar Colors'),
    'description' => E::ts('FIXME'),
    'log' => TRUE,
  ],
  'getFields' => fn() => [
    'id' => [
      'title' => E::ts('ID'),
      'sql_type' => 'int unsigned',
      'input_type' => 'Number',
      'required' => TRUE,
      'description' => E::ts('Unique ResourceCalendarColor ID'),
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
    'status_id' => [
      'title' => E::ts('Status ID'),
      'sql_type' => 'int unsigned',
      'input_type' => 'Number',
      'description' => E::ts('Resource participant status ID'),
    ],
    'event_color' => [
      'title' => E::ts('Event Color'),
      'sql_type' => 'varchar(255)',
      'input_type' => 'Text',
      'description' => E::ts('Hex code for event type display color'),
      'add' => '1.0',
    ],
  ],
];
