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
    public static function getConfig($key) {
        $config = new self();
        $config->config_key = $key;
        $config->find();
        if ($config->fetch()) {
            return $config->config_value;
        }
        return false;
    }

    public static function getAllConfigs() {
        $config = new self();
        if ($config->find()) {
            $result = [];
            while ($config->fetch()) {
                $result[$config->config_key] = $config->config_value;
            }
            return $result;
        }
        return false;
    }

    public static function setConfigs($values) {
        foreach ($values as $key => $value) {
            $config = new self();
            $config->config_key = $key;
            if ($config->find(true)) {
                if ($config->config_value !== $value) {
                    $config->config_value = $value;
                    $config->save();
                }
            } else {
                $params = [
                    'config_key' => $key,
                    'config_value' => $value,
                ];
                $config->create($params);
                $config->save();
            }
        }
        $result = [];
        while ($config->fetch()) {
            $result[$config->config_key] = $config->config_value;
        }
        return $result;
    }

}
