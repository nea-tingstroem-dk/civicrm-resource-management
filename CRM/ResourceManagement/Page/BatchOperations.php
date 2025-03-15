<?php

require_once 'CRM/Core/Page.php';

use CRM_ResourceManagement_ExtensionUtil as E;

class CRM_ResourceManagement_Page_BatchOperations extends CRM_Core_Page {

  function run() {
    $queueName = E::QUEUE_NAME . time();
    $getContactId = (int) CRM_Core_Session::singleton()->getLoggedInContactID();
    $superUser = CRM_Core_Permission::check('edit all events', $getContactId);
    if (!$superUser) {
      CRM_Utils_JSON::output('Error - not allowed for this user');
    }
    $params = json_decode(CRM_Utils_Request::retrieve('params', 'String'));

    $queue = Civi::queue($queueName, [
        'type' => 'Sql',
        'runner' => 'task',
        'error' => 'abort',
    ]);

    switch ($params->action) {
      case 'repeat':
        $this->CreateRepeatItems($queue, $params);
        break;
    }

    \Civi\Api4\UserJob::create()->setValues([
      'job_type' => 'contact_import',
      'status_id:name' => 'in_progress',
      'queue_id.name' => $queue->getName(),
    ])->execute();

    $runner = new CRM_Queue_Runner([
      'title' => $params->title,
      'queue' => $queue,
      'onEndUrl' => $params->ret_url,
    ]);
    $runner->runAllViaWeb(); // does not return
  }

  /**
   * Perform some business logic
   * @param \CRM_Queue_TaskContext $ctx
   * @param $delay
   * @param $message
   * @return bool
   */
  static function doSaveEvent(CRM_Queue_TaskContext $ctx, $newEvent, $resource, $responsible) {
    $insertedEvent = CRM_Event_BAO_Event::writeRecord($newEvent);
    $resource['event_id'] = $insertedEvent->id;
    $par = [$resource];
    if ($responsible) {
      $responsible['event_id'] = $insertedEvent->id;
      $par[] = $responsible;
    }
    $pRes = CRM_Event_BAO_Participant::writeRecords($par);
    return TRUE;
  }

  /**
   * Handle the final step of the queue
   * @param \CRM_Queue_TaskContext $ctx
   */
  static function onEnd(CRM_Queue_TaskContext $ctx) {
    //CRM_Utils_System::redirect('civicrm/demo-queue/done');
    CRM_Core_Error::debug_log_message('finished task');
    //$ctx->logy->info($message); // PEAR Log interface -- broken, PHP error
    //CRM_Core_DAO::executeQuery('select from alsdkjfasdf'); // broken, PEAR error
    //throw new Exception('whoz'); // broken, exception
  }

  public function CreateRepeatItems($queue, $params) {

    /*
     * Parameter when called from
      var params = {
      action: 'repeat',
      calendar_id: $scope.calendar_id,
      event_id: $scope.masterEventId,
      new_title: $scope.newTitle,
      resource_participant_id: $scope.masterEvent['p_res.id'],
      responsible_participant_id: $scope.masterEvent['p_resp.id'],
      dates: $scope.expandDates();
      };
     */
    $calendarSettings = CRM_ResourceManagement_Page_AJAX::getResourceCalendarSettings($params->calendar_id);
    $resourceRoleId = $calendarSettings['resource_role_id'];
    $event = CRM_Event_BAO_Event::findById($params->event_id);
    if (!$event->parent_event_id || $event->parent_event_id != $event->id) {
      $event->parent_event_id = $event->id;
      $event->save();
    }
    $masterResources = \Civi\Api4\Participant::get(TRUE)
      ->addWhere('event_id', '=', $event->id)
      ->addWhere('role_id', '=', $resourceRoleId)
      ->execute();
    $masterResource = false;
    $now = new DateTime();
    foreach ($masterResources as $mr) {
      unset($mr['id']);
      unset($mr['event_id']);
      unset($mr['contact_id']);
      $mr['register_date'] = $now;
      $masterResource = $mr;
      break;
    }

    $duration = date_diff(new DateTimeImmutable($event->start_date), new DateTimeImmutable($event->end_date));
    $resource = CRM_Event_BAO_Participant::findById($params->resource_participant_id);
    $eventList = [];
    $responsible = false;
    if ($params->responsible_participant_id) {
      $responsible = $params->responsible_participant_id;
    }



    foreach ($params->dates as $date) {
      $newEvent = $event->toArray();
      unset($newEvent['id']);
      $newEvent['title'] = $params->new_title;
      $start = new DateTimeImmutable($date);
      $newEvent['start_date'] = $start->format("Y-m-d H:i:s");
      $end = $start->add($duration);
      $newEvent['end_date'] = $end->format("Y-m-d H:i:s");
      $newEvent['parent_event_id'] = $event->parent_event_id;

      $res = get_object_vars($resource);
      unset($res['id']);
      unset($res['event_id']);
      $resp = false;
      if ($responsible) {
        $resp = get_object_vars($responsible);
        unset($resp['id']);
        unset($resp['event_id']);
      }

      $queue->createItem(new CRM_Queue_Task(
          ['CRM_ResourceManagement_Page_BatchOperations', 'doSaveEvent'], // callback
          [
          $newEvent,
          $res,
          $resp,
          ], // arguments
          "Save Event at {$newEvent['start_date']}" // title
      ));
    }
//    $insertedEvents = CRM_Event_BAO_Event::writeRecords($newEvents);
//    $par = [];
//    foreach ($insertedEvents as $newEvent) {
//      $eventList[$newEvent->id] = $newEvent->title;
//      $pr = get_object_vars($resource);
//      unset($pr['id']);
//      $pr['event_id'] = $newEvent->id;
//      $par[] = $pr;
//      if ($responsible) {
//        $pr = get_object_vars($responsible);
//        unset($pr['id']);
//        $pr['event_id'] = $newEvent->id;
//        $par[] = $pr;
//      }
//    }
//    $pRes = CRM_Event_BAO_Participant::writeRecords($par);
//    $result['events'] = $eventList;
  }

}
