<?php

/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Scripting/EmptyPHP.php to edit this template
 */

class CRM_ResourceManagement_Page_AJAX {

    public static function getEvents() {
        $events = [];

        $calendarId = isset($_GET['calendar_id']) ? $_GET['calendar_id'] : '';
        $settings = self::getResourceCalendarSettings($calendarId);

        $whereCondition = '';
        $filter = (int) ($_GET['filter'] ?? 0);

        if ($filter) {
            $whereCondition .= " AND p.contact_id = {$filter}";
        } else {
            $resources = $settings['resources'];

            if (!empty($resources)) {
                $contactList = implode(',', array_keys($resources));
                $whereCondition .= " AND p.contact_id in ({$contactList})";
            }
        }
        $whereCondition .= " AND e.start_date >= '{$_GET['start']}'";
        $whereCondition .= " AND e.start_date <= '{$_GET['end']}'";

        //Show/Hide Public Events
        if (!empty($settings['event_is_public'])) {
            $whereCondition .= " AND e.is_public = 1";
        }

        $query = "
                SELECT e.`id` id, e.`title`, e.`start_date` start, e.`end_date` end, p.`contact_id`, c.display_name
                FROM `civicrm_event` e
                LEFT JOIN `civicrm_participant` p ON p.event_id = e.id
                LEFT JOIN `civicrm_contact`c on c.id=p.contact_id
                WHERE e.is_active = 1
                  AND e.is_template = 0
                ";

        $query .= $whereCondition;

        $dao = CRM_Core_DAO::executeQuery($query);
        $eventCalendarParams = array('title' => 'title', 'start' => 'start', 'url' => 'url');

        if (!empty($settings['event_end_date'])) {
            $eventCalendarParams['end'] = 'end';
        }

        while ($dao->fetch()) {
            $eventData = array();
            $dao->url = html_entity_decode(CRM_Utils_System::url('civicrm/event/info', 'id=' . $dao->id ?: NULL));
            foreach ($eventCalendarParams as $k) {
                $eventData[$k] = $dao->$k;
            }
            if (!empty($resources)) {
                $eventData['backgroundColor'] = "#{$resources[$dao->contact_id]}";
                $eventData['textColor'] = CRM_EventCalendar_Page_ShowEvents::_getContrastTextColor($eventData['backgroundColor']);
                $eventData['title'] .= "\n" . $dao->display_name;
            } else if (!empty($eventTypes)) {
                $eventData['backgroundColor'] = "#{$eventTypes[$dao->event_type]}";
                $eventData['textColor'] = CRM_EventCalendar_Page_ShowEvents::_getContrastTextColor($eventData['backgroundColor']);
                $eventData['eventType'] = $civieventTypesList[$dao->event_type];
            } elseif ($calendarId == 0) {
                $eventData['backgroundColor'] = "";
                $eventData['textColor'] = CRM_EventCalendar_Page_ShowEvents::_getContrastTextColor($eventData['backgroundColor']);
                $eventData['eventType'] = $civieventTypesList[$dao->event_type];
            }

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

        if ($calendarId) {
            $settings['calendar_id'] = $calendarId;
            $sql = "SELECT * FROM civicrm_resource_calendar WHERE `id` = {$calendarId};";
            $dao = CRM_Core_DAO::executeQuery($sql);
            while ($dao->fetch()) {
                $s = (array) $dao;
                $settings['calendar_title'] = $dao->calendar_title;
                $settings['calendar_type'] = $dao->calendar_type;
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
            $eventTypes = array();
            $resources = array();
            $sql = "SELECT p.*,c.display_name 
                    FROM civicrm_resource_calendar_participant p
                    LEFT JOIN civicrm_contact c on c.id=p.contact_id
                    WHERE `resource_calendar_id` = {$calendarId};";
            $dao = CRM_Core_DAO::executeQuery($sql);
            while ($dao->fetch()) {
                $resources[] = $dao->toArray();
            }
        } elseif ($calendarId == 0) {
            $settings['calendar_title'] = 'Event Calendar';
            $settings['event_is_public'] = 1;
            $settings['event_past'] = 1;
            $settings['enrollment_status'] = 1;
        }

        if (!empty($eventTypes)) {
            foreach ($eventTypes as $eventType) {
                $settings['event_types'][$eventType['event_type']] = $eventType['event_color'];
            }
        }
        if (!empty($resources)) {
            foreach ($resources as $resource) {
                $settings['resources'][$resource['contact_id']] = $resource['event_color'];
                $settings['resource_titles'][$resource['contact_id']] = $resource['display_name'];
            }
        }

        return $settings;
    }

}
