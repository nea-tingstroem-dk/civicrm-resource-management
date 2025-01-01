<?php
use CRM_ResourceManagement_ExtensionUtil as E;
return [
  'name' => 'ResourceConfiguration',
  'table' => 'civicrm_resource_configuration',
  'class' => 'CRM_ResourceManagement_DAO_ResourceConfiguration',
  'getInfo' => fn() => [
    'title' => E::ts('Resource Configuration'),
    'title_plural' => E::ts('Resource Configurations'),
    'description' => E::ts('FIXME'),
    'log' => TRUE,
  ],
  'getIndices' => fn() => [
    'index_config_key' => [
      'fields' => [
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
      'description' => E::ts('Unique ResourceConfiguration ID'),
      'primary_key' => TRUE,
      'auto_increment' => TRUE,
    ],
    'config_key' => [
      'title' => E::ts('Config Key'),
      'sql_type' => 'varchar(20)',
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
