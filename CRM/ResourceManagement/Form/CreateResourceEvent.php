<?php

use CRM_ResourceManagement_ExtensionUtil as E;
use CRM_ResourceManagement_BAO_ResourceConfiguration as C;

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
    private $_min_start = 0;
    private $_max_end = 0;
    private $_userId = 0;
    private $_userName = "";
    private $_userExternalId = "";
    private $_superUser = false;
    private $_authUser = false;
    private $_event_id = 0;
    private $_filter = false;

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
        $this->_calendar_id = CRM_Utils_Request::retrieve('calendar_id', 'Integer');
        $this->_event_id = CRM_Utils_Request::retrieve('event_id', 'Integer');
        if ($this->_event_id) {
            $event = CRM_Event_BAO_Event::findById($this->_event_id);
            $this->_start_time = strtotime($event->start_date);
            $this->_end_time = strtotime($event->end_date);
        } else {
            $this->_filter = CRM_Utils_Request::retrieve('filter', 'Integer');
            $allDay = CRM_Utils_Request::retrieve('allday', 'Integer');
            $start = CRM_Utils_Request::retrieve('start', 'String');
            $end = CRM_Utils_Request::retrieve('end', 'String');
            if ($allDay == "1") {
                $this->_all_day = true;
            } else {
                $this->_all_day = false;
            }
            if ($this->_all_day) {
                $this->_start_time = strtotime('+ 9 hours',
                        strtotime($start));
                $this->_end_time = strtotime('+ 9 hours', strtotime($end));
            } else {
                $this->_start_time = strtotime($start);
                $this->_end_time = strtotime($end);
            }
            if (!$this->_start_time) {
                $this->_start_time = time();
            }
        }
    }

    public function buildQuickForm() {
        CRM_Core_Resources::singleton()->addScriptFile('resource-management', 'js/moment.js', 5);
        $startTime = date('Y-m-d H:i:s', $this->_start_time);
        $this->add('hidden', 'start_date', $startTime);
        $endTime = date('Y-m-d H:i:s', $this->_end_time);
        $this->add('hidden', 'end_date', $endTime);
        $this->add('hidden', 'calendar_id', $this->_calendar_id);
        $duration = $this->_end_time - $this->_start_time;
        $this->add('hidden', 'duration', $duration);
        $this->controller->_destination = CRM_Utils_System::url('civicrm/showresourceevents',
                        ['id' => $this->_calendar_id]);
        $this->add('hidden', 'start_time', $startTime);
        if ($this->_event_id) {
            $this->add('hidden', 'event_id', $this->_event_id);
        }

        $settings = CRM_ResourceManagement_Page_AJAX::getResourceCalendarSettings($this->_calendar_id);

        $resources = $this->getResources($this->_calendar_id);
        $resource_options = [];
        foreach ($resources as $id => $res) {
            $resource_options[$id] = $res['name'];
        }
        $this->add('hidden', 'resource_source', json_encode($resources));
        $filter = $this->_filter;
        if ($filter) {
            $this->add('hidden', 'min_start', $resources[$filter]['min_start']);
            $this->add('hidden', 'max_end', $resources[$filter]['max_end']);
            $this->add('hidden', 'resources', $filter);
            $this->add('static', 'resource', ts("Selected Resource"), $resource_options[$filter]);
        } else {
            $this->add('hidden', 'min_start', $this->_min_start);
            $this->add('hidden', 'max_end', $this->_max_end);
            $this->add('select', 'resources', ts("Select Resource(s)"), $resource_options,
                    TRUE, ['class' => 'crm-select2', 'multiple' => TRUE, 'placeholder' => ts('- select resource(s) -')]);
        }

        if ($this->_superUser) {
            $this->addEntityRef('responsible_contact', ts('Select responsible contact'), NULL, TRUE);

            if (!$this->_event_id) {
                $eventTemplates = CRM_ResourceManagement_Form_ResourceCalendarSettings::getEventTemplates();
                $this->add('select', 'event_template', ts('Select template for event'),
                        $eventTemplates, TRUE, ['class' => 'crm-select2', 'multiple' => false,
                    'placeholder' => ts('- select template -')]);
            }
            $this->add('text', 'event_title', ts('Event Title'), NULL, TRUE);
        } else {
            $this->add('hidden', 'respoensible_contact', $this->_userId);
            $this->add('static', 'user_info', ts('Responsible'),
                    $this->_userExternalId . ' ' . $this->_userName);
            if (!$this->_event_id) {
                $this->add('hidden', 'event_template', $settings['event_template']);
                $this->add('static', 'event_template_title', ts('Event type'),
                        ts('Private event'));
            }
            $this->add('static', 'event_title', ts('Event Title'), ts('Private Event'));
        }

        $this->add('datepicker', 'event_start_date', ts('Start Date'),
                NULL,
                TRUE,
                [
                    'time' => TRUE,
        ]);
        $this->add('datepicker', 'event_end_date', ts('End Date'),
                NULL,
                TRUE,
                [
                    'time' => TRUE,
        ]);
        $buttons = [
            [
                'type' => 'submit',
                'subName' => 'submit',
                'name' => E::ts('Submit'),
                'isDefault' => TRUE,
            ]
        ];
        if ($this->_superUser && $this->_event_id) {
            $buttons[] = [
                'type' => 'submit',
                'subName' => 'delete',
                'name' => E::ts('Delete'),
                'icon' => 'fa-trash',
            ];
        }


        $this->addButtons($buttons);

        // export form elements
        $this->assign('elementNames', $this->getRenderableElementNames());
        parent::buildQuickForm();
    }

    public function postProcess() {
        $buttonName = $this->controller->getButtonName();
        if (substr_compare($buttonName, 'submit', -6) === 0) {
            $values = $this->exportValues();
            $resourceRole = (int) C::getConfig('resource_role_id');
            $hostRole = (int) C::getConfig('host_role_id');
            $statuses = explode(',', C::getConfig('resource_status_ids'));
            $today = date('Y-m-d H:i:s');
            if (!$this->_event_id) {
                if (!is_array($values['resources'])) {
                    $values['resources'] = [$values['resources']];
                }
                if (!isset($values['responsible_contact'])) {
                    $values['responsible_contact'] = $this->_userId;
                }
                $params = [];
                $params['start_date'] = $values['event_start_date'] ?? NULL;
                $params['end_date'] = $values['event_end_date'] ?? NULL;
                $params['has_waitlist'] = FALSE;
                $params['is_map'] = FALSE;
                if (isset($values['event_title'])) {
                    $params['title'] = $values['event_title'];
                }
                $params = array_merge(CRM_Event_BAO_Event::getTemplateDefaultValues($values['event_template']), $params);
                $event = CRM_Event_BAO_Event::copy($values['event_template'], $params);
                $event->is_template = 0;
                $event->update();

                foreach ($values['resources'] as $res_id) {
                    $params = [
                        'register_date' => $today,
                        'role_id' => $resourceRole,
                        'contact_id' => $res_id,
                        'event_id' => $event->id,
                        'status_id' => $statuses[0],
                    ];
                    $participant = CRM_Event_BAO_Participant::create($params);
                    $participant->save();
                }
                $params = [
                    'register_date' => $today,
                    'role_id' => $hostRole,
                    'contact_id' => $values['responsible_contact'],
                    'event_id' => $event->id,
                    'status_id' => C::getConfig('host_status_id'),
                ];
                $participant = CRM_Event_BAO_Participant::create($params);
                $participant->save();
            } else if ($this->_action === 0) { // Update
                $change = false;
                $event = CRM_Event_BAO_Event::findById($this->_event_id);
                if ($event->start_date !== $values['event_start_date']) {
                    $event->start_date = $values['event_start_date'];
                    $change = true;
                }
                if ($event->end_date !== $values['event_end_date']) {
                    $event->end_date = $values['event_end_date'];
                    $change = true;
                }
                if ($event->title !== $values['event_title']) {
                    $event->title = $values['event_title'];
                    $change = true;
                }
                if ($change) {
                    $event->save();
                }
                $resources = [];
                $toDelete = [];
                foreach ($values['resources'] as $res) {
                    $resources[(int) $res] = $res;
                }
                $participant = new CRM_Event_BAO_Participant();
                $participant->event_id = $this->_event_id;
                $participant->role_id = $resourceRole;
                $participant->find();
                while ($participant->fetch()) {
                    if (($key = array_search($participant->contact_id, $resources))) {
                        unset($resources[$key]);
                    } else {
                        $toDelete[] = $participant->id;
                    }
                }
                foreach ($resources as $res) {
                    $params = [
                        'register_date' => $today,
                        'role_id' => $resourceRole,
                        'contact_id' => $res,
                        'event_id' => $event->id,
                        'status_id' => $statuses[0],
                    ];
                    $participant = CRM_Event_BAO_Participant::create($params);
                    $participant->save();
                }
                $host = new CRM_Event_BAO_Participant();
                $host->event_id = $event->id;
                $host->role_id = $hostRole;
                $host->find();
                while ($host->fetch()) {
                    if ($host->contact_id != (int) $values['responsible_contact']) {
                        $host->contact_id = (int) $values['responsible_contact'];
                        $host->register_date = $today;
                        $host->save();
                    }
                }
                foreach ($toDelete as $id) {
                    $d = CRM_Event_BAO_Participant::findById($id);
                    $d->delete();
                }
            }
        } elseif (substr_compare($buttonName, 'delete', -6) === 0) {
            if ($this->_event_id) {
                $sql = "DELETE FROM `civicrm_participant` WHERE `event_id` = " . $this->_event_id;
                CRM_CORE_DAO::executeQuery($sql);
                $sql = "DELETE FROM `civicrm_event` WHERE `id` = " . $this->_event_id;
                CRM_CORE_DAO::executeQuery($sql);
            }
        }
        parent::postProcess();
    }

    public function getResources() {
        $options = [];
        $start_time = date('Y-m-d\TH:i:s', $this->_start_time);
        $now = date('Y-m-d\TH:i:s', time());
        $query = "SELECT p.id resource_calendar_id, p.`contact_id`,c.display_name name
                FROM `civicrm_resource_calendar_participant` p
                LEFT JOIN `civicrm_contact` c on c.id=p.`contact_id`
                WHERE `resource_calendar_id` = {$this->_calendar_id};";
        $dao = CRM_Core_DAO::executeQuery($query);
        while ($dao->fetch()) {
            $sql = "SELECT e.start_date FROM `civicrm_event` e
                    LEFT JOIN `civicrm_participant` p ON p.event_id = e.id
                    WHERE p.contact_id = {$dao->contact_id}
                    AND e.`start_date` > '{$start_time}'";
            if ($this->_event_id) {
                $sql .= " AND e.id != " . $this->_event_id;
            }
            $sql .= " ORDER BY e.`start_date` ASC
                    LIMIT 1;";

            $max_time = CRM_CORE_DAO::singleValueQuery($sql);
            if (!$this->_max_end || ($max_time != null && $this->_max_end < $max_time)) {
                $this->_max_end = $max_time;
            }
            $sql = "SELECT e.end_date FROM `civicrm_event` e
                    LEFT JOIN `civicrm_participant` p ON p.event_id = e.id
                    WHERE p.contact_id = {$dao->contact_id}
                    AND e.`end_date` <= '{$start_time}'";
            if ($this->_event_id) {
                $sql .= " AND e.id != " . $this->_event_id;
            }
            $sql .= " ORDER BY e.`end_date` DESC
                    LIMIT 1;";
            $min_time = CRM_CORE_DAO::singleValueQuery($sql) ?? date('Y-m-d H:i:s', time());
            if (!$this->_min_start || $this->_min_start < $min_time) {
                $this->_min_start = $min_time;
            }
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

    public function setDefaultValues() {
        $defaults = [];
        if ($this->_event_id) {
            $event = CRM_Event_BAO_Event::findById($this->_event_id);
            $defaults['event_title'] = $event->title;
            $defaults['event_start_date'] = $event->start_date;
            $defaults['event_end_date'] = $event->end_date;
            $hostRole = C::getConfig('host_role_id');
            $resourceRole = C::getConfig('resource_role_id');
            $query = "SELECT role_id, contact_id
                        FROM `civicrm_participant` 
                        WHERE event_id = {$this->_event_id}
                            AND role_id in ({$hostRole},{$resourceRole})";
            $dao = CRM_Core_DAO::executeQuery($query);
            $resources = [];
            while ($dao->fetch()) {
                if ($dao->role_id === $resourceRole) {
                    $resources[] = $dao->contact_id;
                } else if ($dao->role_id === $hostRole) {
                    $defaults['responsible_contact'] = $dao->contact_id;
                }
            }
            $defaults['resources'] = $resources;
        } else {
            $defaults['event_start_date'] = date('Y-m-d H:i:s', $this->_start_time);
            $defaults['event_end_date'] = date('Y-m-d H:i:s', $this->_end_time);
            if (!$this->_filter) {
                $defaults['resources'] = $this->_filter;
            }
        }
        return $defaults;
    }

}
