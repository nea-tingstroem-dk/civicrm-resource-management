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
  private $_calendar_settings = [];
  private $_deleting = FALSE;

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
    $settingsObj = new CRM_ResourceManagement_DAO_ResourceCalendarSettings();
    $settingsObj->calendar_id = $this->_calendar_id;
    $settingsObj->find();
    $settings = [];
    while ($settingsObj->fetch()) {
      $settings['cs_' . $settingsObj->config_key] = $settingsObj->config_value;
    }
    $this->_calendar_settings = $settings;

    parent::preProcess();
  }

  public function buildQuickForm() {
    CRM_Utils_System::setTitle(E::ts('Resource Calendars Settings'));
    $this->controller->_destination = CRM_Utils_System::url('civicrm/admin/resource-calendars', 'reset=1');
    $this->action = CRM_Utils_Request::retrieve('action', 'String') ?? '';
    $this->_deleting = CRM_Utils_Request::retrieve('deleting', 'String') ?? FALSE;

    $elementGroups = [];
    $group_labels = [];
    $statusOptions = [];
    $descriptions = [];

    $sql = "SELECT `id`,`label`,`name`
                FROM `civicrm_participant_status_type`;";
    $dao = CRM_Core_DAO::executeQuery($sql);
    while ($dao->fetch()) {
      $statusOptions[$dao->id] = $dao->label;
    }

    $this->add('hidden', 'calendar_id', $this->_calendar_id);
    $this->add('hidden', 'calendar_type', $this->_calendar_type);
    if ($this->action === CRM_Core_Action::DELETE) {
      $descriptions['delete_warning'] = ts('Are you sure you want to delete this calendar?');
      $this->add('hidden', 'deleting', TRUE);
      $this->assign('descriptions', $descriptions);
      $this->addButtons(array(
        array(
          'type' => 'submit',
          'name' => ts('Delete'),
        ),
      ));
    } else if ($this->_deleting) {
      $this->action = CRM_Core_Action::DELETE;
    } else {
      CRM_Core_Resources::singleton()->addScriptFile('resource-management', 'js/jscolor.js');
      CRM_Core_Resources::singleton()->addScriptFile('resource-management', 'js/resourcecalendar.js');

      $descriptions = array();

      $this->add('hidden', 'action', $this->action);
      $this->add('text', 'calendar_title', ts('Calendar Title'));
      $elementGroups['calendar_title'] = 'none';
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
      $elementGroups['resources'] = 'none';

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
      $elementGroups['cs_resource_role_id'] = 'none';

      $this->add('select',
        'cs_resource_status_id', ts("Select Resource Default Status"),
        $statusOptions,
        TRUE,
        [
          'class' => 'crm-select2',
          'multiple' => FALSE,
          'placeholder' => ts('- select status -')
      ]);
      $elementGroups['cs_resource_status_id'] = 'none';

      $eventTemplates = [];

      $events = \Civi\Api4\Event::get(TRUE)
        ->addSelect('template_title')
        ->addWhere('is_template', '=', TRUE)
        ->addOrderBy('template_title', 'ASC')
        ->execute();
      foreach ($events as $e) {
        $eventTemplates[$e['id']] = $e['template_title'];
      }
      $this->add('select', "cs_available_templates",
        ts("Select Available Event templates"), $eventTemplates,
        TRUE, ['class' => 'crm-select2', 'multiple' => TRUE,
        'placeholder' => ts('- select template -')]);
      $elementGroups["cs_available_templates"] = 'none';

      $availableTemplates = [];
      $avIds = [];
      $v = $this->_calendar_settings['cs_available_templates'] ?? FALSE;
      if ($v) {
        if (str_starts_with($v ?? '', '[')) {
          $avIds = explode(',', substr($v, 1, strlen($v) - 2));
        } else {
          $avIds = [(int) $v];
        }

        foreach ($avIds as $key) {
          $availableTemplates[$key] = $eventTemplates[$key];
        }
        asort($availableTemplates);
      }

      $this->add('advcheckbox', "cs_common_template", ts("Common template for all"),
      );
      $elementGroups['cs_common_template'] = 'none';

      if ($this->action === CRM_Core_Action::UPDATE) {

        $calendarResources = $this->getCalendarResources();
        $commonTemplate = isset($this->_calendar_settings['cs_common_template']) ?
          $this->_calendar_settings['cs_common_template'] === "1" : FALSE;
        if ($commonTemplate) {
          $this->add('select', "cs_event_template",
            ts("Select User Template(s)"),
            $availableTemplates,
            TRUE,
            [
              'class' => 'crm-select2 user-template',
              'multiple' => true,
              'placeholder' => ts('- select template(s) -')
          ]);
          $elementGroups["cs_event_template"] = 'none';

          $this->add('text', 'cs_event_link', E::ts('Link'));
          $elementGroups["cs_event_link"] = 'none';
          $descriptions['cs_event_link'] = ts('Link to action when event is clicked in calendar');

          if (isset($this->_calendar_settings['cs_event_template'])) {
            $tId = $this->explodeIfArray($this->_calendar_settings['cs_event_template']);
          } else {
            $tId = false;
          }
          if ($tId) {
            if (!is_array($tId)) {
              $tId = [$tId];
            }
            foreach ($tId as $temp) {
              $psId = CRM_Price_BAO_PriceSet::getFor('civicrm_event', $temp);
              if ($psId) {
                $groupId = "none";
                $this->add('advcheckbox', "cs_price_calc_{$temp}", ts("Price Calculation"));
                $descriptions["cs_price_calc_{$temp}"] = ts('For: ') . $eventTemplates[$temp];
                $elementGroups["cs_price_calc_{$temp}"] = 'none';
                $priceFields = [];
                $groupTree = CRM_Price_BAO_PriceSet::getSetDetail($psId);
                foreach ($groupTree[$psId]['fields'] as $pfId => $pField) {
                  $priceFields[$pfId] = $pField['label'];
                }
                $this->add('select',
                  "cs_price_field_{$temp}",
                  ts("Price Field"),
                  $priceFields,
                  ['class' => "crm-select2",
                    'multiple' => FALSE,
                    'placeholder' => ts("- select pricefield -")]
                );
                $elementGroups["cs_price_field_{$temp}"] = $groupId;

                $this->add('select',
                  "cs_price_qty_{$temp}",
                  ts("Quantity in"),
                  [
                    'days_0.5' => ts('Started Half Days'),
                    'days_1.0' => ts('Started Whole Days'),
                    'hours_2.0' => ts('Started Hours')
                  ],
                  ['class' => 'crm-select2',
                    'multiple' => FALSE,
                ]);
                $elementGroups["cs_price_qty_{$temp}"] = $groupId;
              }
            }
          }
        } else {
          foreach ($calendarResources as $res_id) {
            $groupId = "none";
            $res = CRM_Contact_BAO_Contact::findById($res_id);
            $this->add('select', "cs_event_template_{$res_id}",
              ts("Select User Template for ") . $res->display_name,
              $availableTemplates,
              TRUE,
              [
                'class' => 'crm-select2 user-template',
                'multiple' => FALSE,
                'placeholder' => ts('- select template -')
            ]);
            $elementGroups["cs_event_template_{$res_id}"] = $groupId;

            $this->add('text', "cs_event_link_{$res_id}", E::ts('Link'));
            $elementGroups["cs_event_link_{$res_id}"] = $groupId;
            $descriptions["cs_event_link_{$res_id}"] = ts('Link to action when event is clicked in calendar');

            $priceFields = [];
            if (isset($this->_calendar_settings["cs_event_template_{$res_id}"])) {
              $tId = $this->_calendar_settings["cs_event_template_{$res_id}"];
              $this->addPriceSetGroup($tId, $descriptions, $elementGroups);
            }
          }
        }
        $this->add('advcheckbox', 'cs_show_end_date', ts('Show End Date?'));
        $elementGroups['cs_show_end_date'] = 'none';

        $descriptions['cs_show_end_date'] = ts('Show the event with start and end dates on the calendar.');
        $this->add('advcheckbox', 'cs_show_public_events', ts('Show Public Events?'));
        $elementGroups['cs_show_public_events'] = 'none';
        $descriptions['cs_show_public_events'] = ts('Show only public events, or all events.');
        $this->add('advcheckbox', 'cs_week_begins_day', ts('Week begins on'));
        $elementGroups['cs_week_begins_day'] = 'none';
        $descriptions['cs_week_begins_day'] = ts('Use weekBegin settings from CiviCRM. You can override settings at Administer > Localization > Date Formats.');
        $this->add('advcheckbox', 'cs_time_format_24_hour', ts('24 hour time format'));
        $elementGroups['cs_time_format_24_hour'] = 'none';
        $descriptions['cs_time_format_24_hour'] = ts('Use 24 hour time format - default is AM/PM format.');
        $elementGroups['cs_scroll'] = 'none';
        $this->add('select',
          'cs_scroll',
          E::ts('Calendar scroll'),
          [
            '08:00:00' => E::ts('Day time - from 08:00'),
            '17:00:00' => E::ts('Evening - from 17:00')
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
          'cs_host_role_id', ts("Select Host Role"),
          $roleOptions,
          TRUE,
          [
            'class' => 'crm-select2',
            'multiple' => FALSE,
            'placeholder' => ts('- select role -')
        ]);
        $elementGroups['cs_host_role_id'] = 'none';

        $this->add('select',
          'cs_host_status_id', ts("Select Host Default Status"),
          $statusOptions,
          TRUE,
          [
            'class' => 'crm-select2',
            'multiple' => FALSE,
            'placeholder' => ts('- select status -')
        ]);
        $elementGroups['cs_host_status_id'] = 'none';

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
          $elementGroups["statusid_{$id}"] = 'none';
          $this->addElement('text', "eventcolorid_{$id}", "Color",
            array(
              'onchange' => "updatecolor('eventcolorid_{$id}', this.value);",
              'class' => 'color',
              'id' => "eventcolorid_{$id}",
          ));
          $elementGroups["eventcolorid_{$id}"] = 'none';
        }
      }
      $this->addButtons(array(
        array(
          'type' => 'submit',
          'name' => ts('Submit'),
          'isDefault' => TRUE,
        ),
      ));
    }

    // export form element
    $this->assign('elementGroups', $elementGroups);
    $this->assign('descriptions', $descriptions);
    $this->assign('group_labels', $group_labels);
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
        if (is_array($value)) {
          $settings[substr($key, 3)] = '[' . implode(',', $value) . ']';
        } else {
          $settings[substr($key, 3)] = $value;
        }
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

      $setting = new CRM_ResourceManagement_DAO_ResourceCalendarSettings();
      $setting->calendar_id = $this->_calendar_id;
      $setting->find();
      while ($setting->fetch()) {
        if (isset($settings[$setting->config_key])) {
          if ($setting->config_value !== $settings[$setting->config_key]) {
            $params = [
              'id' => $setting->id,
              'calendar_id' => $this->_calendar_id,
              'config_key' => $setting->config_key,
              'config_value' => $settings[$setting->config_key],
            ];
            CRM_ResourceManagement_DAO_ResourceCalendarSettings::writeRecord($params);
          }
          unset($settings[$setting->config_key]);
        } else {
          CRM_ResourceManagement_DAO_ResourceCalendarSettings::deleteRecord(['id' => $setting->id]);
        }
      }
      $params = [];
      foreach ($settings as $key => $value) {
        if ($value) {
          $params[] = [
            'calendar_id' => $this->_calendar_id,
            'config_key' => $key,
            'config_value' => $value,
          ];
        }
      }
      if (!empty($params)) {
        CRM_ResourceManagement_DAO_ResourceCalendarSettings::writeRecords($params);
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

      foreach ($this->_calendar_settings as $key => $value) {
        $defaults[$key] = $this->explodeIfArray($value);
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

  private function explodeIfArray($setting) {
    if ($setting != null && str_starts_with($setting, '[')) {
      return explode(',', substr($setting, 1, strlen($setting) - 2));
    } else {
      return $setting;
    }
  }

  public function addPriceSetGroup($tId, &$descriptions, &$elementGroups) {
    $psId = CRM_Price_BAO_PriceSet::getFor('civicrm_event', $tId);
    $ps = CRM_Price_BAO_PriceSet::findById($psId);
    $groupTree = CRM_Price_BAO_PriceSet::getSetDetail($psId);
    foreach ($groupTree as $gtId => $gt) {
      foreach ($gt['fields'] as $field) {
        $pfIdent = "{$tId}_{$psId}_{$field['id']}";
        $this->add('advcheckbox', "cs_price_calc_{$pfIdent}", ts("Price Calculation"));
        $descriptions["cs_price_calc_{$pfIdent}"] = ts('For: ') . $field['label'];
        $elementGroups["cs_price_calc_{$pfIdent}"] = 'none';

        $this->add('select',
          "cs_price_qty_{$pfIdent}",
          ts("Quantity in"),
          [
            'days_0.5' => ts('Started Half Days'),
            'days_1.0' => ts('Started Whole Days'),
            'hours_2.0' => ts('Started Hours')
          ],
          ['class' => 'crm-select2',
            'multiple' => FALSE,
        ]);
        $elementGroups["cs_price_qty_{$pfIdent}"] = "group_{$pfIdent}";
      }
    }
  }

}
