<?php

use CRM_ResourceManagement_ExtensionUtil as E;

/**
 * Form controller class
 *
 * @see https://docs.civicrm.org/dev/en/latest/framework/quickform/
 */
class CRM_ResourceManagement_Form_EventDetails extends CRM_Core_Form {

  private $_calendarId = 0;
  private $_userId = 0;
  private $_superUser = false;
  private $_eventId = 0;
  private $_calendarSettings = null;
  private $_isParticipant = false;
  private $_isResponsible = false;
  private $_isSuperUser = false;

  public function preProcess() {
    $buttonName = $this->controller->getButtonName();
    $action = substr($buttonName, strrpos($buttonName, '_') + 1);
    $this->_userId = (int) CRM_Core_Session::singleton()->getLoggedInContactID();
    $this->_eventId = CRM_Utils_Request::retrieve('event_id', 'Integer');
    $this->_calendarId = CRM_Utils_Request::retrieve('calendar_id', 'Integer');
    $this->_calendarSettings = CRM_ResourceManagement_Page_AJAX::getResourceCalendarSettings($this->_calendarId);
    $this->_isSuperUser = CRM_Core_Permission::check('edit all events', $this->_userId);

    parent::preProcess();
  }

  /**
   * @throws \CRM_Core_Exception
   */
  public function buildQuickForm(): void {
    $responsibleContact = false;

    $events = \Civi\Api4\Event::get(TRUE)
      ->addSelect('title', 'start_date', 'end_date', 'event_type_id:label')
      ->addWhere('id', '=', 328)
      ->setLimit(25)
      ->execute();
    foreach ($events as $event) {
      CRM_Utils_System::setTitle(E::ts("Details for {$event['title']}"));
      $this->add('static', 'start_date', ts('Start'), $event['start_date']);
      $this->add('static', 'end_date', ts('End'), $event['end_date']);
      $this->add('static', 'event_type', ts('Event type'), $event['event_type_id:label']);
      break;
    }

    $participants = \Civi\Api4\Participant::get(TRUE)
      ->addSelect('contact_id.external_identifier', 'contact_id.display_name', 'role_id', 'role_id:label')
      ->addWhere('event_id', '=', 328)
      ->setLimit(25)
      ->execute();
    $resource = "";
    $host = "";
    $hostRole = "";
    $pCount = 0;
    foreach ($participants as $participant) {
      if (in_array($this->_calendarSettings['resource_role_id'], $participant['role_id'])) {
        $resource = $participant['contact_id.display_name'];
      } else if (in_array($this->_calendarSettings['host_role_id'], $participant['role_id'])) {
        $host = $participant['contact_id.external_identifier'] . ' - ' . $participant['contact_id.display_name'];
        $hostRole = $participant['role_id:label'][0];
      } else {
        $pCount++;
      }
    }
    $this->add('static', 'resource', ts('Resource'), $resource);
    $this->add('static', 'host', ts("{$hostRole}"), $host);
    $this->add('static', 'count', ts('Count'), $pCount);

    $buttons = [];
    if ($this->_isParticipant) {
      $buttons[] = [
        'type' => 'submit',
        'subName' => 'confirm',
        'name' => E::ts('Confirm'),
        'icon' => 'fa-check',
      ];
    }
    if ($this->_isSuperUser) {
      $buttons[] = [
        'type' => 'submit',
        'subName' => 'delete-event',
        'name' => E::ts('Delete'),
        'icon' => 'fa-trash',
      ];
      $buttons[] = [
        'type' => 'submit',
        'subName' => 'edit-event',
        'name' => E::ts('Edit Event'),
        'icon' => 'fa-pencil',
      ];
      $buttons[] = [
        'type' => 'submit',
        'subName' => 'advanced',
        'name' => E::ts('Advanced'),
      ];
    }
    $buttons[] = [
      'type' => 'submit',
      'subName' => 'cancellation',
      'name' => E::ts('Cancel'),
      'icon' => 'fa-times',
    ];

    $this->addButtons($buttons);
    // export form elements
    $this->assign('elementNames', $this->getRenderableElementNames());
    parent::buildQuickForm();
  }

  public function postProcess(): void {
    $buttonName = $this->controller->getButtonName();
    $action = substr($buttonName, strrpos($buttonName, '_') + 1);
    $values = $this->exportValues();
    switch ($action) {
      case 'edit-event':
        CRM_Utils_JSON::output(['openpage' => 'civicrm/event/manage/settings?' .
          'reset=1&action=update&id=' . $this->_eventId]);
        break;
      case 'delete-event':
        $event = CRM_Event_BAO_Event::findById($this->_eventId);
        if ($event) {
          $event->delete();
          CRM_Utils_JSON::output(['result' => 'OK']);
        } else {
          CRM_Utils_JSON::output(['result' => 'ERROR']);
        }
        break;
      case 'advanced':
        CRM_Utils_JSON::output(['openpage' => "civicrm/a/#/resource/manage-event?" .
          "event_id={$this->_eventId}&calendar_id={$this->_calendarId}"]);
        break;
    }
    parent::postProcess();
  }

  /**
   * Get the fields/elements defined in this form.
   *
   * @return array (string)
   */
  public function getRenderableElementNames(): array {
    // The _elements list includes some items which should not be
    // auto-rendered in the loop -- such as "qfKey" and "buttons".  These
    // items don't have labels.  We'll identify renderable by filtering on
    // the 'label'.
    $elementNames = [];
    foreach ($this->_elements as $element) {
      /** @var HTML_QuickForm_Element $element */
      $label = $element->getLabel();
      if (!empty($label)) {
        $elementNames[] = $element->getName();
      }
    }
    return $elementNames;
  }
}
