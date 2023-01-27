<?php

use CRM_ResourceManagement_ExtensionUtil as E;

/**
 * Collection of upgrade steps.
 */
class CRM_ResourceManagement_Upgrader extends CRM_Extension_Upgrader_Base {
    // By convention, functions that look like "function upgrade_NNNN()" are
    // upgrade tasks. They are executed in order (like Drupal's hook_update_N).

    /**
     * Make sure that resource status values are present
     */
    public function install() {
        $statusValues = [
            'Tentative' => 'Waiting', 
            'Accepted' => 'Positive', 
            'Rejected' => 'Negative'
            ];
        $visibilityQuery = "SELECT v.id FROM `civicrm_option_group` g
                            LEFT JOIN `civicrm_option_value` v on v.option_group_id = g.id
                            WHERE g.name = 'visibility' AND v.name = 'public';";
        $visibilityId = CRM_Core_DAO::singleValueQuery($visibilityQuery);
        $weight = 100;
        foreach ($statusValues as $name => $class) {
            $partitianStatus = new CRM_Event_BAO_ParticipantStatusType();
            $partitianStatus->name = $name;
            $partitianStatus->find();
            if ($partitianStatus->N == 0) {
                $partitianStatus->label = $name;
                $partitianStatus->name = $name;
                $partitianStatus->class = $class;
                $partitianStatus->is_active = true;
                $partitianStatus->is_counted = false;
                $partitianStatus->visibility_id = $visibilityId;
                $partitianStatus->weight = $weight++;
                $partitianStatus->add();
                $partitianStatus->save();
            }
        }
    }

    /**
     * Example: Work with entities usually not available during the install step.
     *
     * This method can be used for any post-install tasks. For example, if a step
     * of your installation depends on accessing an entity that is itself
     * created during the installation (e.g., a setting or a managed entity), do
     * so here to avoid order of operation problems.
     */
    // public function postInstall() {
    //  $customFieldId = civicrm_api3('CustomField', 'getvalue', array(
    //    'return' => array("id"),
    //    'name' => "customFieldCreatedViaManagedHook",
    //  ));
    //  civicrm_api3('Setting', 'create', array(
    //    'myWeirdFieldSetting' => array('id' => $customFieldId, 'weirdness' => 1),
    //  ));
    // }

    /**
     * Example: Run an external SQL script when the module is uninstalled.
     */
    // public function uninstall() {
    //  $this->executeSqlFile('sql/myuninstall.sql');
    // }

    /**
     * Example: Run a simple query when a module is enabled.
     */
    // public function enable() {
    //  CRM_Core_DAO::executeQuery('UPDATE foo SET is_active = 1 WHERE bar = "whiz"');
    // }

    /**
     * Example: Run a simple query when a module is disabled.
     */
    // public function disable() {
    //   CRM_Core_DAO::executeQuery('UPDATE foo SET is_active = 0 WHERE bar = "whiz"');
    // }

    /**
     * Example: Run a couple simple queries.
     *
     * @return TRUE on success
     * @throws Exception
     */
    // public function upgrade_4200(): bool {
    //   $this->ctx->log->info('Applying update 4200');
    //   CRM_Core_DAO::executeQuery('UPDATE foo SET bar = "whiz"');
    //   CRM_Core_DAO::executeQuery('DELETE FROM bang WHERE willy = wonka(2)');
    //   return TRUE;
    // }


    /**
     * Example: Run an external SQL script.
     *
     * @return TRUE on success
     * @throws Exception
     */
    // public function upgrade_4201(): bool {
    //   $this->ctx->log->info('Applying update 4201');
    //   // this path is relative to the extension base dir
    //   $this->executeSqlFile('sql/upgrade_4201.sql');
    //   return TRUE;
    // }


    /**
     * Example: Run a slow upgrade process by breaking it up into smaller chunk.
     *
     * @return TRUE on success
     * @throws Exception
     */
    // public function upgrade_4202(): bool {
    //   $this->ctx->log->info('Planning update 4202'); // PEAR Log interface
    //   $this->addTask(E::ts('Process first step'), 'processPart1', $arg1, $arg2);
    //   $this->addTask(E::ts('Process second step'), 'processPart2', $arg3, $arg4);
    //   $this->addTask(E::ts('Process second step'), 'processPart3', $arg5);
    //   return TRUE;
    // }
    // public function processPart1($arg1, $arg2) { sleep(10); return TRUE; }
    // public function processPart2($arg3, $arg4) { sleep(10); return TRUE; }
    // public function processPart3($arg5) { sleep(10); return TRUE; }

    /**
     * Example: Run an upgrade with a query that touches many (potentially
     * millions) of records by breaking it up into smaller chunks.
     *
     * @return TRUE on success
     * @throws Exception
     */
    // public function upgrade_4203(): bool {
    //   $this->ctx->log->info('Planning update 4203'); // PEAR Log interface
    //   $minId = CRM_Core_DAO::singleValueQuery('SELECT coalesce(min(id),0) FROM civicrm_contribution');
    //   $maxId = CRM_Core_DAO::singleValueQuery('SELECT coalesce(max(id),0) FROM civicrm_contribution');
    //   for ($startId = $minId; $startId <= $maxId; $startId += self::BATCH_SIZE) {
    //     $endId = $startId + self::BATCH_SIZE - 1;
    //     $title = E::ts('Upgrade Batch (%1 => %2)', array(
    //       1 => $startId,
    //       2 => $endId,
    //     ));
    //     $sql = '
    //       UPDATE civicrm_contribution SET foobar = whiz(wonky()+wanker)
    //       WHERE id BETWEEN %1 and %2
    //     ';
    //     $params = array(
    //       1 => array($startId, 'Integer'),
    //       2 => array($endId, 'Integer'),
    //     );
    //     $this->addTask($title, 'executeSql', $sql, $params);
    //   }
    //   return TRUE;
    // }
}
