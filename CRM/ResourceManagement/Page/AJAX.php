<?php

/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Scripting/EmptyPHP.php to edit this template
 */
use CRM_ResourceManagement_BAO_ResourceConfiguration as C;

class CRM_ResourceManagement_Page_AJAX {

    public static function getEvents() {
        $getContactId = (int) CRM_Core_Session::singleton()->getLoggedInContactID();
        $superUser = CRM_Core_Permission::check('edit all events', $getContactId);

        $events = [];

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

        $query = "
                SELECT DISTINCT e.`id` id, e.`title`, e.`start_date` start, e.`end_date` end
                FROM `civicrm_event` e
                LEFT JOIN `civicrm_participant` p ON p.event_id = e.id
                WHERE e.is_active = 1
                  AND e.is_template = 0
                ";

        $query .= $whereCondition;

        $dao = CRM_Core_DAO::executeQuery($query);
        $eventCalendarParams = array('title' => 'title', 'start' => 'start', 'end' => 'end', 'url' => 'url');
        $resourceRoleId = C::getConfig('resource_role_id');
        $responsibleRoleId = C::getConfig('host_role_id');

        while ($dao->fetch()) {
            $eventData = array();
            if ($superUser) {
                $dao->url = 'civicrm/book-resource?event_id=' . $dao->id ?: NULL;
            } else {
                $dao->url = 'event/info?id=' . $dao->id ?: NULL;
            }
            
            foreach ($eventCalendarParams as $k) {
                $eventData[$k] = $dao->$k;
            }
            $pSql = "SELECT p.`contact_id`, c.display_name, p.role_id, p.status_id
                FROM `civicrm_participant` p
                LEFT JOIN `civicrm_contact`c on c.id=p.contact_id
                WHERE p.event_id ={$dao->id}
                    AND p.role_id in ({$resourceRoleId},{$responsibleRoleId})
                ";
            $pDao = CRM_Core_DAO::executeQuery($pSql);
            $resource_names = '';
            $resp_name = '';
            while ($pDao->fetch()) {
                if ($pDao->role_id == $resourceRoleId) {
                    $eventData['backgroundColor'] = "#{$settings['status_colors'][$pDao->status_id]}";
                    $eventData['textColor'] = self::_getContrastTextColor($eventData['backgroundColor']);
                    if (!empty($resource_names)) {
                        $resource_names .= ", "; 
                    }
                    $resource_names .= $pDao->display_name;
                } else {
                    $resp_name = $pDao->display_name;
                }
            }
            $eventData['title'] .= "\n" . $resource_names . "\n" . $resp_name;
            $enrollment_status = civicrm_api3('Event', 'getsingle', [
                'return' => ['is_full'],
                'id' => $dao->id,
            ]);

            // Show/Hide enrollment status
            if (!empty($settings['enrollment_status'])) {
                if (!(isset($enrollment_status['is_error'])) && ( $enrollment_status['is_full'] == "1" )) {
                    $eventData['url'] = '';
                    $eventData['title'] .= ' FULL';
                }
            }
            $events[] = $eventData;
        }

        CRM_Utils_JSON::output($events);
    }

    public static function getResourceCalendarSettings($calendarId) {
        $settings = array();
        $statuses = array();
        $resources = array();
        $status_labels = [];

        if ($calendarId) {
            $settings['calendar_id'] = $calendarId;
            $sql = "SELECT c.*, t.label FROM civicrm_resource_calendar c
                LEFT JOIN `civicrm_contact_type` t on t.name = c.calendar_type
                WHERE c.`id` = {$calendarId};";
            $dao = CRM_Core_DAO::executeQuery($sql);
            while ($dao->fetch()) {
                $s = (array) $dao;
                $settings['calendar_title'] = $dao->calendar_title;
                $settings['calendar_type'] = $dao->calendar_type;
                $settings['calendar_type_label'] = $dao->label;
                $settings['event_past'] = $dao->show_past_events;
                $settings['event_end_date'] = $dao->show_end_date;
                $settings['event_is_public'] = $dao->show_public_events;
                $settings['event_month'] = $dao->events_by_month;
                $settings['event_from_month'] = $dao->events_from_month;
                $settings['event_time'] = $dao->event_timings;
                $settings['event_event_type_filter'] = $dao->event_type_filters;
                $settings['time_format_24_hour'] = $dao->time_format_24_hour;
                $settings['week_begins_from_day'] = $dao->week_begins_from_day;
                $settings['recurring_event'] = $dao->recurring_event;
                $settings['enrollment_status'] = $dao->enrollment_status;
                $settings['event_template'] = $dao->event_template;
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
  function _getContrastTextColor($hexColor){
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
      $contrastRatio = (int)(($L1 + 0.05) / ($L2 + 0.05));
    } else {
      $contrastRatio = (int)(($L2 + 0.05) / ($L1 + 0.05));
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
