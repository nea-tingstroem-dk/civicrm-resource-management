<?php

use CRM_ResourceManagement_ExtensionUtil as E;

/**
 * Form controller class
 *
 * @see https://docs.civicrm.org/dev/en/latest/framework/quickform/
 */
class CRM_ResourceManagement_Form_AdminResourceManagement extends CRM_Core_Form {

    public function buildQuickForm() {
        CRM_Utils_System::setTitle(E::ts('Resource Management Settings'));
        $descriptions = [];
        $contactTypeOptions = [];
        $query = 'SELECT * FROM `civicrm_contact_type`
                WHERE `parent_id` is not null';
        $dao = CRM_Core_DAO::executeQuery($query);

        while ($dao->fetch()) {
            $contactTypeOptions[$dao->id] = $dao->label;
        }

        // add form elements
        $this->add('select',
                'resource_types', ts("Select Resource Contact Types"),
                $contactTypeOptions,
                TRUE,
                [
                    'class' => 'crm-select2',
                    'multiple' => TRUE,
                    'placeholder' => ts('- select type(s) -')
        ]);
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
                'resource_role_id', ts("Select Resource Role"),
                $roleOptions,
                TRUE,
                [
                    'class' => 'crm-select2',
                    'multiple' => FALSE,
                    'placeholder' => ts('- select role -')
        ]);
//        $this->add('select',
//                'host_role_id', ts("Select Host Role"),
//                $roleOptions,
//                TRUE,
//                [
//                    'class' => 'crm-select2',
//                    'multiple' => FALSE,
//                    'placeholder' => ts('- select role -')
//        ]);
        $statusOptions = [];
        $sql = "SELECT `id`,`label`,`name`
                FROM `civicrm_participant_status_type`;";
        $dao = CRM_Core_DAO::executeQuery($sql);
        while ($dao->fetch()) {
            $statusOptions[$dao->id] = $dao->label;
        }
        $this->add('select',
                'resource_status_ids', ts("Select Resource Statuses"),
                $statusOptions,
                TRUE,
                [
                    'class' => 'crm-select2',
                    'multiple' => true,
                    'placeholder' => ts('- select status -')
        ]);

        $this->addButtons(array(
            array(
                'type' => 'submit',
                'name' => E::ts('Submit'),
                'isDefault' => TRUE,
            ),
        ));

        // export form elements
        $this->assign('elementNames', $this->getRenderableElementNames());
        $this->assign('descriptions', $descriptions);
        parent::buildQuickForm();
    }

    public function postProcess() {
        $values = $this->exportValues();
        $elements = $this->getRenderableElementNames();
        $settings = [];
        $oldSettings = CRM_ResourceManagement_BAO_ResourceConfiguration::getAllConfigs();
        foreach ($elements as $key) {
            if (is_array($values[$key])) {
                $values[$key] = implode(',', $values[$key]);
            }
            if (!isset($oldSettings[$key]) ||
                    $values[$key] !== $oldSettings[$key]) {
                $settings[$key] = $values[$key];
            }
        }
        if (!empty($settings)) {
            CRM_ResourceManagement_BAO_ResourceConfiguration::setConfigs($settings);
        }

//        $sql = 'SELECT n.title, t.name, d.field_booking_dato_value, d.field_booking_dato_value2, a.field_ansvarlig_value, c.id
//            FROM `node` n
//            LEFT JOIN `field_data_field_lokale` l on l.entity_id=n.nid
//            LEFT JOIN `taxonomy_term_data` t on t.tid=l.field_lokale_tid
//            LEFT JOIN `field_data_field_booking_dato` d on d.entity_id = n.nid
//            LEFT JOIN `field_data_field_ansvarlig` a on a.entity_id = n.nid
//            LEFT JOIN `civicrm_contact` c on c.display_name LIKE a.field_ansvarlig_value
//            WHERE l.entity_id IS NOT NULL
//            LIMIT 10';
//        $dao = CRM_Core_DAO::executeQuery($sql);
//        $titles = "";
//        while ($dao->fetch()) {
//            $titles .= "{$dao->title} / {$dao->name}\r\n";
//        }
        parent::postProcess();
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
        $settings = CRM_ResourceManagement_BAO_ResourceConfiguration::getAllConfigs();
        return $settings;
    }

}
