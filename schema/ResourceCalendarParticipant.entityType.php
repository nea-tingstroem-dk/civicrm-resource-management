<?php
use CRM_ResourceManagement_ExtensionUtil as E;
return [
  'name' => 'ResourceCalendarParticipant',
  'table' => 'civicrm_resource_calendar_participant',
  'class' => 'CRM_ResourceManagement_DAO_ResourceCalendarParticipant',
  'getInfo' => fn() => [
    'title' => E::ts('Resource Calendar Participant'),
    'title_plural' => E::ts('Resource Calendar Participants'),
    'description' => E::ts('FIXME'),
    'log' => TRUE,
  ],
  'getFields' => fn() => [
    'id' => [
      'title' => E::ts('ID'),
      'sql_type' => 'int unsigned',
      'input_type' => 'Number',
      'required' => TRUE,
      'description' => E::ts('Unique ResourceCalendarParticipant ID'),
      'primary_key' => TRUE,
      'auto_increment' => TRUE,
    ],
    'resource_calendar_id' => [
      'title' => E::ts('Resource Calendar ID'),
      'sql_type' => 'int unsigned',
      'input_type' => 'EntityRef',
      'description' => E::ts('FK to Resource Calendar'),
      'add' => '1.0',
      'entity_reference' => [
        'entity' => 'ResourceCalendar',
        'key' => 'id',
        'on_delete' => 'CASCADE',
      ],
    ],
    'contact_id' => [
      'title' => E::ts('Contact ID'),
      'sql_type' => 'int unsigned',
      'input_type' => 'EntityRef',
      'description' => E::ts('FK to Contact'),
      'entity_reference' => [
        'entity' => 'Contact',
        'key' => 'id',
        'on_delete' => 'CASCADE',
      ],
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
