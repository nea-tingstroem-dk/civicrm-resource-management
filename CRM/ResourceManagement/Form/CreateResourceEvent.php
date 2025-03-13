<?php

use CRM_ResourceManagement_ExtensionUtil as E;
use CRM_ResourceManagement_BAO_ResourceConfiguration as C;
use CRM_ResourceManagement_BAO_ResourceCalendarSettings as RCS;

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
  private $_eventId = 0;
  private $_event = NULL;
  private $_filter = false;
  private $_suppressValidate = false;
  private $_calendarSettings = [];
  private $_currentUser = 0;
  private $_selectTemplates = [];
  private $_eventTitles = [];

  public function preProcess() {
    $buttonName = $this->controller->getButtonName();
    if (substr_compare($buttonName, 'delete', -6) === 0) {
      $this->_suppressValidate = true;
    }

    parent::preProcess();
    $this->_currentUser = (int) CRM_Core_Session::singleton()->getLoggedInContactID();
    $user = civicrm_api3('Contact', 'get', [
      'sequential' => 1,
      'return' => ["display_name", "external_identifier"],
      'id' => $this->_currentUser,
    ]);
    $actualUser = $user['values'][0];
    $this->_userId = $actualUser['contact_id'];
    $this->_userName = $actualUser['display_name'];
    $this->_userExternalId = $actualUser['external_identifier'];
    $this->_superUser = CRM_Core_Permission::check('edit all events', $this->_currentUser);
    $this->_authUser = CRM_Core_Permission::check('book own event', $this->_currentUser);
    if (!$this->_superUser && !$this->_authUser) {
      CRM_Core_Session::setStatus('', ts('Insufficient permission'), 'error');
    }
    $this->_calendar_id = CRM_Utils_Request::retrieve('calendar_id', 'Integer');
    $this->_calendarSettings = CRM_ResourceManagement_Page_AJAX::getResourceCalendarSettings($this->_calendar_id);

    $this->_eventId = CRM_Utils_Request::retrieve('event_id', 'Integer');
    if ($this->_eventId) {
      $this->add('hidden', 'event_id', $this->_eventId);
      $events = \Civi\Api4\Event::get(FALSE)
        ->addSelect('id', 'title', 'start_date', 'end_date',
          'pr.contact_id', 'pr.role_id', 'pr.status_id',
          'res.display_name',
          'ph.id', 'ph.contact_id', 'ph.role_id', 'ph.status_id',
          'host.display_name')
        ->addJoin('Participant AS pr', 'INNER', ['id', '=', 'pr.event_id'],
          ['pr.role_id', '=', $this->_calendarSettings['resource_role_id']])
        ->addJoin('Contact AS res', 'LEFT', ['pr.contact_id', '=', 'res.id'])
        ->addJoin('Participant AS ph', 'LEFT', ['id', '=', 'ph.event_id'],
          ['ph.role_id', '=', $this->_calendarSettings['host_role_id']])
        ->addJoin('Contact AS host', 'LEFT', ['host.id', '=', 'ph.contact_id'])
        ->setHaving([
          ['id', '=', $this->_eventId],
        ])
        ->setLimit(0)
        ->execute();
      $this->_event = $events[0];
      $this->_start_time = strtotime($this->_event['start_date']);
      $this->_end_time = strtotime($this->_event['end_date']);
    } else {
      $this->_filter = CRM_Utils_Request::retrieve('filter', 'Integer');
      $allDay = CRM_Utils_Request::retrieve('allday', 'Integer');
      $start = CRM_Utils_Request::retrieve('start', 'String');
      $end = CRM_Utils_Request::retrieve('end', 'String');
      if ($allDay) {
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

  public function validate(): bool {
    if ($this->_suppressValidate) {
      return true;
    }
    return parent::validate();
  }

  public function buildQuickForm() {
    CRM_Core_Resources::singleton()->addScriptFile('resource-management', 'js/moment.js', 5);
    $startTime = date('Y-m-d H:i:s', $this->_start_time);
    $this->add('hidden', 'start_date', $startTime);
    $endTime = date('Y-m-d H:i:s', $this->_end_time);
    $this->add('hidden', 'end_date', $endTime);
    $this->add('hidden', 'calendar_id', $this->_calendar_id);
    $duration = ($this->_end_time - $this->_start_time) / (60 * 60 * 24);
    $this->add('hidden', 'duration', $duration);
    $this->controller->_destination = CRM_Utils_System::url('civicrm/showresourceevents',
        ['id' => $this->_calendar_id]);
    $this->add('hidden', 'start_time', $startTime);
    if ($this->_start_time <= time()) {
      if ($this->_eventId) {
        $this->assign('error_message', E::ts('You cannot change event that has started'));
      } else {
        $this->assign('error_message', E::ts('You can only reserve future events'));
      }
      $this->addButtons([
        [
          'type' => 'cancel',
          'name' => E::ts('Cancel'),
          'class' => 'return',
        ]
      ]);
      parent::buildQuickForm();
      return;
    }
    $resources = $this->getResources($this->_calendar_id);
    $resource_options = [];
    $priceSets = [];
    foreach ($resources as $id => $res) {
      $resource_options[$id] = $res['name'];
    }
    $this->add('hidden', 'resource_source', json_encode($resources));
    if ($this->_eventId) {
      $this->add('hidden', 'event_id', $this->_eventId);
      $this->add('static', 'res_label', ts('Resource'), $this->_event['res.display_name']);
      $this->add('hidden', 'resources', "{$this->_event['pr.contact_id']}");
      $this->add('hidden', 'edit_url', 'civicrm/event/manage/settings?reset=1&action=update&id=' . $this->_eventId);
    } else if (!$this->_filter) {
      $this->add('select', 'resources', ts("Select Resource"), $resource_options,
        TRUE, ['class' => 'crm-select2',
        'multiple' => false,
        'placeholder' => ts('- select resource -')]);
    }
    if ($this->_eventId) {
      CRM_Utils_System::setTitle(E::ts('Edit Resource Event'));
    } else {
      CRM_Utils_System::setTitle(E::ts('Create Resource Event'));
    }

    $this->add('hidden', 'host_role_id', $this->_calendarSettings['host_role_id']);
    if (isset($this->_calendarSettings['common_templates'])) {
      $this->add('hidden', 'common_templates', $this->_calendarSettings['common_templates']);
    }
    $filter = $this->_filter;
    if ($filter) {
      $this->add('hidden', 'min_start', $resources[$filter]['min_start']);
      $this->add('hidden', 'max_end', $resources[$filter]['max_end']);
      $this->add('hidden', 'resources', $filter);
      $this->add('static', 'resource', ts("Selected Resource"), $resource_options[$filter]);
    } else {
      $this->add('hidden', 'min_start', $this->_min_start);
      $this->add('hidden', 'max_end', $this->_max_end);
    }
    if (!$this->_eventId) {
      if ($this->_calendarSettings['common_template']) {
        $t = [$this->_calendarSettings['event_template']];
      } else {
        $t = $this->_calendarSettings['event_templates'];
      }
      $eventTemplates = \Civi\Api4\Event::get(FALSE)
        ->addSelect('template_title', 'title')
        ->addWhere('id', 'IN', $t)
        ->execute()
        ->indexBy('id');
      $selectTemplates = [];
      $this->_eventTitles = [];
      foreach ($eventTemplates as $id => $row) {
        $selectTemplates[$id] = $row['template_title'];
        $this->_eventTitles[$id] = $row['title'];
      }
      $this->_selectTemplates = $selectTemplates;
    }
    if ($this->_superUser) {
      $this->buildAdminForm();
    } else {
      $this->buildUserForm();
    }

    parent::buildQuickForm();
  }

  public function buildAdminForm() {
    $this->add('hidden', 'event_titles', json_encode($this->_eventTitles));
    if (!$this->_calendarSettings['common_template']) {
      $this->add('select',
        'event_template',
        ts('Select template for event'),
        ['' => ts('- select -')] + $this->_selectTemplates, FALSE, ['class' => 'crm-select2 huge']);
    }
    $resStatuses = C::getConfig('resource_status_ids');
    $statusses = [];

    if (!$this->_eventId) {

      $this->addEntityRef('event_template', ts('Select Event Template'), [
        'entity' => 'event',
        'placeholder' => ts('- Select Event -'),
        'select' => ['minimumInputLength' => 0],
        'api' => [
          'params' => ['is_template' => TRUE,
            'is_active' => TRUE],
        ]
      ]);
    }
    $sql = "SELECT `id`,`name`,`label`
                    FROM `civicrm_participant_status_type`
                    WHERE `id` IN ({$resStatuses});";
    $dao = CRM_Core_DAO::executeQuery($sql);
    while ($dao->fetch()) {
      $statusses[$dao->id] = $dao->label;
    }
    $this->add('select', 'resource_status', ts('Select Resource Status'),
      $statusses, FALSE, ['class' => 'crm-select2', 'multiple' => false,
      'placeholder' => ts('- select status -')]);

    $this->addEntityRef('responsible_contact', ts('Select responsible contact'), NULL, FALSE);
    $statusOptions = [];
    $sql = "SELECT `id`,`label`,`name`
                FROM `civicrm_participant_status_type`;";
    $dao = CRM_Core_DAO::executeQuery($sql);
    while ($dao->fetch()) {
      $statusOptions[$dao->id] = $dao->label;
    }

    $this->add('select',
      'host_status_id', ts("Select Resp Cont Status"),
      $statusOptions,
      FALSE,
      [
        'class' => 'crm-select2',
        'multiple' => FALSE,
        'placeholder' => ts('- select status -')
    ]);

    $this->add('text', 'event_title', ts('Event Title'), NULL, TRUE);

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

    $groupTrees = $this->getGroupTrees();
    $this->assign('groupTrees', $groupTrees);
    $this->assign('adminFld', $this->_superUser);

    $buttons = [
      [
        'type' => 'submit',
        'subName' => 'submit',
        'name' => E::ts('Submit'),
        'isDefault' => TRUE,
      ]
    ];
    $buttons[] = [
      'type' => 'submit',
      'subName' => 'delete',
      'name' => E::ts('Delete'),
      'icon' => 'fa-trash',
    ];
    $buttons[] = [
      'type' => 'submit',
      'subName' => 'edit_event',
      'name' => E::ts('Edit Event'),
      'icon' => 'fa-pencil',
    ];
    $buttons[] = [
      'type' => 'submit',
      'subName' => $this->_eventId ? 'expand' : 'advanced',
      'name' => E::ts('Advanced'),
    ];

    $this->addButtons($buttons);
  }

  public function buildUserForm() {
    $this->add('hidden', 'responsible_contact', $this->_userId);
    $this->add('hidden', 'host_status_id', $this->_calendarSettings['host_status_id']);
    $this->add('static', 'user_info', ts('Responsible'),
      $this->_userExternalId . ' ' . $this->_userName);
    $this->add('text', 'event_title', ts('Event Title'));

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

    $groupTrees = $this->getGroupTrees();
//        $this->assign('elementGroups', $elementGroups);
//        $this->assign('elementPrices', $priceFieldGroups);
    $this->assign('groupTrees', $groupTrees);
    $this->assign('adminFld', $this->_superUser);

    $buttons = [
      [
        'type' => 'submit',
        'subName' => 'submit',
        'name' => E::ts('Submit'),
        'isDefault' => TRUE,
      ]
    ];

    $this->addButtons($buttons);

    parent::buildQuickForm();
  }

  public function postProcess() {
    $buttonName = $this->controller->getButtonName();
    if (substr_compare($buttonName, 'delete', -6) === 0) {
      if ($this->_eventId) {
        $event = CRM_Event_BAO_Event::findById($this->_eventId);
        $event->delete();
      }
    } else {
      $values = $this->_submitValues;
      $resourceRole = (int) $this->_calendarSettings['resource_role_id'];
      $hostRole = (int) $values['host_role_id'];
      $statuses = explode(',', C::getConfig('resource_status_ids'));
      $today = date('Y-m-d H:i:s');
      if (!$this->_eventId) {
        $resource_id = $values['resources'];
        $template_id = 0;
        if (isset($values['event_template'])) {
          $template_id = $values['event_template'];
        } else if ($this->_calendarSettings['common_template']) {
          $template_id = $this->_calendarSettings['event_template'];
        } else {
          $key = 'event_template_' . $resource_id;
          $template_id = $this->_calendarSettings[$key];
        }
        $template = new CRM_Event_BAO_Event();
        $template->id = $template_id;
        $template->find(true);

        $params = [];
        $params['start_date'] = $values['event_start_date'] ?? NULL;
        $params['end_date'] = $values['event_end_date'] ?? NULL;
        $params['has_waitlist'] = FALSE;
        $params['is_map'] = FALSE;
        if (isset($values['event_title'])) {
          $params['title'] = $values['event_title'];
        } else {
          $params['title'] = $template->title; // to avoid it is using template_title
        }
        $params = array_merge(CRM_Event_BAO_Event::getTemplateDefaultValues($template_id), $params);
        $event = CRM_Event_BAO_Event::copy($template_id, $params);
        $event->is_template = 0;
        $event->update();

        $params = [
          'register_date' => $today,
          'role_id' => $resourceRole,
          'contact_id' => $values['resources'],
          'event_id' => $event->id,
          'status_id' => isset($values['resource_status']) ? $values['resource_status'] : $this->_calendarSettings['resource_status_id'],
        ];
        $participant = CRM_Event_BAO_Participant::create($params);
        $participant->save();
        if (!empty($values['responsible_contact'])) {
          $params = [
            'register_date' => $today,
            'role_id' => $hostRole,
            'contact_id' => $values['responsible_contact'],
            'event_id' => $event->id,
            'status_id' => isset($values['host_status_id']) ? $values['host_status_id'] : $this->_calendarSettings['host_status_id'],
          ];
          $participant = CRM_Event_BAO_Participant::create($params);
          $participant->save();
        }
        $psId = CRM_Price_BAO_PriceSet::getFor('civicrm_event', $event->id);
        if ($psId) {
          $resId = $values['responsible_contact'];
          $groupTree = CRM_Price_BAO_PriceSet::getSetDetail($psId);
          $params = [];
          foreach ($groupTree[$psId]['fields'] as $pfId => $pField) {
            $eId = 'pf_' . $template_id . '_' . $psId . '_' . $pfId;
            $val = $values[$eId];
            if ($val) {
              $optionsKey = array_key_first($pField['options']);
              $qty = (float) $val;
              $unitPrice = (float) $pField['options'][$optionsKey]['amount'];
              $lineItem = [
                'price_field_id' => $pfId,
                'price_field_value_id' => $optionsKey,
                'label' => $pField['label'],
                'title' => $pField['name'],
                'qty' => $qty,
                'unit_price' => $unitPrice,
                'line_total' => $qty * $unitPrice,
                'partipiciant_count' => 0,
                'html_type' => $pField['html_type'],
                'financial_type_id' => (int) $pField['options'][$optionsKey]['financial_type_id'],
                'tax_amount' => 0,
                'non_deductible_amount' => '0.00'
              ];
              $params[$optionsKey] = $lineItem;
            }
          }
          if (!empty($params)) {
            CRM_Price_BAO_LineItem::processPriceSet($participant->id,
              [$psId => $params], null, 'civicrm_participant');
          }
        }
      } else if ($this->_action === 0) { // Update
        $change = false;
        $event = CRM_Event_BAO_Event::findById($this->_eventId);
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
        $participant = new CRM_Event_BAO_Participant();
        $participant->event_id = $this->_eventId;
        $participant->role_id = $resourceRole;
        $participant->find();
        while ($participant->fetch()) {
          if ($participant->contact_id === $values['resources']) {
            if ($participant->status_id != $values['resource_status']) {
              $participant->status_id = $values['resource_status'];
              $participant->save();
            }
          }
        }
        $host = new CRM_Event_BAO_Participant();
        $host->event_id = $event->id;
        $host->role_id = $hostRole;
        $host->find();
        if ($host->N === 0) {
          if (!empty($values['responsible_contact'])) {
            $params = [
              'register_date' => $today,
              'role_id' => $hostRole,
              'contact_id' => $values['responsible_contact'],
              'event_id' => $event->id,
              'status_id' => $values['host_status_id'],
            ];
            $host = CRM_Event_BAO_Participant::create($params);
            $host->save();
          }
        } else {
          while ($host->fetch()) {
            $change = FALSE;
            if (isset($values['responsible_contact'])) {
              if ($host->contact_id != (int) $values['responsible_contact']) {
                $host->contact_id = (int) $values['responsible_contact'];
                $change = TRUE;
                $host->register_date = $today;
              }
              if ((int) $host->status_id != (int) $values['host_status_id']) {
                $host->status_id = $values['host_status_id'];
                $change = TRUE;
              }
              if ($change) {
                $host->save();
              }
            } else {
              $host->delete();
            }
          }
        }
        $psId = CRM_Price_BAO_PriceSet::getFor('civicrm_event', $event->id);
        if ($psId) {
          $groupTree = CRM_Price_BAO_PriceSet::getSetDetail($psId);
          $params = [];
          foreach ($groupTree[$psId]['fields'] as $pfId => $pField) {
            $eId = 'pf_' . $this->_eventId . '_' . $psId . '_' . $pfId;
            $val = $values[$eId];
            if ($val) {
              $optionsKey = array_key_first($pField['options']);
              $qty = (float) $val;
              $unitPrice = (float) $pField['options'][$optionsKey]['amount'];
              $lineItem = [
                'price_field_id' => $pfId,
                'price_field_value_id' => $optionsKey,
                'label' => $pField['label'],
                'title' => $pField['name'],
                'qty' => $qty,
                'unit_price' => $unitPrice,
                'line_total' => $qty * $unitPrice,
                'partipiciant_count' => 0,
                'html_type' => $pField['html_type'],
                'financial_type_id' => (int) $pField['options'][$optionsKey]['financial_type_id'],
                'tax_amount' => 0,
                'non_deductible_amount' => '0.00'
              ];
              $params[$optionsKey] = $lineItem;
            }
          }
          if (!empty($params)) {
            CRM_Price_BAO_LineItem::processPriceSet($participant->id,
              [$psId => $params], null, 'civicrm_participant');
          }
        }
      }

      if (substr_compare($buttonName, 'advanced', -8) === 0 ||
        substr_compare($buttonName, 'expand', -6) === 0) {
        CRM_Utils_JSON::output(['openpage' => "civicrm/a/#/resource/manage-event?" .
          "event_id={$event->id}&calendar_id={$this->_calendar_id}"]);
      } else if (substr_compare($buttonName, 'edit_event', -10) === 0) {
        CRM_Utils_JSON::output(['openpage' => 'civicrm/event/manage/settings?' .
          'reset=1&action=update&id=' . $this->_eventId]);
      } else {
        CRM_Utils_JSON::output(['result' => 'OK']);
      }
    }
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
      if ($this->_eventId) {
        $sql .= " AND e.id != " . $this->_eventId;
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
      if ($this->_eventId) {
        $sql .= " AND e.id != " . $this->_eventId;
      }
      $sql .= " ORDER BY e.`end_date` DESC
                    LIMIT 1;";
      $min_time = CRM_CORE_DAO::singleValueQuery($sql) ?? date('Y-m-d H:i:s', time());
      if (!$this->_min_start || $this->_min_start < $min_time) {
        $this->_min_start = $min_time;
      }
      $template_id = $this->_calendarSettings['event_template_' . $dao->contact_id] ?? NULL;
      $title = "";
      if (!empty($template_id)) {
        $template = CRM_Event_BAO_Event::findById($template_id);
        $title = $template->title;
      }


      $resource = [
        'name' => $dao->name,
        'min_start' => $min_time,
        'max_end' => $max_time,
        'event_title' => $title,
        'template_id' => $template_id,
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
    if (!$this->_superUser) {
      $defaults['event_title'] = ts("Private Event");
    }
    $calendarSettings = RCS::getAllSettings($this->_calendar_id);
    if ($this->_eventId) {
      $defaults['event_title'] = $this->_event['title'];
      $defaults['event_start_date'] = $this->_event['start_date'];
      $defaults['event_end_date'] = $this->_event['end_date'];
      $hostRole = $calendarSettings['host_role_id'];
      $resourceRole = C::getConfig('resource_role_id');
      $resourceId = $this->_event['pr.contact_id'];
      $defaults['resource_status'] = $this->_event['pr.status_id'];
      $defaults['responsible_contact'] = $this->_event['ph.contact_id'];
      $defaults['host_status_id'] = $this->_event['ph.status_id'];
      $lineItems = CRM_Price_BAO_LineItem::getLineItems($this->_event['ph.id'], 'participant');
      foreach ($lineItems as $key => $value) {
//pf_4728_49_84
        if ($value['html_type'] === 'Select') {
          $defaults["pf_{$this->_eventId}_{$value['price_set_id']}_{$value['price_field_id']}"] = $value['price_field_value_id'];
        } else {
          $defaults["pf_{$this->_eventId}_{$value['price_set_id']}_{$value['price_field_id']}"] = $value['qty'];
        }
      }
    } else {
      $defaults['event_start_date'] = date('Y-m-d H:i:s', $this->_start_time);
      $defaults['event_end_date'] = date('Y-m-d H:i:s', $this->_end_time);
      $defaults['responsible_contact'] = $this->_currentUser;
      $defaults['host_status_id'] = $this->_calendarSettings['host_status_id'];
      if ($this->_calendarSettings['common_template'] &&
        isset($this->_calendarSettings['event_template'])) {
        $defaults['event_template'] = $this->_calendarSettings['event_template'];
        $defaults['event_title'] = $this->_eventTitles[$this->_calendarSettings['event_template']];
      }
      if ($this->_filter) {
        $defaults['resources'] = $this->_filter;
      }
      $defaults['resource_status'] = $this->_calendarSettings['resource_status_id'];
    }
    return $defaults;
  }

  private function getGroupTrees() {
    $groupTrees = [];
    $baseElements = $this->getRenderableElementNames();
    $public = (int) CRM_Price_BAO_PriceField::getVisibilityOptionID('public');
    if ($this->_eventId) {
      $psId = CRM_Price_BAO_PriceSet::getFor('civicrm_event', $this->_eventId);
      if ($psId) {
        $eventId = $this->_eventId;
        $resId = $this->_event['pr.contact_id'];
        $groupTree = CRM_Price_BAO_PriceSet::getSetDetail($psId);
        $this->add('static',
          'res_' . $eventId . '_pre_help',
          ts('Price info'),
          $groupTree['help_pre']);
        foreach ($groupTree[$psId]['fields'] as $pfId => $pField) {
          $eId = 'pf_' . $eventId . '_' . $psId . '_' . $pfId;
          $pField['elementId'] = $eId;
          CRM_Price_BAO_PriceField::addQuickFormElement($this,
            $eId,
            $pfId,
            FALSE,
          );
        }
        $elementGroups[] = 'group_' . $eventId;
        $groupTrees[$eventId] = $groupTree;
        if (isset($this->_calendarSettings["price_calc_{$resId}"]) &&
          isset($this->_calendarSettings["price_field_{$resId}"]) &&
          isset($this->_calendarSettings["price_qty_{$resId}"])) {
          $this->add('hidden', "price_field_{$resId}",
            'pf_' . $eventId . '_' . $psId . '_' . $this->_calendarSettings["price_field_{$resId}"]);
          $calcParms = explode('_', $this->_calendarSettings["price_qty_{$resId}"]);
          $this->add('hidden', "price_period_{$resId}", $calcParms[0]);
          $this->add('hidden', "price_factor_{$resId}", $calcParms[1]);
        }
      }
    } else {
      $eventTemplates = \Civi\Api4\Event::get(FALSE)
        ->addWhere('is_template', '=', TRUE)
        ->addWhere('is_active', '=', TRUE)
        ->execute()
        ->indexBy('id')
        ->column('template_title');
      $templatePricesets = [];
      foreach ($eventTemplates as $eId => $title) {
        $psId = CRM_Price_BAO_PriceSet::getFor('civicrm_event', $eId);
        if ($psId) {
          $templatePricesets[$eId] = $psId;
        }
      }
      if ($this->_calendarSettings['common_template'] &&
        isset($this->_calendarSettings['event_template'])) {
        $tId = $this->_calendarSettings['event_template'];
        $psId = isset($templatePricesets[$tId]) ? $templatePricesets[$tId] : false;
        if ($psId) {
          $ps = CRM_Price_BAO_PriceSet::findById($psId);
          $groupTree = CRM_Price_BAO_PriceSet::getSetDetail($psId);
          $this->add('static',
            'res_' . $tId . '_pre_help',
            ts('Price info'),
            $ps->help_pre);
          foreach ($groupTree[$psId]['fields'] as $pfId => $pField) {
            $eId = 'pf_' . $tId . '_' . $psId . '_' . $pfId;
            $pField['elementId'] = $eId;
            CRM_Price_BAO_PriceField::addQuickFormElement($this,
              $eId,
              $pfId,
              FALSE,
            );
          }
          if (isset($this->_calendarSettings["price_calc_t{$tId}"]) &&
            isset($this->_calendarSettings["price_field_t{$tId}"]) &&
            isset($this->_calendarSettings["price_qty_t{$tId}"])) {
            $this->add('hidden', "price_field_t{$tId}",
              'pf_' . $tId . '_' . $psId . '_' . $this->_calendarSettings["price_field_t{$tId}"]);
            $calcParms = explode('_', $this->_calendarSettings["price_qty_t{$tId}"]);
            $this->add('hidden', "price_period_t{$tId}", $calcParms[0]);
            $this->add('hidden', "price_factor_t{$tId}", $calcParms[1]);
          }
          $elementGroups[] = 'group_' . $tId;
          $groupTrees[$tId] = $groupTree;
        }
      } else {
        foreach ($resources as $resId => $res) {
          $tId = $res['template_id'];
          if (!is_null($tId) && $tId !== '') {
            $psId = $templatePricesets[$tId];
            $ps = CRM_Price_BAO_PriceSet::findById($psId);
            $groupTree = CRM_Price_BAO_PriceSet::getSetDetail($psId);
            $this->add('static',
              'res_' . $tId . '_pre_help',
              ts('Price info'),
              $ps->help_pre);
            foreach ($groupTree[$psId]['fields'] as $pfId => $pField) {
              $eId = 'pf_' . $tId . '_' . $psId . '_' . $pfId;
              $pField['elementId'] = $eId;
              CRM_Price_BAO_PriceField::addQuickFormElement($this,
                $eId,
                $pfId,
                FALSE,
              );
            }
          }
          if (isset($this->_calendarSettings["price_calc_{$resId}"]) &&
            isset($this->_calendarSettings["price_field_{$resId}"]) &&
            isset($this->_calendarSettings["price_qty_{$resId}"])) {
            $this->add('hidden', "price_field_{$resId}",
              'pf_' . $tId . '_' . $psId . '_' . $this->_calendarSettings["price_field_{$resId}"]);
            $calcParms = explode('_', $this->_calendarSettings["price_qty_{$resId}"]);
            $this->add('hidden', "price_period_{$resId}", $calcParms[0]);
            $this->add('hidden', "price_factor_{$resId}", $calcParms[1]);
          }
          $elementGroups[] = 'group_' . $tId;
          $groupTrees[$tId] = $groupTree;
        }
      }
    }
    $this->assign('elementNames', $baseElements);
    return $groupTrees;
  }

}
