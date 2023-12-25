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

        $resourceRoleId = $settings['resource_role_id'];
        $responsibleRoleId = $settings['host_role_id'];

        $eventsGet = \Civi\Api4\Event::get(FALSE)
                ->addSelect('id', 'title', 'start_date', 'end_date',
                        'ph.contact_id', 'ph.status_id:label',
                        'pr.contact_id', 'pr.status_id',
                        'res.display_name',
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

        $eventCalendarParams = array('title' => 'title',
            'start_date' => 'start',
            'end_date' => 'end');
        $events = [];
        $eventsArray = $eventsGet->execute();
        foreach ($eventsArray as $event) {
            $eventData = array();
            if ($superUser) {
                $eventData['url'] = "civicrm/book-resource?calendar_id={$calendarId}&event_id={$event['id']}&snippet=json";
            } else {
                $eventData['url'] = "event/info?id={$event['id']}";
            }

            foreach ($eventCalendarParams as $from => $to) {
                $eventData[$to] = $event[$from];
            }
            $color = $settings['status_colors'][$event['pr.status_id']];
            $eventData['backgroundColor'] = "#{$color}";
            $eventData['textColor'] = self::_getContrastTextColor($eventData['backgroundColor']);
            $eventData['title'] .= "\n" . $event['res.display_name'] .
                    "\n" . $event['host.external_identifier'] . ' ' . 
                    $event['host.display_name'];
            if ($superUser) {
                $eventData['title'] .= "\n" . $event['ph.status_id:label'];
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
