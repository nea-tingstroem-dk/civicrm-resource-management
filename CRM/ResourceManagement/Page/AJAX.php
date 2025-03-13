<?php

/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Scripting/EmptyPHP.php to edit this template
 */

use CRM_ResourceManagement_BAO_ResourceConfiguration as C;

class CRM_ResourceManagement_Page_AJAX {

  public static function advancedEventOperations() {
    $getContactId = (int) CRM_Core_Session::singleton()->getLoggedInContactID();
    $superUser = CRM_Core_Permission::check('edit all events', $getContactId);
    if (!$superUser) {
      CRM_Utils_JSON::output('Error - not allowed for this user');
    }
    $params = json_decode(CRM_Utils_Request::retrieve('params', 'String'));
    $result = [];
    $now = date('Y-m-d H:i:s');
    switch ($params->action) {
      case 'clone_event':
        $calendarSettings = self::getResourceCalendarSettings($params->calendar_id);
        $resourceRoleId = $calendarSettings['resource_role_id'];
        $masterEvent = false;
        try {
          $masterEvent = CRM_Event_DAO_Event::findById($params->from->parent_event_id);
        } catch (Exception $ex) {
          
        }
        if (!$masterEvent) {
          $masterEvent = CRM_Event_DAO_Event::findById($params->from->id);
          $masterEvent->parent_event_id = $masterEvent->id;
          $masterEvent . save();
        }

        $masterResources = \Civi\Api4\Participant::get(TRUE)
          ->addWhere('event_id', '=', $masterEvent->id)
          ->addWhere('role_id', '=', $resourceRoleId)
          ->execute();
        $masterResource = false;
        foreach ($masterResources as $mr) {
          unset($mr['id']);
          unset($mr['event_id']);
          unset($mr['contact_id']);
          $mr['register_date'] = $now;
          $masterResource = $mr;
          break;
        }
        $masterStart = new DateTimeImmutable($masterEvent->start_date);
        $masterDate = new DateTimeImmutable($masterStart->format('Y-m-d'));
        $masterEnd = new DateTimeImmutable($masterEvent->end_date);
        $duration = $masterStart->diff(new DateTime($masterEvent->end_date));
        $offset = $masterDate->diff(new DateTime($params->start_date));
        $events = \Civi\Api4\Event::get(TRUE)
          ->addWhere('parent_event_id', '=', $params->from->parent_event_id)
          ->execute();
        $newEventParams = [];
        foreach ($events as $event) {
          unset($event['id']);
          $eventStart = new DateTimeImmutable($event['start_date']);
          $eventEnd = new DateTimeImmutable($event['end_date']);
          $event['start_date'] = $eventStart->add($offset)->format('Y-m-d H:i:s');
          $event['end_date'] = $eventEnd->add($offset)->format('Y-m-d H:i:s');

          $events = \Civi\Api4\Event::get(TRUE)
            ->addSelect('id')
            ->addJoin('Participant AS participant', 'LEFT', ['participant.event_id', '=', 'id'])
            ->addWhere('participant.contact_id', '=', $params->resource)
            ->addWhere('start_date', '=', $event['start_date'])
            ->execute();
          if ($events->count()) {
            continue;
          }
          $newEventParams[] = $event;
        }
        $newEvents = CRM_Event_DAO_Event::writeRecords($newEventParams);
        $newResourceParams = [];
        foreach ($newEvents as $newEvent) {
          $newResourceParams[] = array_merge($masterResource, [
            'contact_id' => $params->resource,
            'event_id' => $newEvent->id,
          ]);
        }
        $newResources = CRM_Event_DAO_Participant::writeRecords($newResourceParams);
        $result[] = [
          'events' => $newEvents,
          'participants' => $newResources,
        ];

        break;
      case 'add_participants':

        $event = CRM_Event_DAO_Event::findById($params->event_id);
        $existingParticipants = [];
        $pRequest = \Civi\Api4\Participant::get(TRUE)
          ->addSelect('contact_id')
          ->addSelect('event_id')
          ->addSelect('contact_id')
          ->addSelect('register_date')
          ->addWhere('event_id', '=', $params->event_id);
        foreach ($params->mappings as $m) {
          if ($m->target) {
            $pRequest->addSelect($m->target);
          }
        }

        $participants = $pRequest->execute();
        foreach ($participants as $newResources) {
          $existingParticipants[$newResources['contact_id']] = $newResources;
        }
        foreach ($params->contacts as $contact) {
          $changed = false;
          $participant = [];
          if (isset($existingParticipants[$contact->id])) {
            $participant = $existingParticipants[$contact->id];
          } else {
            $participant = [
              'contact_id' => $contact->id,
              'event_id' => $params->event_id,
              'register_date' => $now,
            ];
            $changed = true;
          }
          $c = (array) $contact;
          foreach ($params->mappings as $m) {
            if ("{$c[$m->input_field]}" !== "{$participant[$m->target]}") {
              $participant[$m->target] = $c[$m->input_field];
              $changed = true;
            }
          }

          if ($changed) {
            if (isset($participant['id'])) {
              $op = 'update';
            } else {
              $op = 'create';
            }
            $res = civicrm_api4('Participant', $op, [
              'values' => $participant,
              'checkPermissions' => TRUE,
            ]);
            $result[] = $res;
          }
        }

        break;
      case 'parse_pasted';
        $lines = explode("\n", $params->pasted);
        $columnNames = explode("\t", $lines[0]);
        $externalIndex = -1;
        $emailIndex = -1;
        for ($i = 0; $i < count($columnNames); $i++) {
          $colName = trim($columnNames[$i]);
          switch (strtolower($colName)) {
            case 'konto':
              $externalIndex = $i;
//          $fieldName = 'external_identifier';
              break;
            case 'email':
              $emailIndex = $i;
//          $fieldName = 'email_primary.email';
              break;

            default:
              break;
          }
        }
        $inList = [];
        $outList = [];
        for ($j = 1; $j < count($lines); $j++) {
          $line = trim($lines[$j]);
          if (strlen($line) === 0) {
            continue;
          }
          $fields = explode("\t", $line);
          if ($externalIndex >= 0) {
            $contacts = \Civi\Api4\Contact::get(TRUE)
              ->addSelect('id', 'external_identifier', 'display_name')
              ->addWhere('external_identifier', '=', $fields[$externalIndex])
              ->execute();
            if ($contacts->rowCount) {
              $c = $contacts->first();
              $inList[] = array_merge($c, array_combine($columnNames, $fields));
              continue;
            }
          }
          if ($emailIndex >= 0) {
            $contacts = \Civi\Api4\Contact::get(TRUE)
              ->addSelect('external_identifier', 'display_name')
              ->addWhere('email_primary.email', '=', $fields[$emailIndex])
              ->execute();
            if ($contacts->rowCount) {
              $inList[$contacts->first()['id']] = array_merge($contacts->first(), $fields);
              continue;
            }
          }
          $outList[] = array_combine($columnNames, $fields);
        }
        $result = [
          'found_headers' => array_merge(['Contact id', 'External ID', 'Name'], $columnNames),
          'found' => $inList,
          'not_found_headers' => $columnNames,
          'not_found' => $outList,
          'columns' => $columnNames,
        ];
        break;
      case 'delete':
        if (is_array($params->event_id)) {
          $eventIds = $params->event_id;
        } else {
          $eventIds = [$params->event_id];
        }
        foreach ($eventIds as $eId) {
          $event = CRM_Event_BAO_Event::findById($eId);
          if ($event) {
            $event->delete();
          }
        }
        break;
      case 'repeat':
        $calendarSettings = self::getResourceCalendarSettings($params->calendar_id);
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
          $responsible = CRM_Event_BAO_Participant::findById($params->responsible_participant_id);
        }
        $i = 0;
        $newEvents = [];
        $copyEvent = CRM_Event_BAO_Event::findById($params->event_id);
        foreach ($params->dates as $date) {
          $i++;
          $newEvent = $event->toArray();
          unset($newEvent['id']);
          $newEvent['title'] = $params->new_title;
          $start = new DateTimeImmutable($date);
          $newEvent['start_date'] = $start->format("Y-m-d H:i:s");
          $end = $start->add($duration);
          $newEvent['end_date'] = $end->format("Y-m-d H:i:s");
          $newEvent['parent_event_id'] = $event->parent_event_id;
          $newEvents[] = $newEvent;
        }
        $insertedEvents = CRM_Event_BAO_Event::writeRecords($newEvents);
        $par = [];
        foreach ($insertedEvents as $newEvent) {
          $eventList[$newEvent->id] = $newEvent->title;
          $pr = get_object_vars($resource);
          unset($pr['id']);
          $pr['event_id'] = $newEvent->id;
          $par[] = $pr;
          if ($responsible) {
            $pr = get_object_vars($responsible);
            unset($pr['id']);
            $pr['event_id'] = $newEvent->id;
            $par[] = $pr;
          }
        }
        $pRes = CRM_Event_BAO_Participant::writeRecords($par);
        $result['events'] = $eventList;

        break;

      default:
        break;
    }
    CRM_Utils_JSON::output($result);
  }

  public static function getEvents() {
    $getContactId = (int) CRM_Core_Session::singleton()->getLoggedInContactID();
    $superUser = CRM_Core_Permission::check('edit all events', $getContactId);

    $calendarId = CRM_Utils_Request::retrieve('calendar_id', 'Integer');
    $settings = self::getResourceCalendarSettings($calendarId);

    $whereCondition = '';
    $resources = $settings['resources'];
    $filter = CRM_Utils_Request::retrieve('filter', 'Integer');

    if ($filter) {
      $whereCondition .= " AND p.contact_id = {$filter}";
    } else if (!empty($resources)) {
      $contactList = implode(',', array_keys($resources));
      $whereCondition .= " AND p.contact_id in ({$contactList})";
    }
    $start = CRM_Utils_Request::retrieve('start', 'String');
    $end = CRM_Utils_Request::retrieve('end', 'String');
    $whereCondition .= " AND ((e.start_date BETWEEN '{$start}' AND '{$end}')";
    $whereCondition .= " OR  (e.end_date BETWEEN '{$start}' AND '{$end}')";
    $whereCondition .= " OR  (e.start_date <= '{$start}' AND e.end_date >= '{$end}'))";

    //Show/Hide Public Events
    if (!empty($settings['event_is_public'])) {
      $whereCondition .= " AND e.is_public = 1";
    }

    $resourceRoleId = isset($settings['resource_role_id']) ? $settings['resource_role_id'] : null;
    $responsibleRoleId = isset($settings['host_role_id']) ? $settings['host_role_id'] : null;

    $eventsGet = \Civi\Api4\Event::get(FALSE)
      ->addSelect('id', 'title', 'start_date', 'end_date',
        'ph.contact_id', 'ph.status_id:label',
        'pr.contact_id', 'pr.status_id',
        'res.display_name',
        'host.id',
        'host.display_name',
        'host.external_identifier')
      ->addJoin('Participant AS pr', 'INNER', ['id', '=', 'pr.event_id'])
      ->addJoin('Participant AS ph', 'LEFT', ['id', '=', 'ph.event_id'], ['ph.role_id', '=', $responsibleRoleId])
      ->addJoin('Contact AS res', 'LEFT', ['pr.contact_id', '=', 'res.id'])
      ->addJoin('Contact AS host', 'LEFT', ['ph.contact_id', '=', 'host.id'])
      ->addWhere('pr.role_id', '=', $resourceRoleId)
      ->addClause('OR',
      ['start_date', 'BETWEEN', [$start, $end]],
      ['end_date', 'BETWEEN', [$start, $end]],
      ['AND',
        [
          ['start_date', '<', $start], ['end_date', '>', $end]
        ]
    ]);
    if ($filter) {
      $eventsGet->addWhere('pr.contact_id', '=', $filter);
    } else if (!empty($resources)) {
      $eventsGet->addWhere('pr.contact_id', 'IN', array_keys($resources));
    }
    //Show/Hide Public Events
    if (!empty($settings['event_is_public'])) {
      $eventsGet->addWhere('e.is_public', '=', 1);
    }

    $events = [];
    $eventsArray = $eventsGet->execute();
    foreach ($eventsArray as $event) {
      $eventData = array();
      if ($superUser) {
        $eventData['url'] = "civicrm/book-resource?calendar_id={$calendarId}&event_id={$event['id']}&snippet=json";
      } else {
        $eventData['url'] = "/civicrm/resource/show-responsible?reset=1&cid={$event['host.id']}";
      }

      $eventData['title'] = "{$event['title']}";
      $eventData['start'] = str_replace(' ', 'T', $event['start_date']);
      $eventData['end'] = str_replace(' ', 'T', $event['end_date']);

      if (isset($settings['status_colors'][$event['pr.status_id']])) {
        $color = $settings['status_colors'][$event['pr.status_id']];
      }
      if (isset($eventData['backgroundColor'])) {
        $eventData['backgroundColor'] = "#{$color}";
        $eventData['textColor'] = self::_getContrastTextColor($eventData['backgroundColor']);
      }
      $eventData['allDay'] = false;
      $eventData['title'] .= "<br >{$event['res.display_name']}" .
        "<br >{$event['host.external_identifier']} {$event['host.display_name']}";
      if ($superUser) {
        $eventData['title'] .= "<br >{$event['ph.status_id:label']}";
      }

      $events[] = $eventData;
    }
    CRM_Utils_JSON::output($events);
  }

  public static function getPricefieldsForEvent() {
    $eId = CRM_Utils_Request::retrieve('event_id', 'Integer');
    $psId = CRM_Price_BAO_PriceSet::getFor('civicrm_event', $eId);
    $groupTree = CRM_Price_BAO_PriceSet::getSetDetail($psId);
    $result = [];
    foreach ($groupTree[$psId]['fields'] as $pfId => $pField) {
      $result[$pfId] = $pField['label'];
    }
    CRM_Utils_JSON::output($result);
  }

  public static function getResourceCalendarSettings($calendarId) {
    $settings = [];
    $statuses = array();
    $resources = array();
    $status_labels = [];

    if ($calendarId) {
      $settings = CRM_ResourceManagement_BAO_ResourceCalendarSettings::getAllSettings($calendarId);
      $settings['calendar_id'] = $calendarId;
      $sql = "SELECT c.*, t.label FROM civicrm_resource_calendar c
                LEFT JOIN `civicrm_contact_type` t on t.name = c.calendar_type
                WHERE c.`id` = {$calendarId};";
      $dao = CRM_Core_DAO::executeQuery($sql);
      while ($dao->fetch()) {
        $s = (array) $dao;
        $settings['calendar_title'] = $dao->calendar_title;
        $settings['calendar_type'] = $dao->calendar_type;
      }
      $sql = "SELECT p.*,c.display_name 
                    FROM civicrm_resource_calendar_participant p
                    LEFT JOIN civicrm_contact c on c.id=p.contact_id
                    WHERE `resource_calendar_id` = {$calendarId};";
      $dao = CRM_Core_DAO::executeQuery($sql);
      while ($dao->fetch()) {
        $resources[] = $dao->toArray();
      }
      $sql = "SELECT p.*,c.display_name 
                    FROM civicrm_resource_calendar_participant p
                    LEFT JOIN civicrm_contact c on c.id=p.contact_id
                    WHERE `resource_calendar_id` = {$calendarId};";
      $dao = CRM_Core_DAO::executeQuery($sql);
      while ($dao->fetch()) {
        $resources[] = $dao->toArray();
      }
      $sql = "SELECT c.status_id, c.event_color, t.label
                    FROM `civicrm_resource_calendar_color` c
                    LEFT JOIN `civicrm_participant_status_type` t on t.id = c.status_id
                    WHERE calendar_id = {$calendarId}";
      $dao = CRM_Core_DAO::executeQuery($sql);
      while ($dao->fetch()) {
        $statuses[$dao->status_id] = $dao->event_color;
        $status_labels[$dao->status_id] = $dao->label;
      }
    } elseif ($calendarId == 0) {
      $settings['calendar_title'] = 'Event Calendar';
      $settings['event_is_public'] = 1;
      $settings['event_past'] = 1;
      $settings['enrollment_status'] = 1;
    }

    if (!empty($resources)) {
      foreach ($resources as $resource) {
        $settings['resources'][$resource['contact_id']] = $resource['display_name'];
      }
    }
    $settings['status_colors'] = $statuses;
    $settings['status_labels'] = $status_labels;

    return $settings;
  }

  /*
   * Return contrast color on the basis the hex color passed
   *
   * Referred from https://stackoverflow.com/questions/1331591
   */

  static function _getContrastTextColor($hexColor) {
    // hexColor RGB
    $R1 = hexdec(substr($hexColor, 1, 2));
    $G1 = hexdec(substr($hexColor, 3, 2));
    $B1 = hexdec(substr($hexColor, 5, 2));

    // Black RGB
    $blackColor = "#000000";
    $R2BlackColor = hexdec(substr($blackColor, 1, 2));
    $G2BlackColor = hexdec(substr($blackColor, 3, 2));
    $B2BlackColor = hexdec(substr($blackColor, 5, 2));

    // Calc contrast ratio
    $L1 = 0.2126 * pow($R1 / 255, 2.2) +
      0.7152 * pow($G1 / 255, 2.2) +
      0.0722 * pow($B1 / 255, 2.2);

    $L2 = 0.2126 * pow($R2BlackColor / 255, 2.2) +
      0.7152 * pow($G2BlackColor / 255, 2.2) +
      0.0722 * pow($B2BlackColor / 255, 2.2);

    $contrastRatio = 0;
    if ($L1 > $L2) {
      $contrastRatio = (int) (($L1 + 0.05) / ($L2 + 0.05));
    } else {
      $contrastRatio = (int) (($L2 + 0.05) / ($L1 + 0.05));
    }

    // If contrast is more than 5, return black color
    if ($contrastRatio > 5) {
      return '#000000';
    } else {
      // if not, return white color.
      return '#FFFFFF';
    }
  }

}
