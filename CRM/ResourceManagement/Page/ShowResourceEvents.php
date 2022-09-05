<?php

use CRM_ResourceManagement_ExtensionUtil as E;

class CRM_ResourceManagement_Page_ShowResourceEvents extends CRM_Core_Page {

    public function run() {
        $url = CRM_Utils_Request::retrieve('IDS_request_uri', 'String');
        CRM_Core_Session::singleton()->pushUserContext($url);
        CRM_Core_Resources::singleton()->addScriptFile('resource-management', 'js/moment.js', 5);
        CRM_Core_Resources::singleton()->addScriptFile('resource-management', 'js/fullcalendar/fullcalendar.js', 10);
        CRM_Core_Resources::singleton()->addScriptFile('resource-management', 'js/fullcalendar/locale/da.js', 15);
        CRM_Core_Resources::singleton()->addStyleFile('resource-management', 'css/civicrm_events.css');
        CRM_Core_Resources::singleton()->addStyleFile('resource-management', 'css/fullcalendar.css');

        $getContactId = (int) CRM_Core_Session::singleton()->getLoggedInContactID();
        $superUser = CRM_Core_Permission::check('edit all events', $getContactId) ?: 0;
        $this->assign('is_admin', $superUser);
        $civieventTypesList = CRM_Event_PseudoConstant::eventType();

        $config = CRM_Core_Config::singleton();
        //get settingss
        $calendarId = isset($_GET['id']) ? $_GET['id'] : false;
        if (!$calendarId) {
            return;
        }
        $settings = CRM_ResourceManagement_Page_AJAX::getResourceCalendarSettings($calendarId);
        //set title from settings; allow empty value so we don't duplicate titles
        CRM_Utils_System::setTitle(ts($settings['calendar_title']));

        $resources = [];
        foreach ($settings['resources'] as $id => $title) {
            $resources[] = [
                'id' => $id,
                'title' => $title
            ];
        }
        $this->assign('resources', $resources);
        $this->assign('calendar_id', $calendarId);
        $this->assign('time_display', !empty($settings['event_time']) ?: 'false');
        $this->assign('displayEventEnd', $settings['event_end_date']);

        //Check weekBegin settings from calendar configuration
        if (isset($settings['week_begins_from_day']) && $settings['week_begins_from_day'] == 1) {
            //Get existing setting for weekday from civicrm start & set into event calendar.
            $weekBegins = Civi::settings()->get('weekBegins');
        }
        $weekBegins = $weekBegins ? $weekBegins : 0;
        $this->assign('weekBeginDay', $weekBegins);

        $this->assign('use24Hour', isset($settings['time_format_24_hour']) ?
                        $settings['time_format_24_hour'] : false);
        parent::run();
    }

}
