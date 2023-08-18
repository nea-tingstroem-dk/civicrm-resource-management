<?php

use CRM_ResourceManagement_ExtensionUtil as E;
use CRM_ResourceManagement_BAO_ResourceConfiguration as C;

/**
 * Form controller class
 *
 * cs_see https://docs.civicrm.org/dev/en/latest/framework/quickform/
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
        $this->action = CRM_Utils_Request::retrieve('action', 'String') ?? '';

        $this->add('hidden', 'calendar_id', $this->_calendar_id);
        $this->add('hidden', 'calendar_type', $this->_calendar_type);
        if ($this->action === CRM_Core_Action::DELETE) {
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

            $query = "SELECT `id`, `display_name`  FROM `civicrm_contact` 
                            WHERE `contact_sub_type` LIKE '%" . $this->_calendar_type . "%' 
                            ORDER BY `display_name`  ASC;";
            $dao = CRM_Core_DAO::executeQuery($query);
            $resource_list = [];
            while ($dao->fetch()) {
                $resource_list[$dao->id] = $dao->display_name;
                $id = $dao->id;
            }
            $this->add('select', 'resources', ts("Select Resource(s)"), $resource_list,
                    FALSE, ['class' => 'crm-select2', 'multiple' => TRUE,
                'placeholder' => ts('- select resource(s) -')]);
            $options = \Civi\Api4\OptionGroup::get(FALSE)
                    ->addSelect('ov.value', 'ov.label')
                    ->addJoin('OptionValue AS ov', 'LEFT', ['id', '=', 'ov.option_group_id'])
                    ->addWhere('name', '=', 'participant_role')
                    ->addOrderBy('ov.label', 'ASC')
                    ->execute();
            $roleOptions = [];
            foreach ($options as $option) {
                $roleOptions[$option['ov.value']] = $option['ov.label'];
            }
            $this->add('select',
                    'cs_resource_role_id', ts("Select Resource Role"),
                    $roleOptions,
                    TRUE,
                    [
                        'class' => 'crm-select2',
                        'multiple' => FALSE,
                        'placeholder' => ts('- select role -')
            ]);

            if ($this->action === CRM_Core_Action::UPDATE) {

                $eventTemplates = self::getEventTemplates();

                $calendarResources = $this->getCalendarResources();
                foreach ($calendarResources as $res_id) {
                    $res = CRM_Contact_BAO_Contact::findById($res_id);
                    $this->add('select', "cs_event_template_{$res_id}",
                            ts("Select Default Event template for ") . $res->display_name, $eventTemplates,
                            FALSE, ['class' => 'crm-select2', 'multiple' => FALSE,
                        'placeholder' => ts('- select template(s) -')]);
                }

                $this->add('advcheckbox', 'cs_show_end_date', ts('Show End Date?'));
                $descriptions['cs_show_end_date'] = ts('Show the event with start and end dates on the calendar.');
                $this->add('advcheckbox', 'cs_show_public_events', ts('Show Public Events?'));
                $descriptions['cs_show_public_events'] = ts('Show only public events, or all events.');
                $this->add('advcheckbox', 'cs_week_begins_day', ts('Week begins on'));
                $descriptions['cs_week_begins_day'] = ts('Use weekBegin settings from CiviCRM. You can override settings at Administer > Localization > Date Formats.');
                $this->add('advcheckbox', 'cs_time_format_24_hour', ts('24 hour time format'));
                $descriptions['cs_time_format_24_hour'] = ts('Use 24 hour time format - default is AM/PM format.');

                $roleOptions = [];
                $sql = "SELECT `id`,`option_group_id`,`label`,`value`,`name`
                FROM `civicrm_option_value`
                WHERE option_group_id = 
                (SELECT id FROM `civicrm_option_group` 
                WHERE name = 'participant_role');";
                $dao = CRM_Core_DAO::executeQuery($sql);
                while ($dao->fetch()) {
                    $roleOptions[$dao->value] = $dao->label;
                }

                $this->add('select',
                        'cs_host_role_id', ts("Select Host Role"),
                        $roleOptions,
                        TRUE,
                        [
                            'class' => 'crm-select2',
                            'multiple' => FALSE,
                            'placeholder' => ts('- select role -')
                ]);

                $statusOptions = [];
                $sql = "SELECT `id`,`label`,`name`
                FROM `civicrm_participant_status_type`;";
                $dao = CRM_Core_DAO::executeQuery($sql);
                while ($dao->fetch()) {
                    $statusOptions[$dao->id] = $dao->label;
                }

                $this->add('select',
                        'cs_host_status_id', ts("Select Host Default Status"),
                        $statusOptions,
                        TRUE,
                        [
                            'class' => 'crm-select2',
                            'multiple' => FALSE,
                            'placeholder' => ts('- select status -')
                ]);

                $statuses = C::getConfig('resource_status_ids');

                $sql = "SELECT `id`,`name`,`label`
                    FROM `civicrm_participant_status_type`
                    WHERE `id` IN ({$statuses});";

                $dao = CRM_Core_DAO::executeQuery($sql);
                while ($dao->fetch()) {
                    $id = $dao->id;
                    $type = $dao->label;
                    $this->addElement('checkbox', "statusid_{$id}", $type, NULL,
                            array('onclick' => "showhidecolorbox('{$id}')", 'id' => "statusid_{$id}"));
                    $this->addElement('text', "eventcolorid_{$id}", "Color",
                            array(
                                'onchange' => "updatecolor('eventcolorid_{$id}', this.value);",
                                'class' => 'color',
                                'id' => "eventcolorid_{$id}",
                    ));
                }
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
        $submitted = $this->_submitValues;
        $settings = [];
        $this->_calendar_type = $submitted['calendar_type'];
        foreach ($submitted as $key => $value) {
            if (!$value && $key != 'calendar_title' && $key != 'calendar_type') {
                $submitted[$key] = 0;
            }
        }
        foreach ($this->_submitValues as $key => $value) {
            if (substr($key, 0, 3) === 'cs_') {
                $settings[substr($key, 3)] = $value;
            }
        }
        if ((int) $this->action == CRM_Core_Action::DELETE) {
            $sql = "DELETE FROM civicrm_resource_calendar_participant WHERE `resource_calendar_id` = {$submitted['calendar_id']};";
            $dao = CRM_Core_DAO::executeQuery($sql);
            $sql = "DELETE FROM civicrm_resource_calendar_color 
            WHERE `calendar_id` = {$this->_calendar_id};";
            $dao = CRM_Core_DAO::executeQuery($sql);
            $sql = "DELETE FROM civicrm_resource_calendar 
            WHERE `id` = {$this->_calendar_id};";
            $dao = CRM_Core_DAO::executeQuery($sql);
            $sql = "DELETE FROM civicrm_resource_calendar_settings 
            WHERE `calendar_id` = {$this->_calendar_id};";
            $dao = CRM_Core_DAO::executeQuery($sql);

            CRM_Core_Session::setStatus(E::ts('The Calendar has been deleted.'), E::ts('Deleted'), 'success');
        } else {

            if ((int) $this->action == CRM_Core_Action::ADD) {
                $sql = "INSERT INTO civicrm_resource_calendar
                (calendar_title, calendar_type)
            VALUES
                ('{$submitted['calendar_title']}', '{$submitted['calendar_type']}')";
                $dao = CRM_Core_DAO::executeQuery($sql);
                $this->_calendar_id = CRM_Core_DAO::singleValueQuery('SELECT LAST_INSERT_ID()');
            }

            if ((int) $this->action == CRM_Core_Action::UPDATE) {
                $sql = "UPDATE civicrm_resource_calendar
                        SET calendar_title = '{$submitted['calendar_title']}'
                        WHERE `id` = {$this->_calendar_id};";
                $dao = CRM_Core_DAO::executeQuery($sql);
                //delete current event type records to update with new ones
            }
            $sql = "DELETE FROM civicrm_resource_calendar_participant WHERE `resource_calendar_id` = {$submitted['calendar_id']};";
            $dao = CRM_Core_DAO::executeQuery($sql);
            $sql = "DELETE FROM civicrm_resource_calendar_color 
            WHERE `calendar_id` = {$this->_calendar_id};";
            $dao = CRM_Core_DAO::executeQuery($sql);
            //insert new event type records
            foreach ($submitted as $key => $value) {
                if ("resources" == $key) {
                    if (empty($value)) {
                        
                    } else {
                        foreach ($value as $id) {
                            $sql = "INSERT INTO civicrm_resource_calendar_participant(resource_calendar_id, contact_id)
                             VALUES ({$this->_calendar_id}, {$id});";
                            $dao = CRM_Core_DAO::executeQuery($sql);
                        }
                    }
                } else if ("statusid" == substr($key, 0, 8)) {
                    $id = explode("_", $key)[1];
                    $sql = "INSERT INTO civicrm_resource_calendar_color(calendar_id, status_id, event_color)
                            VALUES ({$this->_calendar_id}, {$id}, '{$submitted['eventcolorid_' . $id]}');";
                    $dao = CRM_Core_DAO::executeQuery($sql);
                }
            }
            foreach ($settings as $key => $value) {
                $setting = new CRM_ResourceManagement_DAO_ResourceCalendarSettings();
                $setting->calendar_id = $this->_calendar_id;
                $setting->config_key = $key;
                $setting->find(true);
                if (!$setting->N || $setting->config_value !== $value) {
                    $setting->config_value = $value;
                    $setting->save();
                }
            }
            CRM_Core_Session::setStatus(ts('The Calendar has been saved.'), ts('Saved'), 'success');
        }
        if ((int) $this->action == CRM_Core_Action::ADD) {
            CRM_Utils_System::redirect(CRM_Utils_System::url('civicrm/resource-calendarsettings', "action=update&id={$this->_calendar_id}"));
        }
        parent::postProcess();
    }

    /**
     * Get the fields/elements defined in this form.
     *
     * cs_return array (string)
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
     * cs_see CRM_Core_Form::setDefaultValues()
     */
    public function setDefaultValues() {
        if ($this->_calendar_id && ( (int) $this->action != CRM_Core_Action::DELETE)) {
            $existing = array();
            $sql = "SELECT * FROM civicrm_resource_calendar WHERE id = {$this->_calendar_id} LIMIT 1;";
            $dao = CRM_Core_DAO::executeQuery($sql);
            $defaults = [];
            if ($dao->fetch()) {
                $defaults = $dao->toArray();
            }
            $defaults['resources'] = $this->getCalendarResources();
            $sql = "SELECT * FROM civicrm_resource_calendar_color WHERE calendar_id = {$this->_calendar_id};";
            $dao = CRM_Core_DAO::executeQuery($sql);
            while ($dao->fetch()) {
                $defaults['statusid_' . $dao->status_id] = 1;
                $defaults['eventcolorid_' . $dao->status_id] = $dao->event_color;
            }
            $settings = new CRM_ResourceManagement_DAO_ResourceCalendarSettings();
            $settings->calendar_id = $this->_calendar_id;
            $settings->find();
            while ($settings->fetch()) {
                $defaults['cs_' . $settings->config_key] = $settings->config_value;
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

    public function getCalendarResources() {
        $sql = "SELECT * FROM civicrm_resource_calendar_participant WHERE resource_calendar_id = {$this->_calendar_id};";
        $resources = [];
        $dao = CRM_Core_DAO::executeQuery($sql);
        $defaults['resources'] = [];
        while ($dao->fetch()) {
            $resources[] = $dao->contact_id;
        }
        return $resources;
    }

}
