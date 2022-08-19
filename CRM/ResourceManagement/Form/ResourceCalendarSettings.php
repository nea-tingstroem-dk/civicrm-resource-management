<?php

use CRM_ResourceManagement_ExtensionUtil as E;

/**
 * Form controller class
 *
 * @see https://docs.civicrm.org/dev/en/latest/framework/quickform/
 */
class CRM_ResourceManagement_Form_ResourceCalendarSettings extends CRM_Core_Form {

    private $_submittedValues = array();
    private $_calendar_type = '';
    private $_calendar_id = 0;

    public function preProcess() {
        $this->_calendar_id = CRM_Utils_Request::retrieve('id', 'Integer') ??
                CRM_Utils_Request::retrieve('calendar_id', 'Integer');
        if (isset($this->_calendar_id)) {
            $this->_calendar_type = CRM_Core_DAO::singleValueQuery("SELECT `calendar_type` FROM `civicrm_resource_calendar`
                                                                    WHERE `id` = {$this->_calendar_id};");
        } else {
            $this->_calendar_type = CRM_Utils_Request::retrieve('resource', 'String') ??
                    CRM_Utils_Request::retrieve('calendar_type', 'String');
        }
        parent::preProcess();
    }

    public function buildQuickForm() {
        CRM_Utils_System::setTitle(E::ts('Resource Calendars Settings'));
        $this->controller->_destination = CRM_Utils_System::url('civicrm/admin/resource-calendars', 'reset=1');
        $this->action = CRM_Utils_Request::retrieve('action', 'Int') ?? null;

        $this->add('hidden', 'calendar_id', $this->_calendar_id);
        $this->add('hidden', 'calendar_type', $this->_calendar_type);
        if ($this->action == 'delete') {
            $descriptions['delete_warning'] = ts('Are you sure you want to delete this calendar?');
            $this->add('hidden', 'action', $this->action);
            $this->assign('descriptions', $descriptions);
        } else {
            CRM_Core_Resources::singleton()->addScriptFile('resource-management', 'js/jscolor.js');
            CRM_Core_Resources::singleton()->addScriptFile('resource-management', 'js/resourcecalendar.js');

            $descriptions = array();

            $this->add('hidden', 'action', $this->action);
            $this->add('text', 'calendar_title', ts('Calendar Title'));
            $descriptions['calendar_title'] = ts('Event calendar title.');
            $this->add('advcheckbox', 'show_end_date', ts('Show End Date?'));
            $descriptions['show_end_date'] = ts('Show the event with start and end dates on the calendar.');
            $this->add('advcheckbox', 'show_public_events', ts('Show Public Events?'));
            $descriptions['show_public_events'] = ts('Show only public events, or all events.');
            $this->add('advcheckbox', 'week_begins_from_day', ts('Week begins on'));
            $descriptions['week_begins_from_day'] = ts('Use weekBegin settings from CiviCRM. You can override settings at Administer > Localization > Date Formats.');
            $this->add('advcheckbox', 'time_format_24_hour', ts('24 hour time format'));
            $descriptions['time_format_24_hour'] = ts('Use 24 hour time format - default is AM/PM format.');

            $eventTemplates = self::getEventTemplates();

            $this->add('select', 'event_template', ts("Select Event template"), $eventTemplates,
                    FALSE, ['class' => 'crm-select2', 'multiple' => FALSE,
                'placeholder' => ts('- select template -')]);

            $query = "SELECT `id`, `display_name`  FROM `civicrm_contact` 
                            WHERE `contact_sub_type` LIKE '%" . $this->_calendar_type . "%' 
                            ORDER BY `display_name`  ASC;";
            $dao = CRM_Core_DAO::executeQuery($query);
            $resource_list = [];
            while ($dao->fetch()) {
                $id = $dao->id;
                $type = $dao->display_name;
                $this->addElement('checkbox', "resourceid_{$id}", $type, NULL,
                        array('onclick' => "showhidecolorbox('{$id}')", 'id' => "event_{$id}"));
                $this->addElement('text', "eventcolor_{$id}", "Color",
                        array(
                            'onchange' => "updatecolor('eventcolor_{$id}', this.value);",
                            'class' => 'color',
                            'id' => "eventcolorid_{$id}",
                ));
            }
        }

        $this->addButtons(array(
            array(
                'type' => 'submit',
                'name' => ts('Submit'),
                'isDefault' => TRUE,
            ),
        ));
        // export form element
        $this->assign('elementNames', $this->getRenderableElementNames());
        $this->assign('descriptions', $descriptions);
        parent::buildQuickForm();
    }

    public function postProcess() {
        $submitted = $this->exportValues();
        $this->_calendar_type = $submitted['calendar_type'];
        foreach ($submitted as $key => $value) {
            if (!$value && $key != 'calendar_title' && $key != 'calendar_type') {
                $submitted[$key] = 0;
            }
        }

        if ($submitted['action'] == CRM_Core_Action::ADD) {
            $sql = "INSERT INTO civicrm_resource_calendar
                (calendar_title, calendar_type,  
                show_end_date, show_public_events, 
                week_begins_from_day, 
                time_format_24_hour,
                event_template)
            VALUES
                ('{$submitted['calendar_title']}', '{$submitted['calendar_type']}', 
                {$submitted['show_end_date']}, 
                {$submitted['show_public_events']}, {$submitted['week_begins_from_day']}, 
                {$submitted['time_format_24_hour']},
                {$submitted['event_template']})";
            $dao = CRM_Core_DAO::executeQuery($sql);
            $cfId = CRM_Core_DAO::singleValueQuery('SELECT LAST_INSERT_ID()');
            foreach ($submitted as $key => $value) {
                if ("resourceid" == substr($key, 0, 10)) {
                    $id = explode("_", $key)[1];
                    $sql = "INSERT INTO civicrm_resource_calendar_participant(resource_calendar_id, contact_id, event_color)
                                VALUES ({$cfId}, {$id}, '{$submitted['eventcolor_' . $id]}');";
                    $dao = CRM_Core_DAO::executeQuery($sql);
                }
            }
        }

        if ($submitted['action'] == CRM_Core_Action::UPDATE) {
            $sql = "UPDATE civicrm_resource_calendar
       SET calendar_title = '{$submitted['calendar_title']}', 
            show_end_date = {$submitted['show_end_date']}, 
            show_public_events = {$submitted['show_public_events']}, 
            week_begins_from_day = {$submitted['week_begins_from_day']}, 
            time_format_24_hour = {$submitted['time_format_24_hour']}, 
            event_template = {$submitted['event_template']}
       WHERE `id` = {$this->_calendar_id};";
            $dao = CRM_Core_DAO::executeQuery($sql);
            //delete current event type records to update with new ones
            $sql = "DELETE FROM civicrm_resource_calendar_participant WHERE `resource_calendar_id` = {$submitted['calendar_id']};";
            $dao = CRM_Core_DAO::executeQuery($sql);
            //insert new event type records
            foreach ($submitted as $key => $value) {
                if ("resourceid" == substr($key, 0, 10)) {
                    $id = explode("_", $key)[1];
                    $sql = "INSERT INTO civicrm_resource_calendar_participant(resource_calendar_id, contact_id, event_color)
                                VALUES ({$this->_calendar_id}, {$id}, '{$submitted['eventcolor_' . $id]}');";
                    $dao = CRM_Core_DAO::executeQuery($sql);
                }
            }
        }

        if ($submitted['action'] == CRM_Core_Action::DELETE) {
            $sql = "DELETE FROM civicrm_resource_calendar WHERE `id` = {$submitted['calendar_id']};";
            $dao = CRM_Core_DAO::executeQuery($sql);
        }

        CRM_Core_Session::setStatus(ts('The Calendar has been saved.'), ts('Saved'), 'success');
        parent::postProcess();
    }

    /**
     * Get the fields/elements defined in this form.
     *
     * @return array (string)
     */
    public function getRenderableElementNames() {
        // The _elements list includes some items which should not be
        // auto-rendered in the loop -- such as "qfKey" and "buttons". These
        // items don't have labels. We'll identify renderable by filtering on
        // the 'label'.
        $elementNames = array();
        foreach ($this->_elements as $element) {
            $label = $element->getLabel();
            if (!empty($label)) {
                $elementNames[] = $element->getName();
            }
        }
        return $elementNames;
    }

    /**
     * Set defaults for form.
     *
     * @see CRM_Core_Form::setDefaultValues()
     */
    public function setDefaultValues() {
        if ($this->_calendar_id && ($this->action != 'delete')) {
            $existing = array();
            $sql = "SELECT * FROM civicrm_resource_calendar WHERE id = {$this->_calendar_id} LIMIT 1;";
            $dao = CRM_Core_DAO::executeQuery($sql);
            $defaults = [];
            if ($dao->fetch()) {
                $defaults = $dao->toArray();
            }
            $sql = "SELECT * FROM civicrm_resource_calendar_participant WHERE resource_calendar_id = {$this->_calendar_id};";
            $dao = CRM_Core_DAO::executeQuery($sql);
            $existing = array();
            while ($dao->fetch()) {
                $existing[] = $dao->toArray();
            }
            foreach ($existing as $name => $value) {
                $defaults['resourceid_' . $value['contact_id']] = 1;
                $defaults['eventcolor_' . $value['contact_id']] = $value['event_color'];
            }
            return $defaults;
        }
    }

    public static function getEventTemplates() {
        $eventTemplates = [];
        $sql = "SELECT `id`, `template_title` 
            FROM `civicrm_event` 
            WHERE `is_template` 
            ORDER BY `template_title` ASC;";
        $dao = CRM_Core_DAO::executeQuery($sql);
        while ($dao->fetch()) {
            $eventTemplates[$dao->id] = $dao->template_title;
        }
        return $eventTemplates;
    }

}
