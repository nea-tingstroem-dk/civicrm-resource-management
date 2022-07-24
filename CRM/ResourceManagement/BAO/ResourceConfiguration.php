<?php
use CRM_ResourceManagement_ExtensionUtil as E;

class CRM_ResourceManagement_BAO_ResourceConfiguration extends CRM_ResourceManagement_DAO_ResourceConfiguration {

  /**
   * Create a new ResourceConfiguration based on array-data
   *
   * @param array $params key-value pairs
   * @return CRM_ResourceManagement_DAO_ResourceConfiguration|NULL
   *
  public static function create($params) {
    $className = 'CRM_ResourceManagement_DAO_ResourceConfiguration';
    $entityName = 'ResourceConfiguration';
    $hook = empty($params['id']) ? 'create' : 'edit';

    CRM_Utils_Hook::pre($hook, $entityName, CRM_Utils_Array::value('id', $params), $params);
    $instance = new $className();
    $instance->copyValues($params);
    $instance->save();
    CRM_Utils_Hook::post($hook, $entityName, $instance->id, $instance);

    return $instance;
  } */

    public static function getConfig($key){
        $config = new self();
        $config->config_key = $key;
        $config->find();
        if ($config->fetch()) {
            return $config->config_value;
        }
        return false;
    }
}
