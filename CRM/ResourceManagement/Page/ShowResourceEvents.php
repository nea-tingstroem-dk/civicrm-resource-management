<?php

use CRM_ResourceManagement_ExtensionUtil as E;

class CRM_ResourceManagement_Page_ShowResourceEvents extends CRM_Core_Page {

  public function run() {
    $url = CRM_Utils_Request::retrieve('IDS_request_uri', 'String');
    $getContactId = (int) CRM_Core_Session::singleton()->getLoggedInContactID();
    if ($getContactId === 0) {
      CRM_Utils_System::redirect('/user/login?destination=' . $url);
      return;
    }
    CRM_Core_Session::singleton()->pushUserContext($url);
    Civi::resources()->addScriptFile('resource-management', 'js/moment.js', ['weight' => 5]);
    Civi::resources()->addScriptFile('resource-management', 'js/index.global.min.js', ['weight' => 10]);

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
    if (count($settings['resources']) > 1) {
      $resources[0] = E::ts('All');
    }    
    foreach ($settings['resources'] as $id => $title) {
      $resources[$id] = $title;
    }
    $this->assign('page_title', $settings['calendar_title']);
    $this->assign('resource_list', $resources);
    $this->assign('calendar_id', $calendarId);
    $this->assign('time_display', !empty($settings['event_time']) ?: 'false');
    $this->assign('displayEventEnd', $settings['event_end_date'] ?? 0);

    $weekBegins = 0;
    //Check weekBegin settings from calendar configuration
    if (isset($settings['week_begins_day']) && $settings['week_begins_day'] == 1) {
      //Get existing setting for weekday from civicrm start & set into event calendar.
      $weekBegins = Civi::settings()->get('weekBegins') ?? 0;
    }
    $this->assign('weekBeginDay', $weekBegins);
    $this->assign('scroll', "'{$settings['scroll']}'");

    $this->assign('use24Hour', isset($settings['time_format_24_hour']) ?
        $settings['time_format_24_hour'] : 0);
    parent::run();
  }

}
