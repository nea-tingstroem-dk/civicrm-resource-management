<?php

use CRM_ResourceManagement_ExtensionUtil as E;

/**
 * Form controller class
 *
 * @see https://docs.civicrm.org/dev/en/latest/framework/quickform/
 */
class CRM_ResourceManagement_Form_CreateResourceEvent extends CRM_Core_Form {

    private $_calendar_id = 0;
    private $_all_day = false;
    private $_start_time = 0;
    private $_end_time = 0;
    private $_userId = 0;
    private $_userName = "";
    private $_userExternalId = "";
    private $_superUser = false;
    private $_authUser = false;
    private $_event_template = 0;

    public function preProcess() {
        parent::preProcess();
        $getContactId = (int) CRM_Core_Session::singleton()->getLoggedInContactID();
        $user = civicrm_api3('Contact', 'get', [
            'sequential' => 1,
            'return' => ["display_name", "external_identifier"],
            'id' => $getContactId,
        ]);
        $actualUser = $user['values'][0];
        $this->_userId = $actualUser['contact_id'];
        $this->_userName = $actualUser['display_name'];
        $this->_userExternalId = $actualUser['external_identifier'];
        $this->_superUser = CRM_Core_Permission::check('edit all events', $getContactId);
        $this->_authUser = CRM_Core_Permission::check('access CiviEvent', $getContactId);
        $this->_calendar_id = $_GET['calendar_id'] ?? $_POST['calendar_id'];
        $allDay = $_GET['allday'] ?? '0';
        if ($allDay == "1") {
            $this->_all_day = true;
        } else {
            $this->_all_day = false;
        }
        if ($this->_all_day) {
            $this->_start_time = strtotime('+ 9 hours' , strtotime($_GET['start'] ?? $_POST['event_start_date']));
            $this->_end_time = strtotime('+ 9 hours' , strtotime($_GET['end'] ?? $_POST['event_end_date']));
        } else {
            $this->_start_time = strtotime($_GET['start'] ?? $_POST['event_start_date']);
            $this->_end_time = strtotime($_GET['end'] ?? $_POST['event_end_date']);
        }
        if (!$this->_start_time) {
            $this->_start_time = time();
        }
    }

    public function buildQuickForm() {
        CRM_Core_Resources::singleton()->addScriptFile('resource-management', 'js/moment.js', 5);

        $startTime = date('Y-m-d H:i:s', $this->_start_time);
        $this->assign('start_time', $startTime);
        $endTime = date('Y-m-d H:i:s', $this->_end_time);
        $this->assign('end_time', $endTime);
        $this->add('hidden', 'calendar_id', $this->_calendar_id);
        $this->add('hidden', 'start_time', $startTime);

        $settings = CRM_ResourceManagement_Page_AJAX::getResourceCalendarSettings($this->_calendar_id);

        $resources = $this->getResources($this->_calendar_id);
        $resource_options = [];
        foreach ($resources as $id => $res) {
            $resource_options[$id] = $res['name'];
        }
        $this->assign('resources', json_encode($resources));

        $this->add('select', 'resources', ts("Select Resource(s)"), $resource_options,
                FALSE, ['class' => 'crm-select2', 'multiple' => TRUE, 'placeholder' => ts('- select resource(s) -')]);

        if ($this->_superUser) {
            $this->addEntityRef('responsible_contact', ts('Select responsible contact'));

            $eventTemplates = CRM_ResourceManagement_Form_ResourceCalendarSettings::getEventTemplates();
            $this->add('select', 'event_template', ts('Select template for event'),
                    $eventTemplates, FALSE, ['class' => 'crm-select2', 'multiple' => false,
                'placeholder' => ts('- select template -')]);
            $this->add('text', 'event_title', ts('Event Title'));
        } else {
            $this->add('static', 'user_info', ts('Responsible'),
                    $this->_userExternalId . ' ' . $this->_userName);
            $this->add('hidden', 'event_template', $settings['event_template']);
            $this->add('static', 'event_template_title', ts('Event type'),
                    ts('Private event'));
            $this->add('static', 'event_title', ts('Event Title'), ts('Private Event'));
        }

        $this->add('datepicker', 'event_start_date', ts('Start Date'),
                [
                    'minDate' => format_date($this->_start_time, 'y-m-d H:i'),
                    'maxDate' => format_date($this->_start_time + 60 * 60 * 24, 'y-m-d H:i'),
                ],
                TRUE, ['time' => TRUE]);
        $this->add('datepicker', 'event_end_date', ts('End Date'),
                [
                    'minDate' => format_date($this->_start_time, 'y-m-d H:i'),
                    'maxDate' => format_date($this->_start_time + 60 * 60 * 48, 'y-m-d H:i'),
                ],
                TRUE, ['time' => TRUE]);
        // add form elements
        $this->addButtons(array(
            array(
                'type' => 'submit',
                'name' => E::ts('Submit'),
                'isDefault' => TRUE,
            ),
        ));

        // export form elements
        $this->assign('elementNames', $this->getRenderableElementNames());
        parent::buildQuickForm();
    }

    public function postProcess() {
        $values = $this->exportValues();
        $params = [];
        $params['start_date'] = $values['event_start_date'] ?? NULL;
        $params['end_date'] = $values['event_end_date'] ?? NULL;
        $params['has_waitlist'] = FALSE;
        $params['is_map'] = FALSE;
        $params['title'] = $values['event_title'];
        $params = array_merge(CRM_Event_BAO_Event::getTemplateDefaultValues($values['event_template']), $params);

        $event = CRM_Event_BAO_Event::copy($values['event_template'], $params);
        $event->is_template = 0;
        $event->update();
        foreach ($values['resources'] as $res_id => $res_val) {
            $params = [
                'role_id' => 8,
            ];
            $participant = CRM_Event_BAO_Participant::add($params);
        }
        parent::postProcess();
    }

    public function getResources() {
        $options = [];
        $start_time = date(DATE_ATOM, $this->_start_time);
        $now = date(DATE_ATOM, time());
        $query = "SELECT p.id resource_calendar_id, p.`contact_id`,c.display_name name
                FROM `civicrm_resource_calendar_participant` p
                LEFT JOIN `civicrm_contact` c on c.id=p.`contact_id`
                WHERE `resource_calendar_id` = {$this->_calendar_id};";
        $dao = CRM_Core_DAO::executeQuery($query);
        while ($dao->fetch()) {
            $sql = "SELECT e.start_date FROM `civicrm_event` e
                    LEFT JOIN `civicrm_participant` p ON p.event_id = e.id
                    WHERE p.contact_id = {$dao->contact_id}
                    AND e.`start_date` > '{$start_time}'
                    AND e.`start_date` > '{$now}'
                    ORDER BY e.`start_date` ASC
                    LIMIT 1;";
            $max_time = CRM_CORE_DAO::singleValueQuery($sql);
            $sql = "SELECT e.end_date FROM `civicrm_event` e
                    LEFT JOIN `civicrm_participant` p ON p.event_id = e.id
                    WHERE p.contact_id = {$dao->contact_id}
                    AND e.`end_date` < '{$max_time}'
                    AND e.`end_date` > '{$now}'
                    ORDER BY e.`end_date` DESC
                    LIMIT 1;";
            $min_time = CRM_CORE_DAO::singleValueQuery($sql) ?? date('Y-m-d H:i', time());
            $resource = [
                'name' => $dao->name,
                'min_start' => $min_time,
                'max_end' => $max_time,
            ];
            $options[$dao->contact_id] = $resource;
        }
        return $options;
    }

    /**
     * Get the fields/elements defined in this form.
     *
     * @return array (string)
     */
    public function getRenderableElementNames() {
        // The _elements list includes some items which should not be
        // auto-rendered in the loop -- such as "qfKey" and "buttons".  These
        // items don't have labels.  We'll identify renderable by filtering on
        // the 'label'.
        $elementNames = array();
        foreach ($this->_elements as $element) {
            /** @var HTML_QuickForm_Element $element */
            $label = $element->getLabel();
            if (!empty($label)) {
                $elementNames[] = $element->getName();
            }
        }
        return $elementNames;
    }

//    public function setDefaultValues() {
//        $defaults = [
//            'event_start_date' => format_date($this->_start_time, 'Y-m-d H:i'),
//        ];
//        return $defaults;
//    }
}
